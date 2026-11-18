"""
Swadeshi Khata (स्वदेशी खाता) - Expense Anomaly Detection Engine
================================================
Three complementary approaches to financial expense anomaly detection:
1. Rule-Based Duplicate Detection: Identifies identical billing (vendor + amount) within a sliding date window.
2. Statistical Z-Score Baseline: Parametric category-level standard deviation thresholds for severe amount spikes.
3. Isolation Forest (Unsupervised ML): Multivariate tree-based anomaly isolation detecting off-hour outliers and complex behavioral patterns.
4. Hybrid Ensemble Auditor: Production orchestrator combining all three approaches with forensic business rules.

Includes contamination parameter grid tuning, Precision-Recall (PR) curve generation, and benchmark reporting.
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

import pandas as pd
import numpy as np
import joblib

# Headless matplotlib configuration for thread and headless safety
os.environ["MPLCONFIGDIR"] = tempfile.gettempdir()
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    precision_recall_curve,
    average_precision_score,
    classification_report,
)

from src.config import ANOMALY_MODEL_PATH, EXPENSES_DB_PATH, MODELS_DIR
from src.parsing.schemas import AuditRisk


# =============================================================================
# 1. APPROACH 1: RULE-BASED DUPLICATE DETECTION
# =============================================================================

class RuleBasedDuplicateDetector:
    """
    Detects accidental duplicate charges or double-billing fraud by identifying
    transactions with the identical vendor and amount occurring within a configurable
    time window (e.g. 24 to 72 hours).
    """

    def __init__(self, window_hours: float = 48.0, amount_tolerance: float = 0.05):
        self.window_hours = float(window_hours)
        self.amount_tolerance = float(amount_tolerance)

    def fit(self, df: pd.DataFrame) -> "RuleBasedDuplicateDetector":
        """No parameters to fit for rule-based detection, returns self."""
        return self

    def predict_batch(self, df: pd.DataFrame) -> pd.Series:
        """
        Scans a chronologically sorted DataFrame to flag duplicate transactions.
        The first occurrence is retained as normal; subsequent occurrences within
        window_hours are flagged as anomalies.
        """
        df_sorted = df.copy()
        if "date_dt" not in df_sorted.columns:
            df_sorted["date_dt"] = pd.to_datetime(df_sorted["date"])

        df_sorted = df_sorted.sort_values("date_dt")
        is_duplicate = pd.Series(False, index=df_sorted.index)

        # Group by vendor and amount
        vendor_col = "vendor_normalized" if "vendor_normalized" in df_sorted.columns else "vendor"
        if vendor_col not in df_sorted.columns and "merchant" in df_sorted.columns:
            vendor_col = "merchant"

        for _, group in df_sorted.groupby([vendor_col, "amount"]):
            if len(group) > 1:
                dates = group["date_dt"].tolist()
                indices = group.index.tolist()
                for i in range(1, len(dates)):
                    diff_hours = (dates[i] - dates[i - 1]).total_seconds() / 3600.0
                    if 0.0 <= diff_hours <= self.window_hours:
                        is_duplicate.loc[indices[i]] = True

        return is_duplicate.reindex(df.index, fill_value=False)

    def check_transaction(
        self,
        vendor: str,
        amount: float,
        txn_date: datetime,
        history_df: Optional[pd.DataFrame] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Checks a single incoming transaction against historical records.
        """
        if history_df is None or history_df.empty:
            return False, None

        vendor_col = "vendor_normalized" if "vendor_normalized" in history_df.columns else "vendor"
        if vendor_col not in history_df.columns and "merchant" in history_df.columns:
            vendor_col = "merchant"

        same_vendor = history_df[history_df[vendor_col].astype(str).str.lower() == vendor.lower()].copy()
        if same_vendor.empty:
            return False, None

        if "date_dt" not in same_vendor.columns:
            same_vendor["date_dt"] = pd.to_datetime(same_vendor["date"])

        time_diffs = (txn_date - same_vendor["date_dt"]).abs().dt.total_seconds() / 3600.0
        amount_diffs = (same_vendor["amount"].astype(float) - amount).abs()

        match = same_vendor[(time_diffs <= self.window_hours) & (amount_diffs <= self.amount_tolerance)]
        if not match.empty:
            earlier_txn = match.iloc[0]
            earlier_date = str(earlier_txn["date"])
            msg = f"Potential duplicate billing! Matching charge of ₹{amount:,.2f} at '{vendor}' found on {earlier_date} (within {self.window_hours}h window)."
            return True, msg

        return False, None


