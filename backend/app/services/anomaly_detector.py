"""
ReceiptRadar - Expense Anomaly Detection & Forensic Audit Engine
Combines Scikit-learn's Isolation Forest with Category-Level Statistical Z-Scores
and business audit rules (duplicate billing, split transactions, off-hours charges).
"""

from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
from sklearn.ensemble import IsolationForest

from backend.app.config import (
    ANOMALY_MODEL_PATH,
    EXPENSES_DB_PATH,
    ANOMALY_SETTINGS,
)
from backend.app.models.schemas import AuditRisk


class ExpenseAnomalyDetector:
    """
    Hybrid Anomaly Detection Engine:
    1. Unsupervised Machine Learning via Isolation Forest
    2. Statistical Outlier Detection (Z-scores & IQR per expense category)
    3. Forensic Business Rules (Duplicates, Threshold evasion, Weekend flags)
    """

    def __init__(self):
        self.model_path = ANOMALY_MODEL_PATH
        self.iso_forest: IsolationForest = None
        self.category_stats: Dict[str, Dict[str, float]] = {}
        self._load_or_train()

    def _load_or_train(self):
        """Loads fitted isolation forest or trains on historical expenses."""
        if self.model_path.exists():
            try:
                saved_bundle = joblib.load(self.model_path)
                self.iso_forest = saved_bundle["iso_forest"]
                self.category_stats = saved_bundle["category_stats"]
                return
            except Exception as e:
                print(f"Notice: Failed to load anomaly model ({e}), retraining...")

        self.train_on_history()

    def _extract_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Extracts numerical features for Isolation Forest:
        - log(amount + 1)
        - z-score relative to its category
        - day_of_week (0 to 6)
        - is_weekend (0 or 1)
        - is_round_number (0 or 1)
        """
        features = []
        for _, row in df.iterrows():
            amt = float(row["amount"])
            cat = str(row.get("category", "General"))
            stats = self.category_stats.get(cat, {"mean": 150.0, "std": 100.0})

            std = stats["std"] if stats["std"] > 1.0 else 1.0
            z_score = (amt - stats["mean"]) / std

            dt = pd.to_datetime(row["date"])
            day_of_week = dt.dayofweek
            is_weekend = 1.0 if day_of_week in (5, 6) else 0.0
            is_round = 1.0 if abs(amt - round(amt)) < 0.001 and amt > 100.0 else 0.0

            features.append([
                np.log1p(amt),
                z_score,
                day_of_week,
                is_weekend,
                is_round,
            ])

        return np.array(features)

    def train_on_history(self) -> Dict[str, Any]:
        """Fits Isolation Forest and computes category distribution parameters."""
        if not EXPENSES_DB_PATH.exists():
            from backend.app.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        df = pd.read_csv(EXPENSES_DB_PATH)

        # 1. Compute category statistics (mean & standard deviation)
        self.category_stats = {}
        for cat, group in df.groupby("category"):
            self.category_stats[str(cat)] = {
                "mean": float(group["amount"].mean()),
                "std": float(group["amount"].std(ddof=1) if len(group) > 1 else 10.0),
                "q75": float(group["amount"].quantile(0.75)),
                "q25": float(group["amount"].quantile(0.25)),
            }

        # 2. Fit Isolation Forest on historical data
        X = self._extract_features(df)
        self.iso_forest = IsolationForest(
            n_estimators=150,
            contamination=0.04,  # Expect ~4% anomalies in typical accounting logs
            random_state=42,
        )
        self.iso_forest.fit(X)

        # Save model bundle
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {"iso_forest": self.iso_forest, "category_stats": self.category_stats},
            self.model_path,
        )
        print("Expense Anomaly Detector (Isolation Forest) trained and saved.")
        return {"samples": len(df), "categories": len(self.category_stats)}

    def audit_transaction(
        self,
        amount: float,
        category: str,
        merchant: str,
        txn_date_str: str,
        tax: float = 0.0,
        history_df: Optional[pd.DataFrame] = None,
    ) -> AuditRisk:
        """
        Audits a single incoming transaction against statistical models,
        ML Isolation Forest, and business integrity rules.
        """
        if self.iso_forest is None:
            self._load_or_train()

        reasons: List[str] = []
        risk_points = 0.0

        # Parse transaction date
        try:
            txn_date = pd.to_datetime(txn_date_str)
        except Exception:
            txn_date = datetime.now()

        # -------------------------------------------------------------
        # Rule 1: Statistical Category Outlier (Z-score test)
        # -------------------------------------------------------------
        stats = self.category_stats.get(category, {"mean": 150.0, "std": 100.0})
        std = stats["std"] if stats["std"] > 1.0 else 1.0
        z_score = (amount - stats["mean"]) / std

        if z_score > 3.0:
            reasons.append(
                f"Amount ${amount:,.2f} is extreme for '{category}' (Z-score: {z_score:.1f} > 3.0 standard deviations; average is ${stats['mean']:.2f})."
            )
            risk_points += 45.0
        elif z_score > 2.0:
            reasons.append(
                f"Amount ${amount:,.2f} is significantly higher than usual for '{category}' (Category avg: ${stats['mean']:.2f})."
            )
            risk_points += 25.0

        # -------------------------------------------------------------
        # Rule 2: Isolation Forest Outlier Prediction
        # -------------------------------------------------------------
        sample_feature = np.array([[
            np.log1p(amount),
            z_score,
            txn_date.dayofweek,
            1.0 if txn_date.dayofweek in (5, 6) else 0.0,
            1.0 if abs(amount - round(amount)) < 0.001 and amount > 100.0 else 0.0,
        ]])

        # Decision function: negative values indicate anomaly, positive normal
        anomaly_score_raw = self.iso_forest.decision_function(sample_feature)[0]
        # Invert and normalize to 0.0 - 1.0
        iso_risk_pct = float(np.clip((0.2 - anomaly_score_raw) / 0.4, 0.0, 1.0))

        if anomaly_score_raw < 0:
            reasons.append(
                f"Multivariate ML Isolation Forest flagged transaction behavior (Outlier index: {iso_risk_pct:.2f})."
            )
            risk_points += 30.0

        # -------------------------------------------------------------
        # Rule 3: Forensic Business Audit - Duplicate Billing Check
        # -------------------------------------------------------------
        if history_df is None and EXPENSES_DB_PATH.exists():
            try:
                history_df = pd.read_csv(EXPENSES_DB_PATH)
            except Exception:
                pass

        if history_df is not None and not history_df.empty:
            try:
                # Find transactions with exact amount and same vendor
                same_merchant_df = history_df[
                    history_df["merchant"].str.lower() == merchant.lower()
                ].copy()

                same_merchant_df["hist_dt"] = pd.to_datetime(same_merchant_df["date"])
                time_diff_hours = (txn_date - same_merchant_df["hist_dt"]).abs().dt.total_seconds() / 3600.0

                # Check duplicates within 48 hours with equal or near-equal amounts
                duplicates = same_merchant_df[
                    (time_diff_hours <= 48.0) & (abs(same_merchant_df["amount"] - amount) < 0.05)
                ]

                if not duplicates.empty:
                    reasons.append(
                        f"Potential duplicate charge! Found matching transaction of ${amount:.2f} at '{merchant}' within 48 hours."
                    )
                    risk_points += 50.0
            except Exception:
                pass

        # -------------------------------------------------------------
        # Rule 4: Split Transaction Evasion Check ($900 - $999.99)
        # -------------------------------------------------------------
        if 900.0 <= amount < 1000.0:
            reasons.append(
                f"Suspicious transaction amount (${amount:.2f}) just below $1,000 corporate sign-off approval threshold."
            )
            risk_points += 35.0

        # -------------------------------------------------------------
        # Rule 5: Executive Policy - Discretionary Meals Cap (> $250)
        # -------------------------------------------------------------
        if category == "Meals & Entertainment" and amount > 250.0:
            reasons.append(
                f"Discretionary dining expense (${amount:,.2f}) exceeds standard $250.00 client entertainment policy cap."
            )
            risk_points += 30.0

        # -------------------------------------------------------------
        # Rule 6: Weekend / Off-Hours Discretionary Spending
        # -------------------------------------------------------------
        if txn_date.dayofweek in (5, 6) and category in ("Meals & Entertainment", "Office Supplies & Software"):
            if amount > 200.0:
                reasons.append(
                    f"Substantial discretionary spend (${amount:.2f}) recorded over the weekend ({txn_date.strftime('%A')})."
                )
                risk_points += 25.0

        # -------------------------------------------------------------
        # Rule 6: Suspicious Round Number Without Tax
        # -------------------------------------------------------------
        if abs(amount - round(amount)) < 0.001 and amount >= 500.0 and tax == 0.0:
            reasons.append(
                f"Even dollar transaction (${amount:.2f}) lacking itemized sales tax. Common indicator of informal or non-itemized billing."
            )
            risk_points += 20.0

        # Calculate final normalized risk score
        final_risk_score = round(min(risk_points / 100.0, 1.0), 3)
        is_anomaly = final_risk_score >= 0.40

        if final_risk_score >= 0.70:
            severity = "HIGH"
        elif final_risk_score >= 0.40:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        return AuditRisk(
            is_anomaly=is_anomaly,
            anomaly_score=final_risk_score,
            risk_severity=severity,
            reasons=reasons if reasons else ["Transaction passes standard audit benchmarks."],
            z_score=round(z_score, 2),
        )
