"""
ReceiptRadar - Spending Forecasting Engine
Leverages time-series feature engineering and Scikit-learn Ridge Regression
to predict future 30-day cash burn, confidence intervals, and trend trajectory.
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from backend.app.config import EXPENSES_DB_PATH
from backend.app.models.schemas import ForecastResponse, ForecastDataPoint


class SpendingForecaster:
    """
    Time-Series Expense Forecaster.
    Aggregates daily spending history, builds autoregressive lag features,
    and projects the next 30 days with confidence intervals.
    """

    def __init__(self):
        pass

    def _prepare_daily_timeseries(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transforms raw transactions into a regular daily aggregated time-series."""
        df["dt"] = pd.to_datetime(df["date"]).dt.floor("D")
        daily = df.groupby("dt")["amount"].sum().reset_index()

        # Reindex to ensure every consecutive day is represented (fill missing days with 0)
        daily = daily.set_index("dt").asfreq("D", fill_value=0.0).reset_index()
        daily = daily.rename(columns={"dt": "date", "amount": "daily_spend"})
        return daily

    def _create_features(self, series_df: pd.DataFrame) -> pd.DataFrame:
        """
        Engineers temporal and autoregressive features:
        - Lag 1, 7, 14, 30 days
        - Rolling 7-day and 30-day moving averages
        - Day of week and day of month indicators
        """
        df = series_df.copy()
        df["day_of_week"] = df["date"].dt.dayofweek
        df["day_of_month"] = df["date"].dt.day
        df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(float)

        # Lags
        df["lag_1"] = df["daily_spend"].shift(1)
        df["lag_7"] = df["daily_spend"].shift(7)
        df["lag_14"] = df["daily_spend"].shift(14)

        # Rolling statistics
        df["rolling_7"] = df["daily_spend"].shift(1).rolling(window=7, min_periods=1).mean()
        df["rolling_30"] = df["daily_spend"].shift(1).rolling(window=30, min_periods=1).mean()

        return df

    def forecast_next_30_days(self, horizon_days: int = 30) -> ForecastResponse:
        """
        Trains model on historical daily spend and executes an autoregressive
        forward walk to forecast future daily cash outflows.
        """
        if not EXPENSES_DB_PATH.exists():
            from backend.app.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        raw_df = pd.read_csv(EXPENSES_DB_PATH)
        daily_df = self._prepare_daily_timeseries(raw_df)

        if len(daily_df) < 35:
            # Fallback if history is too brief
            avg_daily = float(daily_df["daily_spend"].mean()) if not daily_df.empty else 250.0
            last_date = daily_df["date"].max() if not daily_df.empty else datetime.now()
            projections = []
            for i in range(1, horizon_days + 1):
                f_date = (last_date + timedelta(days=i)).strftime("%Y-%m-%d")
                projections.append(ForecastDataPoint(
                    date=f_date,
                    predicted_amount=round(avg_daily, 2),
                    lower_bound=round(max(0.0, avg_daily * 0.8), 2),
                    upper_bound=round(avg_daily * 1.2, 2),
                ))
            return ForecastResponse(
                horizon_days=horizon_days,
                historical_daily_avg=round(avg_daily, 2),
                forecast_total_spend=round(avg_daily * horizon_days, 2),
                trend_direction="Stable",
                trend_percentage=0.0,
                daily_projections=projections,
            )

        # Build feature dataset
        featured = self._create_features(daily_df).dropna().reset_index(drop=True)

        feature_cols = [
            "day_of_week",
            "day_of_month",
            "is_weekend",
            "lag_1",
            "lag_7",
            "lag_14",
            "rolling_7",
            "rolling_30",
        ]

        X = featured[feature_cols].values
        y = featured["daily_spend"].values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Fit robust Ridge regressor with L2 regularization
        model = Ridge(alpha=10.0)
        model.fit(X_scaled, y)

        # Estimate residual variance for prediction intervals
        residuals = y - model.predict(X_scaled)
        residual_std = float(np.std(residuals))

        # Iterative multi-step autoregressive rollout
        current_history = list(daily_df["daily_spend"].values)
        last_date = daily_df["date"].max()

        projections: List[ForecastDataPoint] = []
        for step in range(1, horizon_days + 1):
            next_date = last_date + timedelta(days=step)
            dow = next_date.dayofweek
            dom = next_date.day
            is_wknd = 1.0 if dow in (5, 6) else 0.0

            l_1 = current_history[-1]
            l_7 = current_history[-7] if len(current_history) >= 7 else l_1
            l_14 = current_history[-14] if len(current_history) >= 14 else l_1

            r_7 = float(np.mean(current_history[-7:]))
            r_30 = float(np.mean(current_history[-30:]))

            feat_vec = np.array([[dow, dom, is_wknd, l_1, l_7, l_14, r_7, r_30]])
            feat_scaled = scaler.transform(feat_vec)

            predicted_val = float(model.predict(feat_scaled)[0])
            # Spending cannot be negative
            predicted_val = max(10.0, predicted_val)

            lower_bound = max(0.0, predicted_val - 1.645 * residual_std)
            upper_bound = predicted_val + 1.645 * residual_std

            projections.append(ForecastDataPoint(
                date=next_date.strftime("%Y-%m-%d"),
                predicted_amount=round(predicted_val, 2),
                lower_bound=round(lower_bound, 2),
                upper_bound=round(upper_bound, 2),
            ))

            current_history.append(predicted_val)

        # Calculate analytics
        hist_recent_30 = daily_df["daily_spend"].tail(30).mean()
        forecast_daily_avg = float(np.mean([p.predicted_amount for p in projections]))
        forecast_total = float(sum(p.predicted_amount for p in projections))

        growth_pct = ((forecast_daily_avg - hist_recent_30) / hist_recent_30) * 100.0 if hist_recent_30 > 0 else 0.0

        if growth_pct > 3.0:
            trend = "Increasing"
        elif growth_pct < -3.0:
            trend = "Decreasing"
        else:
            trend = "Stable"

        return ForecastResponse(
            horizon_days=horizon_days,
            historical_daily_avg=round(float(hist_recent_30), 2),
            forecast_total_spend=round(forecast_total, 2),
            trend_direction=trend,
            trend_percentage=round(growth_pct, 1),
            daily_projections=projections,
        )