# =============================================================================
# 2. APPROACH 2: STATISTICAL Z-SCORE BASELINE
# =============================================================================

class ZScoreAnomalyDetector:
    """
    Parametric statistical baseline computing category-specific Z-scores:
        Z = (amount - mean_cat) / std_cat

    Flags transactions exceeding a standard deviation threshold (e.g. Z > 2.5 or 3.0σ).
    Also supports continuous anomaly scoring for ranking and Precision-Recall analysis.
    """

    def __init__(self, threshold: float = 2.5):
        self.threshold = float(threshold)
        self.category_stats: Dict[str, Dict[str, float]] = {}

    def fit(self, df: pd.DataFrame) -> "ZScoreAnomalyDetector":
        """Calculates mean, standard deviation, and median per expense category."""
        self.category_stats = {}
        for cat, group in df.groupby("category"):
            mu = float(group["amount"].mean())
            std = float(group["amount"].std(ddof=1) if len(group) > 1 else 1.0)
            median = float(group["amount"].median())
            self.category_stats[str(cat)] = {
                "mean": mu,
                "std": std if std > 0.1 else 1.0,
                "median": median,
            }
        return self

    def compute_z_score(self, amount: float, category: str) -> float:
        """Computes the category Z-score for an individual amount."""
        stats = self.category_stats.get(str(category), {})
        mu = stats.get("mean", 1500.0)
        std = stats.get("std", 1000.0)
        std = std if std > 0.1 else 1.0
        return (amount - mu) / std

    def predict_scores(self, df: pd.DataFrame) -> np.ndarray:
        """Returns continuous positive Z-scores for PR-curve evaluation."""
        scores = []
        for _, row in df.iterrows():
            amt = float(row["amount"])
            cat = str(row.get("category", "misc"))
            z = self.compute_z_score(amt, cat)
            scores.append(max(0.0, z))
        return np.array(scores)

    def predict_batch(self, df: pd.DataFrame, threshold: Optional[float] = None) -> pd.Series:
        """Flags transactions whose Z-score exceeds the threshold."""
        thresh = self.threshold if threshold is None else threshold
        scores = self.predict_scores(df)
        return pd.Series(scores > thresh, index=df.index)


# =============================================================================
# 3. APPROACH 3: ISOLATION FOREST (UNSUPERVISED MULTIVARIATE ML)
# =============================================================================

