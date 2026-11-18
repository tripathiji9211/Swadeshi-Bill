"""
Swadeshi Khata (स्वदेशी खाता) - Multi-Category Spending Forecasting Engine
==========================================================
Forecasts next month's business expense spend per category comparing:
1. Moving-Average Baseline (Rolling 3-month window)
2. SARIMA (Seasonal Autoregressive Integrated Moving Average)
3. XGBoost Regressor with Autoregressive Lag & Rolling Features

Includes:
- Time-based train/test split (19-month training vs 5-month holdout evaluation)
- Evaluation reporting MAE (Mean Absolute Error) and MAPE (Mean Absolute Percentage Error)
- Visualization of Forecast vs Actual across all 8 categories
- Model serialization: saves the best-performing model per category
"""

from typing import Dict, Any, List, Optional, Tuple
import os
import sys
import json
import tempfile
from pathlib import Path
from datetime import datetime

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thread-safe headless Matplotlib setup
os.environ["MPLCONFIGDIR"] = tempfile.gettempdir()
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import pandas as pd
import numpy as np
import joblib

from statsmodels.tsa.statespace.sarimax import SARIMAX
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error

from src.config import EXPENSES_DB_PATH, MODELS_DIR

FORECAST_MODELS_DIR = MODELS_DIR / "forecasting"
FORECAST_MODELS_DIR.mkdir(parents=True, exist_ok=True)


# =============================================================================
# 1. MODEL 1: MOVING-AVERAGE BASELINE
# =============================================================================

class MovingAverageForecaster:
    """
    Moving-average heuristic baseline.
    Predicts future periods using the rolling mean of the most recent W periods.
    """

    def __init__(self, window: int = 3):
        self.window = int(window)
        self.history: Optional[pd.Series] = None

    def fit(self, series: pd.Series) -> "MovingAverageForecaster":
        self.history = series.copy()
        return self

    def predict(self, steps: int = 1) -> np.ndarray:
        if self.history is None or len(self.history) == 0:
            raise ValueError("Model is not fitted.")
        current_history = list(self.history.values)
        predictions = []
        for _ in range(steps):
            window_vals = current_history[-self.window:]
            pred = float(np.mean(window_vals))
            predictions.append(pred)
            current_history.append(pred)
        return np.array(predictions)


# =============================================================================
# 2. MODEL 2: SARIMA (SEASONAL ARIMA)
# =============================================================================

