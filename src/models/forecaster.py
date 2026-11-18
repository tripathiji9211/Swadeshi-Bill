"""
Autoregressive Spending Forecaster using Ridge Regression
"""

from typing import List
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

from src.config import EXPENSES_DB_PATH
from src.parsing.schemas import ForecastResponse, ForecastDataPoint


class SpendingForecaster:
    def forecast_next_30_days(self, horizon_days: int = 30) -> ForecastResponse:
        if not EXPENSES_DB_PATH.exists():
            from src.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        raw_df = pd.read_csv(EXPENSES_DB_PATH)
        raw_df["dt"] = pd.to_datetime(raw_df["date"]).dt.floor("D")
        daily_df = raw_df.groupby("dt")["amount"].sum().reset_index()
        daily_df = daily_df.set_index("dt").asfreq("D", fill_value=0.0).reset_index()
        daily_df = daily_df.rename(columns={"dt": "date", "amount": "daily_spend"})

        # Features
        df = daily_df.copy()
        df["dow"] = df["date"].dt.dayofweek
        df["dom"] = df["date"].dt.day
        df["is_wknd"] = df["dow"].isin([5, 6]).astype(float)
        df["lag_1"] = df["daily_spend"].shift(1)
        df["lag_7"] = df["daily_spend"].shift(7)
        df["lag_14"] = df["daily_spend"].shift(14)
        df["rolling_7"] = df["daily_spend"].shift(1).rolling(7, min_periods=1).mean()
        df["rolling_30"] = df["daily_spend"].shift(1).rolling(30, min_periods=1).mean()

        featured = df.dropna().reset_index(drop=True)
        feature_cols = ["dow", "dom", "is_wknd", "lag_1", "lag_7", "lag_14", "rolling_7", "rolling_30"]
        X = featured[feature_cols].values
        y = featured["daily_spend"].values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = Ridge(alpha=10.0)
        model.fit(X_scaled, y)
        res_std = float(np.std(y - model.predict(X_scaled)))

        # Autoregressive forward walk
        history = list(daily_df["daily_spend"].values)
        last_date = daily_df["date"].max()
        projections: List[ForecastDataPoint] = []

        for step in range(1, horizon_days + 1):
            next_date = last_date + timedelta(days=step)
            dow = next_date.dayofweek
            dom = next_date.day
            is_wknd = 1.0 if dow in (5, 6) else 0.0

            l1 = history[-1]
            l7 = history[-7] if len(history) >= 7 else l1
            l14 = history[-14] if len(history) >= 14 else l1
            r7 = float(np.mean(history[-7:]))
            r30 = float(np.mean(history[-30:]))

            vec = scaler.transform([[dow, dom, is_wknd, l1, l7, l14, r7, r30]])
            pred_amt = max(10.0, float(model.predict(vec)[0]))
            low = max(0.0, pred_amt - 1.645 * res_std)
            high = pred_amt + 1.645 * res_std

            projections.append(ForecastDataPoint(
                date=next_date.strftime("%Y-%m-%d"),
                predicted_amount=round(pred_amt, 2),
                lower_bound=round(low, 2),
                upper_bound=round(high, 2),
            ))
            history.append(pred_amt)

        recent_avg = daily_df["daily_spend"].tail(30).mean()
        pred_avg = float(np.mean([p.predicted_amount for p in projections]))
        growth = ((pred_avg - recent_avg) / recent_avg) * 100.0 if recent_avg > 0 else 0.0

        trend = "Increasing" if growth > 3.0 else ("Decreasing" if growth < -3.0 else "Stable")

        return ForecastResponse(
            horizon_days=horizon_days,
            historical_daily_avg=round(float(recent_avg), 2),
            forecast_total_spend=round(float(sum(p.predicted_amount for p in projections)), 2),
            trend_direction=trend,
            trend_percentage=round(growth, 1),
            daily_projections=projections,
        )