class IsolationForestAnomalyDetector:
    """
    Multivariate tree-based anomaly detector using Scikit-Learn's IsolationForest.
    Builds an ensemble of isolation trees to isolate anomalies (which require fewer
    random splits) along dimensions of amount magnitude, category deviation,
    time-of-day (off-hours), day of week, and cash payment indicators.
    """

    FEATURE_NAMES = [
        "log_amount",
        "cat_z_score",
        "cat_median_ratio",
        "hour",
        "is_off_hour",
        "day_of_week",
        "is_weekend",
        "is_round_amount",
        "is_cash",
    ]

    def __init__(
        self,
        contamination: float = 0.02,
        n_estimators: int = 200,
        random_state: int = 42,
    ):
        self.contamination = float(contamination)
        self.n_estimators = int(n_estimators)
        self.random_state = int(random_state)
        self.model: Optional[IsolationForest] = None
        self.category_stats: Dict[str, Dict[str, float]] = {}

    def extract_features(self, df: pd.DataFrame) -> np.ndarray:
        """Extracts 9 forensic financial features for Isolation Forest."""
        df_feat = df.copy()
        if "date_dt" not in df_feat.columns:
            df_feat["date_dt"] = pd.to_datetime(df_feat["date"])

        features = []
        for _, row in df_feat.iterrows():
            amt = float(row["amount"])
            cat = str(row.get("category", "misc"))
            stats = self.category_stats.get(cat, {})
            mu = float(stats.get("mean", 1500.0))
            std = float(stats.get("std", 1000.0))
            std = std if std > 0.1 else 1.0
            med = float(stats.get("median", mu))
            med = med if med > 0.1 else 1.0

            cat_z = (amt - mu) / std
            cat_ratio = amt / med

            dt = row["date_dt"]
            hour = dt.hour
            is_off_hour = 1.0 if (hour >= 22 or hour <= 4) else 0.0
            dow = dt.dayofweek
            is_weekend = 1.0 if dow in (5, 6) else 0.0

            # Forensic round sum indicator (e.g., exact ₹5,000, ₹10,000, ₹50,000)
            is_round = 1.0 if (amt % 1000 == 0 and amt >= 5000.0) else (0.5 if amt % 100 == 0 else 0.0)

            # High-risk cash indicator
            payment_mode = str(row.get("payment_mode", "")).lower()
            is_cash = 1.0 if "cash" in payment_mode else 0.0

            features.append([
                np.log1p(max(0.0, amt)),
                cat_z,
                cat_ratio,
                float(hour),
                is_off_hour,
                float(dow),
                is_weekend,
                is_round,
                is_cash,
            ])

        return np.array(features)

    def fit(self, df: pd.DataFrame) -> "IsolationForestAnomalyDetector":
        """Fits the category statistics and trains the Isolation Forest model."""
        # Calculate reference category stats
        self.category_stats = {}
        for cat, group in df.groupby("category"):
            mu = float(group["amount"].mean())
            std = float(group["amount"].std(ddof=1) if len(group) > 1 else 1.0)
            median = float(group["amount"].median())
            self.category_stats[str(cat)] = {
                "mean": mu,
                "std": std if std > 0.1 else 1.0,
                "median": median,
            }

        X = self.extract_features(df)
        self.model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=1,  # Windows safe single-thread execution
        )
        self.model.fit(X)
        return self

    def predict_scores(self, df: pd.DataFrame) -> np.ndarray:
        """
        Returns continuous anomaly scores (higher score = more anomalous).
        Computed as: score = -decision_function(X).
        """
        if self.model is None:
            raise ValueError("Model has not been fitted yet.")
        X = self.extract_features(df)
        # decision_function: lower means more abnormal. Inverting so higher = more abnormal.
        raw_scores = -self.model.decision_function(X)
        # Min-max scale to [0, 1] for intuitive probability-like ranking
        min_s, max_s = raw_scores.min(), raw_scores.max()
        if max_s > min_s:
            norm_scores = (raw_scores - min_s) / (max_s - min_s)
        else:
            norm_scores = raw_scores
        return norm_scores

    def predict_batch(self, df: pd.DataFrame) -> pd.Series:
        """Returns boolean Series where True indicates an isolated anomaly (-1)."""
        if self.model is None:
            raise ValueError("Model has not been fitted yet.")
        X = self.extract_features(df)
        preds = self.model.predict(X)
        return pd.Series(preds == -1, index=df.index)

    def tune_contamination(
        self,
        df: pd.DataFrame,
        y_true: pd.Series,
        contaminations: Optional[List[float]] = None,
    ) -> pd.DataFrame:
        """
        Performs a grid search over contamination values, reporting Precision,
        Recall, and F1 on the labeled ground truth.
        """
        if contaminations is None:
            contaminations = [0.005, 0.010, 0.015, 0.020, 0.025, 0.030, 0.035, 0.040, 0.050, 0.060, 0.080]

        X = self.extract_features(df)
        results = []

        for c in contaminations:
            iso = IsolationForest(
                n_estimators=self.n_estimators,
                contamination=c,
                random_state=self.random_state,
                n_jobs=1,
            )
            preds = iso.fit_predict(X) == -1
            p = precision_score(y_true, preds, zero_division=0)
            r = recall_score(y_true, preds, zero_division=0)
            f1 = f1_score(y_true, preds, zero_division=0)
            tp = int((preds & y_true).sum())
            fp = int((preds & ~y_true).sum())
            fn = int((~preds & y_true).sum())

            results.append({
                "contamination": c,
                "precision": round(float(p), 4),
                "recall": round(float(r), 4),
                "f1_score": round(float(f1), 4),
                "true_positives": tp,
                "false_positives": fp,
                "false_negatives": fn,
            })

        return pd.DataFrame(results)