class SARIMAForecaster:
    """
    Seasonal Autoregressive Integrated Moving Average (SARIMA) Forecaster.
    Fits temporal autocorrelation, differencing (stationarity), and moving-average shocks.
    """

    def __init__(
        self,
        order: Tuple[int, int, int] = (1, 1, 0),
        seasonal_order: Tuple[int, int, int, int] = (0, 0, 0, 0),
    ):
        self.order = order
        self.seasonal_order = seasonal_order
        self.model_res = None
        self.last_history = None

    def fit(self, series: pd.Series) -> "SARIMAForecaster":
        self.last_history = series.copy()
        try:
            model = SARIMAX(
                series,
                order=self.order,
                seasonal_order=self.seasonal_order,
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            self.model_res = model.fit(disp=False, maxiter=100)
        except Exception:
            # Fallback to AR(1) if higher-order differencing encounters singular matrix
            fallback_order = (1, 0, 0)
            model = SARIMAX(
                series,
                order=fallback_order,
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            self.model_res = model.fit(disp=False, maxiter=50)
        return self

    def predict(self, steps: int = 1) -> np.ndarray:
        if self.model_res is None:
            raise ValueError("Model is not fitted.")
        preds = self.model_res.forecast(steps=steps)
        # Ensure non-negative spending forecast
        return np.clip(preds.values, a_min=0.0, a_max=None)


# =============================================================================
# 3. MODEL 3: XGBOOST REGRESSOR WITH LAG FEATURES
# =============================================================================

class XGBoostLagForecaster:
    """
    Gradient Boosted Decision Tree (XGBoost) with autoregressive lag features,
    rolling statistics, and cyclical calendar indicators.
    """

    def __init__(
        self,
        n_estimators: int = 60,
        max_depth: int = 2,
        learning_rate: float = 0.08,
        random_state: int = 42,
    ):
        self.n_estimators = int(n_estimators)
        self.max_depth = int(max_depth)
        self.learning_rate = float(learning_rate)
        self.random_state = int(random_state)
        self.model: Optional[XGBRegressor] = None
        self.last_history: Optional[pd.Series] = None

    def _create_features(self, series: pd.Series) -> Tuple[pd.DataFrame, pd.Series]:
        """Generates autoregressive lag and temporal calendar features."""
        df = pd.DataFrame({"y": series})
        df["lag_1"] = df["y"].shift(1)
        df["lag_2"] = df["y"].shift(2)
        df["lag_3"] = df["y"].shift(3)
        df["roll_mean_3"] = df["y"].shift(1).rolling(3, min_periods=1).mean()
        df["roll_std_3"] = df["y"].shift(1).rolling(3, min_periods=1).std().fillna(0.0)

        # Temporal features
        if isinstance(series.index, pd.DatetimeIndex):
            df["month_num"] = series.index.month
            df["quarter"] = series.index.quarter
        else:
            df["month_num"] = [(i % 12) + 1 for i in range(len(series))]
            df["quarter"] = [((m - 1) // 3) + 1 for m in df["month_num"]]

        # Drop rows with NaN from lags
        clean_df = df.dropna()
        X = clean_df[["lag_1", "lag_2", "lag_3", "roll_mean_3", "roll_std_3", "month_num", "quarter"]]
        y = clean_df["y"]
        return X, y

    def fit(self, series: pd.Series) -> "XGBoostLagForecaster":
        self.last_history = series.copy()
        X, y = self._create_features(series)
        self.model = XGBRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            random_state=self.random_state,
            n_jobs=1,
        )
        self.model.fit(X, y)
        return self

    def predict(self, steps: int = 1) -> np.ndarray:
        """Autoregressive recursive multi-step forecasting."""
        if self.model is None or self.last_history is None:
            raise ValueError("Model is not fitted.")

        history_vals = list(self.last_history.values)
        last_dt = self.last_history.index[-1] if isinstance(self.last_history.index, pd.DatetimeIndex) else datetime(2025, 12, 1)
        predictions = []

        for step in range(1, steps + 1):
            next_dt = last_dt + pd.DateOffset(months=step)
            month_num = next_dt.month
            quarter = (month_num - 1) // 3 + 1

            lag_1 = history_vals[-1]
            lag_2 = history_vals[-2] if len(history_vals) >= 2 else lag_1
            lag_3 = history_vals[-3] if len(history_vals) >= 3 else lag_2
            roll_mean = float(np.mean(history_vals[-3:]))
            roll_std = float(np.std(history_vals[-3:]))

            X_step = pd.DataFrame([{
                "lag_1": lag_1,
                "lag_2": lag_2,
                "lag_3": lag_3,
                "roll_mean_3": roll_mean,
                "roll_std_3": roll_std,
                "month_num": month_num,
                "quarter": quarter,
            }])

            pred_val = float(self.model.predict(X_step)[0])
            pred_val = max(0.0, pred_val)
            predictions.append(pred_val)
            history_vals.append(pred_val)

        return np.array(predictions)


# =============================================================================
# 4. SERIALIZATION HELPERS
# =============================================================================

def save_model_bundle(model_inst, path: Path):
    """Safely serializes forecaster instances using dictionaries to avoid class pickle locks."""
    if isinstance(model_inst, MovingAverageForecaster):
        bundle = {
            "type": "moving_average",
            "window": model_inst.window,
            "history": list(model_inst.history.values) if model_inst.history is not None else [],
        }
    elif isinstance(model_inst, SARIMAForecaster):
        bundle = {
            "type": "sarima",
            "order": model_inst.order,
            "seasonal_order": model_inst.seasonal_order,
            "model_res": model_inst.model_res,
            "history": list(model_inst.last_history.values) if model_inst.last_history is not None else [],
        }
    elif isinstance(model_inst, XGBoostLagForecaster):
        bundle = {
            "type": "xgboost",
            "model": model_inst.model,
            "history": list(model_inst.last_history.values) if model_inst.last_history is not None else [],
        }
    else:
        raise ValueError(f"Unknown forecaster type: {type(model_inst)}")

    joblib.dump(bundle, path)


def load_model_bundle(path: Path):
    """Deserializes saved model bundles back into functional forecaster instances."""
    bundle = joblib.load(path)
    btype = bundle.get("type")
    if btype == "moving_average":
        inst = MovingAverageForecaster(window=bundle.get("window", 3))
        inst.history = pd.Series(bundle.get("history", []))
        return inst
    elif btype == "sarima":
        inst = SARIMAForecaster(order=bundle.get("order", (1, 1, 0)), seasonal_order=bundle.get("seasonal_order", (0, 0, 0, 0)))
        inst.model_res = bundle.get("model_res")
        inst.last_history = pd.Series(bundle.get("history", []))
        return inst
    elif btype == "xgboost":
        inst = XGBoostLagForecaster()
        inst.model = bundle.get("model")
        inst.last_history = pd.Series(bundle.get("history", []))
        return inst
    raise ValueError(f"Unknown bundle type: {btype}")


# =============================================================================
# 5. MASTER ORCHESTRATOR & BENCHMARKING
# =============================================================================

class CategorySpendForecaster:
    """
    Orchestrates time-series spend forecasting across all 8 Indian SMB expense categories:
    1. Prepares monthly spend aggregations per category.
    2. Performs time-based train/test split.
    3. Fits and compares Moving Average, SARIMA, and XGBoost.
    4. Evaluates test set performance using MAE and MAPE.
    5. Saves the winning model per category to disk.
    6. Generates multi-panel forecast visualization plot.
    """

    CATEGORIES = [
        "groceries",
        "utilities",
        "rent",
        "transport",
        "salaries",
        "supplies",
        "marketing",
        "misc",
    ]

    def __init__(self, data_path: Optional[Path] = None):
        self.data_path = data_path or EXPENSES_DB_PATH
        self.best_models: Dict[str, Any] = {}
        self.benchmark_results: List[Dict[str, Any]] = []

    def load_monthly_series(self) -> pd.DataFrame:
        """Loads and aggregates expense records into monthly totals per category."""
        if not self.data_path.exists():
            clean_path = Path("data/processed/cleaned_indian_expenses.csv")
            raw_path = Path("data/raw/indian_small_business_expenses_5000.csv")
            self.data_path = clean_path if clean_path.exists() else raw_path

        df = pd.read_csv(self.data_path)
        df["dt"] = pd.to_datetime(df["date"])
        df["month"] = df["dt"].dt.to_period("M").dt.to_timestamp()
        monthly = df.groupby(["month", "category"])["amount"].sum().unstack(fill_value=0.0)
        # Ensure standard sorted frequency
        monthly.index.freq = "MS"
        return monthly

    def evaluate_and_train(self, holdout_months: int = 5) -> Dict[str, Any]:
        """
        Runs the full comparative benchmark across all 8 categories:
        - Train set: first 19 months (Jan 2024 to Jul 2025)
        - Test set : final 5 months (Aug 2025 to Dec 2025)
        """
        monthly_df = self.load_monthly_series()
        total_months = len(monthly_df)
        train_len = total_months - holdout_months

        train_df = monthly_df.iloc[:train_len]
        test_df = monthly_df.iloc[train_len:]

        print("=" * 85)
        print(" SWADESHI KHATA (स्वदेशी खाता) - CATEGORY SPEND FORECASTING ENGINE BENCHMARK")
        print("=" * 85)
        print(f"Total History     : {total_months} months ({monthly_df.index[0].strftime('%b %Y')} to {monthly_df.index[-1].strftime('%b %Y')})")
        print(f"Training Window   : {train_len} months ({train_df.index[0].strftime('%b %Y')} to {train_df.index[-1].strftime('%b %Y')})")
        print(f"Holdout Test Window: {holdout_months} months ({test_df.index[0].strftime('%b %Y')} to {test_df.index[-1].strftime('%b %Y')})")
        print("-" * 85)

        predictions_dict: Dict[str, Dict[str, np.ndarray]] = {}
        self.benchmark_results = []

        for category in monthly_df.columns:
            y_train = train_df[category]
            y_test = test_df[category]
            test_vals = y_test.values

            # 1. Moving Average Baseline
            ma_model = MovingAverageForecaster(window=3).fit(y_train)
            ma_preds = ma_model.predict(steps=holdout_months)
            ma_mae = float(mean_absolute_error(test_vals, ma_preds))
            ma_mape = float(np.mean(np.abs((test_vals - ma_preds) / np.clip(test_vals, 1.0, None))) * 100)

            # 2. SARIMA
            sarima_model = SARIMAForecaster(order=(1, 1, 0)).fit(y_train)
            sarima_preds = sarima_model.predict(steps=holdout_months)
            sarima_mae = float(mean_absolute_error(test_vals, sarima_preds))
            sarima_mape = float(np.mean(np.abs((test_vals - sarima_preds) / np.clip(test_vals, 1.0, None))) * 100)

            # 3. XGBoost with Lags
            xgb_model = XGBoostLagForecaster(n_estimators=60, max_depth=2, learning_rate=0.08).fit(y_train)
            xgb_preds = xgb_model.predict(steps=holdout_months)
            xgb_mae = float(mean_absolute_error(test_vals, xgb_preds))
            xgb_mape = float(np.mean(np.abs((test_vals - xgb_preds) / np.clip(test_vals, 1.0, None))) * 100)

            predictions_dict[category] = {
                "Moving Average": ma_preds,
                "SARIMA": sarima_preds,
                "XGBoost": xgb_preds,
            }

            # Select Winner per category based on holdout MAE
            candidates = {
                "Moving Average": (ma_mae, ma_mape, MovingAverageForecaster(window=3)),
                "SARIMA": (sarima_mae, sarima_mape, SARIMAForecaster(order=(1, 1, 0))),
                "XGBoost": (xgb_mae, xgb_mape, XGBoostLagForecaster(n_estimators=60, max_depth=2, learning_rate=0.08)),
            }
            winner_name = min(candidates.keys(), key=lambda k: candidates[k][0])
            best_mae, best_mape, best_inst = candidates[winner_name]

            # Retrain winner on 100% of available historical data for production
            best_inst.fit(monthly_df[category])
            self.best_models[category] = {
                "model_name": winner_name,
                "model_instance": best_inst,
                "mae": best_mae,
                "mape": best_mape,
            }

            # Save model artifact to disk
            model_save_path = FORECAST_MODELS_DIR / f"best_model_{category}.joblib"
            save_model_bundle(best_inst, model_save_path)

            self.benchmark_results.append({
                "category": category,
                "ma_mae": round(ma_mae, 2),
                "ma_mape": round(ma_mape, 2),
                "sarima_mae": round(sarima_mae, 2),
                "sarima_mape": round(sarima_mape, 2),
                "xgb_mae": round(xgb_mae, 2),
                "xgb_mape": round(xgb_mape, 2),
                "winner": winner_name,
                "winner_mae": round(best_mae, 2),
                "winner_mape": round(best_mape, 2),
                "saved_path": str(model_save_path),
            })

        # Generate Multi-Panel Forecast Plot
        plot_path = Path("data/models/forecast_vs_actual.png")
        self._plot_forecast_vs_actual(monthly_df, train_len, predictions_dict, plot_path)

        # Export Benchmark JSON
        benchmark_json_path = FORECAST_MODELS_DIR / "forecast_benchmark.json"
        with open(benchmark_json_path, "w", encoding="utf-8") as f:
            json.dump(self.benchmark_results, f, indent=2)

        # Print Formatted Comparison Table
        print("\n" + "=" * 95)
        print(f"{'Category':<12} | {'MA MAE (Rs)':<12} | {'SARIMA MAE (Rs)':<15} | {'XGB MAE (Rs)':<12} | {'Winner':<14} | {'Winner MAPE':<11}")
        print("=" * 95)
        for r in self.benchmark_results:
            print(
                f"{r['category']:<12} | Rs.{r['ma_mae']:<9,.0f} | Rs.{r['sarima_mae']:<12,.0f} | "
                f"Rs.{r['xgb_mae']:<9,.0f} | {r['winner']:<14} | {r['winner_mape']:<9.1f}%"
            )
        print("=" * 95)
        print(f" -> Best models saved to: {FORECAST_MODELS_DIR}")
        print(f" -> Comparison plot saved to: {plot_path}")
        print(f" -> Metrics JSON exported to: {benchmark_json_path}\n")

        return {
            "results": self.benchmark_results,
            "plot_path": str(plot_path),
            "benchmark_path": str(benchmark_json_path),
        }

    def _plot_forecast_vs_actual(
        self,
        monthly_df: pd.DataFrame,
        train_len: int,
        predictions: Dict[str, Dict[str, np.ndarray]],
        output_path: Path,
    ):
        """Generates an 8-panel high-resolution comparison chart."""
        dates = monthly_df.index
        test_dates = dates[train_len:]

        fig, axes = plt.subplots(4, 2, figsize=(16, 18), dpi=300)
        axes = axes.flatten()

        for idx, category in enumerate(monthly_df.columns):
            ax = axes[idx]
            actual = monthly_df[category]
            cat_preds = predictions[category]

            # Actual historical line
            ax.plot(dates, actual, color="#2c3e50", lw=2.0, marker="o", markersize=4, label="Actual Spend")

            # Shade test region
            ax.axvspan(test_dates[0], test_dates[-1], color="#f4f6f7", alpha=0.8, label="Test Window")

            # Model forecast lines on test window
            ax.plot(
                test_dates,
                cat_preds["Moving Average"],
                color="#e74c3c",
                lw=1.8,
                linestyle=":",
                marker="^",
                label="Moving Avg (W=3)",
            )
            ax.plot(
                test_dates,
                cat_preds["SARIMA"],
                color="#2980b9",
                lw=2.0,
                linestyle="--",
                marker="s",
                label="SARIMA(1,1,0)",
            )
            ax.plot(
                test_dates,
                cat_preds["XGBoost"],
                color="#27ae60",
                lw=2.2,
                linestyle="-.",
                marker="D",
                label="XGBoost (Lags)",
            )

            winner = self.best_models[category]["model_name"]
            winner_mape = self.best_models[category]["mape"]
            ax.set_title(
                f"{category.upper()} (Winner: {winner} | MAPE: {winner_mape:.1f}%)",
                fontsize=11,
                fontweight="bold",
                pad=8,
            )
            ax.set_ylabel("Monthly Spend (₹)", fontsize=10)
            ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, loc: f"₹{int(x):,}"))
            ax.grid(True, linestyle="--", alpha=0.4)
            ax.tick_params(axis="x", rotation=30)
            if idx == 0:
                ax.legend(loc="upper left", fontsize=9, frameon=True)

        fig.suptitle(
            "Swadeshi Khata (स्वदेशी खाता): Spend Forecast vs Actual per Category (24-Month Holdout Comparison)",
            fontsize=15,
            fontweight="bold",
            y=0.995,
        )
        fig.tight_layout()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path)
        plt.close(fig)

    def forecast_next_month(self) -> Dict[str, Any]:
        """
        Loads the saved winning model for each category and predicts next month's spend.
        """
        monthly_df = self.load_monthly_series()
        last_date = monthly_df.index[-1]
        next_month_dt = last_date + pd.DateOffset(months=1)
        next_month_label = next_month_dt.strftime("%B %Y")

        projections = {}
        total_forecast = 0.0

        for category in monthly_df.columns:
            model_path = FORECAST_MODELS_DIR / f"best_model_{category}.joblib"
            if model_path.exists():
                try:
                    model = load_model_bundle(model_path)
                except Exception:
                    model = MovingAverageForecaster(window=3).fit(monthly_df[category])
            else:
                # If not yet serialized, train winner on the fly
                model = MovingAverageForecaster(window=3).fit(monthly_df[category])

            pred_val = float(model.predict(steps=1)[0])
            projections[category] = round(pred_val, 2)
            total_forecast += pred_val

        return {
            "forecast_month": next_month_label,
            "forecast_date": next_month_dt.strftime("%Y-%m-%d"),
            "category_projections": projections,
            "total_projected_spend": round(total_forecast, 2),
        }


if __name__ == "__main__":
    forecaster = CategorySpendForecaster()
    forecaster.evaluate_and_train(holdout_months=5)
    next_m = forecaster.forecast_next_month()
    print("=" * 60)
    print(f" NEXT MONTH FORECAST ({next_m['forecast_month']}):")
    print("=" * 60)
    for cat, val in next_m["category_projections"].items():
        print(f" - {cat:<12}: Rs.{val:>12,.2f}")
    print("-" * 60)
    print(f" TOTAL PROJECTED SPEND: Rs.{next_m['total_projected_spend']:>12,.2f}")
    print("=" * 60)