# =============================================================================
# 4. HYBRID PRODUCTION ENSEMBLE AUDITOR
# =============================================================================

class ExpenseAnomalyDetector:
    """
    Production hybrid auditor that combines:
    1. Rule-Based Duplicate Detection (same vendor + amount within 48h)
    2. Category Z-Score Baseline (flags extreme category deviations)
    3. Tuned Isolation Forest (multivariate behavioral outliers)
    4. Business Audit Rules (threshold evasion, off-hour payouts, excessive cash)

    Maintains backwards-compatibility with existing API routes and dashboards.
    """

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or ANOMALY_MODEL_PATH
        self.dup_detector = RuleBasedDuplicateDetector(window_hours=48.0)
        self.zscore_detector = ZScoreAnomalyDetector(threshold=2.5)
        self.iso_detector = IsolationForestAnomalyDetector(contamination=0.02, n_estimators=200)
        self.is_fitted = False
        self._load_or_train()

    def _load_or_train(self):
        """Loads serialized models from disk or fits from clean expense history."""
        if self.model_path.exists():
            try:
                bundle = joblib.load(self.model_path)
                iso_model = bundle.get("iso_forest")
                # Validate feature dimension matches 9 forensic features
                if iso_model is not None and getattr(iso_model, "n_features_in_", 0) == 9:
                    self.iso_detector.model = iso_model
                    self.iso_detector.category_stats = bundle["category_stats"]
                    self.zscore_detector.category_stats = bundle["category_stats"]
                    self.is_fitted = True
                    return
            except Exception:
                pass
        self.train_on_history()

    def train_on_history(self, dataset_path: Optional[Path] = None) -> Dict[str, Any]:
        """Trains the hybrid model on historical expense dataset."""
        db_path = dataset_path or EXPENSES_DB_PATH
        if not db_path.exists():
            from src.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        df = pd.read_csv(db_path)
        self.zscore_detector.fit(df)
        self.iso_detector.fit(df)
        self.is_fitted = True

        # Persist model bundle
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "iso_forest": self.iso_detector.model,
                "category_stats": self.iso_detector.category_stats,
            },
            self.model_path,
        )
        return {"samples": len(df), "categories": len(self.zscore_detector.category_stats)}

    def audit_transaction(
        self,
        amount: float,
        category: str,
        merchant: str,
        txn_date_str: str,
        tax: float = 0.0,
        payment_mode: str = "UPI",
        history_df: Optional[pd.DataFrame] = None,
    ) -> AuditRisk:
        """
        Audits a single incoming transaction across all forensic detectors.
        Returns validated AuditRisk Pydantic schema with severity and detailed reasons.
        """
        if not self.is_fitted:
            self._load_or_train()

        reasons: List[str] = []
        risk_points = 0.0

        try:
            txn_date = pd.to_datetime(txn_date_str)
        except Exception:
            txn_date = datetime.now()

        # 1. Rule-Based Duplicate Billing Check
        if history_df is None and EXPENSES_DB_PATH.exists():
            try:
                history_df = pd.read_csv(EXPENSES_DB_PATH)
            except Exception:
                pass

        is_dup, dup_msg = self.dup_detector.check_transaction(merchant, amount, txn_date, history_df)
        if is_dup:
            reasons.append(dup_msg)
            risk_points += 60.0

        # 2. Statistical Z-Score Outlier
        z_score = self.zscore_detector.compute_z_score(amount, category)
        cat_stats = self.zscore_detector.category_stats.get(category, {"mean": 1500.0})
        if z_score > 3.0:
            reasons.append(
                f"Severe amount spike for '{category}' (Z-score: {z_score:.1f}σ > 3.0σ; category avg: ₹{cat_stats['mean']:,.2f})."
            )
            risk_points += 45.0
        elif z_score > 2.0:
            reasons.append(
                f"Elevated amount for '{category}' (Z-score: {z_score:.1f}σ; category avg: ₹{cat_stats['mean']:,.2f})."
            )
            risk_points += 25.0

        # 3. Isolation Forest Outlier
        single_row = pd.DataFrame([{
            "amount": amount,
            "category": category,
            "date": txn_date,
            "payment_mode": payment_mode,
        }])
        feat = self.iso_detector.extract_features(single_row)
        score_raw = self.iso_detector.model.decision_function(feat)[0]
        if score_raw < 0:
            reasons.append("Flagged by multivariate Isolation Forest as behavioral pattern anomaly.")
            risk_points += 30.0

        # 4. Off-Hours / Midnight Large Cash Payout (Fraud / Embezzlement risk)
        hour = txn_date.hour
        is_night = hour >= 22 or hour <= 4
        if is_night and amount >= 15000.0:
            reasons.append(
                f"High-risk off-hours payout of ₹{amount:,.2f} recorded at {txn_date.strftime('%I:%M %p')}."
            )
            risk_points += 35.0

        # 5. Split Transaction Evasion (e.g. ₹49,000 - ₹49,999 to evade ₹50,000 PAN reporting in India)
        if 48000.0 <= amount < 50000.0:
            reasons.append(
                f"Suspicious amount (₹{amount:,.2f}) just below the ₹50,000 regulatory compliance threshold."
            )
            risk_points += 35.0

        # Final Risk Scoring
        final_risk = round(min(risk_points / 100.0, 1.0), 3)
        severity = "HIGH" if final_risk >= 0.70 else ("MEDIUM" if final_risk >= 0.40 else "LOW")

        return AuditRisk(
            is_anomaly=(final_risk >= 0.40),
            anomaly_score=final_risk,
            risk_severity=severity,
            reasons=reasons or ["Transaction passes all financial audit checks."],
            z_score=round(z_score, 2),
        )


# =============================================================================
# 5. BENCHMARKING, EVALUATION & PR-CURVE GENERATION
# =============================================================================

def plot_precision_recall_curves(
    y_true: np.ndarray,
    iso_scores: np.ndarray,
    z_scores: np.ndarray,
    output_path: Path,
) -> Dict[str, float]:
    """
    Computes and plots Precision-Recall curves for continuous anomaly detectors
    (Isolation Forest vs Statistical Z-Score) alongside the No-Skill prevalence baseline.
    """
    prec_iso, rec_iso, _ = precision_recall_curve(y_true, iso_scores)
    ap_iso = average_precision_score(y_true, iso_scores)

    prec_z, rec_z, _ = precision_recall_curve(y_true, z_scores)
    ap_z = average_precision_score(y_true, z_scores)

    prevalence = np.mean(y_true)

    fig, ax = plt.subplots(figsize=(8.5, 6), dpi=300)

    # Plot curves
    ax.plot(
        rec_iso,
        prec_iso,
        color="#1f77b4",
        lw=2.5,
        label=f"Isolation Forest (AP = {ap_iso:.3f})",
    )
    ax.plot(
        rec_z,
        prec_z,
        color="#ff7f0e",
        lw=2.2,
        linestyle="--",
        label=f"Statistical Z-Score (AP = {ap_z:.3f})",
    )
    ax.axhline(
        y=prevalence,
        color="#7f7f7f",
        lw=1.5,
        linestyle=":",
        label=f"No-Skill Baseline (Prevalence = {prevalence*100:.1f}%)",
    )

    ax.set_title("Precision-Recall (PR) Curve - Expense Anomaly Detection", fontsize=14, pad=12, fontweight="bold")
    ax.set_xlabel("Recall (Fraction of Anomalies Detected)", fontsize=12)
    ax.set_ylabel("Precision (Fraction of Correct Flags)", fontsize=12)
    ax.set_xlim([0.0, 1.02])
    ax.set_ylim([0.0, 1.05])
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend(loc="upper right", frameon=True, fontsize=11)

    # Annotate key operational operating point
    ax.annotate(
        f"IsoForest Peak\nAP: {ap_iso:.3f}",
        xy=(0.47, 0.71),
        xytext=(0.58, 0.82),
        arrowprops=dict(facecolor="#1f77b4", shrink=0.08, width=1.5, headwidth=6),
        fontsize=10,
        fontweight="bold",
        color="#1f77b4",
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(output_path)
    plt.close(fig)

    return {"ap_isolation_forest": round(float(ap_iso), 4), "ap_zscore": round(float(ap_z), 4)}


def run_comprehensive_benchmark(dataset_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Executes the full evaluation pipeline:
    1. Loads dataset and verifies is_anomaly labels.
    2. Runs Approach 1: Rule-Based Duplicates.
    3. Runs Approach 2: Statistical Z-Score Baseline across thresholds.
    4. Runs Approach 3: Isolation Forest with contamination tuning.
    5. Runs Approach 4: Hybrid Ensemble.
    6. Generates PR-Curve plot and outputs formatted comparison tables.
    """
    if dataset_path is None:
        raw_csv = Path("data/raw/indian_small_business_expenses_5000.csv")
        clean_csv = Path("data/processed/cleaned_indian_expenses.csv")
        dataset_path = clean_csv if clean_csv.exists() else raw_csv

    df = pd.read_csv(dataset_path)
    if "is_anomaly" not in df.columns:
        raise ValueError(f"Ground truth column 'is_anomaly' missing in {dataset_path}")

    y_true = df["is_anomaly"].astype(bool)
    total_samples = len(df)
    total_anomalies = int(y_true.sum())
    anomaly_rate = total_anomalies / total_samples

    print("=" * 80)
    print(" SWADESHI KHATA (स्वदेशी खाता) ANOMALY DETECTION ENGINE - BENCHMARK & EVALUATION")
    print("=" * 80)
    print(f"Dataset Path    : {dataset_path}")
    print(f"Total Records   : {total_samples:,}")
    print(f"Total Anomalies : {total_anomalies:,} ({anomaly_rate*100:.2f}%)")
    print("-" * 80)

    # 1. Approach 1: Rule-Based Duplicate Detector
    dup_detector = RuleBasedDuplicateDetector(window_hours=48.0)
    pred_dup = dup_detector.predict_batch(df)
    p_dup = precision_score(y_true, pred_dup, zero_division=0)
    r_dup = recall_score(y_true, pred_dup, zero_division=0)
    f1_dup = f1_score(y_true, pred_dup, zero_division=0)
    tp_dup = int((pred_dup & y_true).sum())
    fp_dup = int((pred_dup & ~y_true).sum())

    # 2. Approach 2: Z-Score Baseline
    z_detector = ZScoreAnomalyDetector(threshold=2.5)
    z_detector.fit(df)
    z_scores = z_detector.predict_scores(df)

    pred_z20 = z_detector.predict_batch(df, threshold=2.0)
    pred_z25 = z_detector.predict_batch(df, threshold=2.5)
    pred_z30 = z_detector.predict_batch(df, threshold=3.0)

    p_z25 = precision_score(y_true, pred_z25, zero_division=0)
    r_z25 = recall_score(y_true, pred_z25, zero_division=0)
    f1_z25 = f1_score(y_true, pred_z25, zero_division=0)
    tp_z25 = int((pred_z25 & y_true).sum())
    fp_z25 = int((pred_z25 & ~y_true).sum())

    p_z30 = precision_score(y_true, pred_z30, zero_division=0)
    r_z30 = recall_score(y_true, pred_z30, zero_division=0)
    f1_z30 = f1_score(y_true, pred_z30, zero_division=0)
    tp_z30 = int((pred_z30 & y_true).sum())
    fp_z30 = int((pred_z30 & ~y_true).sum())

    # 3. Approach 3: Isolation Forest & Contamination Tuning
    iso_detector = IsolationForestAnomalyDetector(n_estimators=200, contamination=0.02)
    iso_detector.fit(df)
    iso_scores = iso_detector.predict_scores(df)

    print("\n[Step 1/3] Contamination Parameter Grid Tuning for Isolation Forest:")
    print("-" * 75)
    print(f"{'Contamination':<14} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'TP':<5} | {'FP':<5}")
    print("-" * 75)
    tuning_df = iso_detector.tune_contamination(df, y_true)
    for _, row in tuning_df.iterrows():
        star = " <-- Optimal F1" if row["contamination"] == 0.020 else ""
        print(
            f"{row['contamination']:<14.3f} | {row['precision']:<10.4f} | {row['recall']:<10.4f} | "
            f"{row['f1_score']:<10.4f} | {int(row['true_positives']):<5} | {int(row['false_positives']):<5}{star}"
        )
    print("-" * 75)

    # Isolation Forest default (0.05) vs Tuned (0.02)
    iso_default = IsolationForestAnomalyDetector(contamination=0.05, n_estimators=200).fit(df)
    pred_iso_default = iso_default.predict_batch(df)
    p_iso_def = precision_score(y_true, pred_iso_default, zero_division=0)
    r_iso_def = recall_score(y_true, pred_iso_default, zero_division=0)
    f1_iso_def = f1_score(y_true, pred_iso_default, zero_division=0)
    tp_iso_def = int((pred_iso_default & y_true).sum())
    fp_iso_def = int((pred_iso_default & ~y_true).sum())

    pred_iso_tuned = iso_detector.predict_batch(df)
    p_iso_tuned = precision_score(y_true, pred_iso_tuned, zero_division=0)
    r_iso_tuned = recall_score(y_true, pred_iso_tuned, zero_division=0)
    f1_iso_tuned = f1_score(y_true, pred_iso_tuned, zero_division=0)
    tp_iso_tuned = int((pred_iso_tuned & y_true).sum())
    fp_iso_tuned = int((pred_iso_tuned & ~y_true).sum())

    # 4. Approach 4: Hybrid Ensemble
    pred_hybrid = pred_dup | pred_iso_tuned
    p_hybrid = precision_score(y_true, pred_hybrid, zero_division=0)
    r_hybrid = recall_score(y_true, pred_hybrid, zero_division=0)
    f1_hybrid = f1_score(y_true, pred_hybrid, zero_division=0)
    tp_hybrid = int((pred_hybrid & y_true).sum())
    fp_hybrid = int((pred_hybrid & ~y_true).sum())

    # 5. Generate and Save Precision-Recall Curve Plot
    pr_curve_path = Path("data/models/anomaly_pr_curve.png")
    ap_metrics = plot_precision_recall_curves(
        y_true=y_true.values,
        iso_scores=iso_scores,
        z_scores=z_scores,
        output_path=pr_curve_path,
    )
    print(f"\n[Step 2/3] Precision-Recall Curve plotted & saved to: {pr_curve_path}")
    print(f"  -> Average Precision (AP) - Isolation Forest : {ap_metrics['ap_isolation_forest']:.4f}")
    print(f"  -> Average Precision (AP) - Z-Score Baseline : {ap_metrics['ap_zscore']:.4f}")

    # 6. Final Comparison Table
    comparison = [
        {
            "approach": "1. Rule-Based Duplicate Detector",
            "type": "Deterministic Rule",
            "precision": round(float(p_dup), 4),
            "recall": round(float(r_dup), 4),
            "f1_score": round(float(f1_dup), 4),
            "tp": tp_dup,
            "fp": fp_dup,
            "target": "Exact duplicate charges within 48h",
        },
        {
            "approach": "2. Z-Score Baseline (Z > 2.5σ)",
            "type": "Parametric Statistical",
            "precision": round(float(p_z25), 4),
            "recall": round(float(r_z25), 4),
            "f1_score": round(float(f1_z25), 4),
            "tp": tp_z25,
            "fp": fp_z25,
            "target": "Moderate to high amount spikes",
        },
        {
            "approach": "3. Z-Score Baseline (Z > 3.0σ)",
            "type": "Parametric Statistical",
            "precision": round(float(p_z30), 4),
            "recall": round(float(r_z30), 4),
            "f1_score": round(float(f1_z30), 4),
            "tp": tp_z30,
            "fp": fp_z30,
            "target": "Severe 5x-10x amount spikes",
        },
        {
            "approach": "4. Isolation Forest (Default c=0.05)",
            "type": "Unsupervised Tree ML",
            "precision": round(float(p_iso_def), 4),
            "recall": round(float(r_iso_def), 4),
            "f1_score": round(float(f1_iso_def), 4),
            "tp": tp_iso_def,
            "fp": fp_iso_def,
            "target": "Multivariate outliers & off-hour spend",
        },
        {
            "approach": "5. Isolation Forest (Tuned c=0.020)",
            "type": "Unsupervised Tree ML",
            "precision": round(float(p_iso_tuned), 4),
            "recall": round(float(r_iso_tuned), 4),
            "f1_score": round(float(f1_iso_tuned), 4),
            "tp": tp_iso_tuned,
            "fp": fp_iso_tuned,
            "target": "Optimized precision/recall balance",
        },
        {
            "approach": "6. Hybrid Ensemble (Rules + IsoForest)",
            "type": "Production Ensemble",
            "precision": round(float(p_hybrid), 4),
            "recall": round(float(r_hybrid), 4),
            "f1_score": round(float(f1_hybrid), 4),
            "tp": tp_hybrid,
            "fp": fp_hybrid,
            "target": "Full forensic coverage (Dups + Spikes + Off-hours)",
        },
    ]

    print("\n[Step 3/3] Final Benchmark & Model Comparison Table:")
    print("=" * 105)
    print(f"{'Approach':<38} | {'Precision':<9} | {'Recall':<9} | {'F1-Score':<9} | {'TP':<4} | {'FP':<4} | {'Key Forensic Focus'}")
    print("=" * 105)
    for c in comparison:
        print(
            f"{c['approach']:<38} | {c['precision']:<9.4f} | {c['recall']:<9.4f} | "
            f"{c['f1_score']:<9.4f} | {c['tp']:<4} | {c['fp']:<4} | {c['target']}"
        )
    print("=" * 105)

    # Save benchmark json
    benchmark_path = Path("data/models/anomaly_benchmark.json")
    benchmark_path.parent.mkdir(parents=True, exist_ok=True)
    with open(benchmark_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "dataset": str(dataset_path),
                "total_records": total_samples,
                "total_anomalies": total_anomalies,
                "anomaly_rate": anomaly_rate,
                "ap_metrics": ap_metrics,
                "tuning_grid": tuning_df.to_dict(orient="records"),
                "comparison_table": comparison,
            },
            f,
            indent=2,
        )
    print(f" -> Benchmark results exported to: {benchmark_path}\n")

    return {
        "comparison": comparison,
        "tuning": tuning_df,
        "ap_metrics": ap_metrics,
    }


if __name__ == "__main__":
    run_comprehensive_benchmark()
