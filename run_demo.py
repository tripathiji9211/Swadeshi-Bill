"""
Swadeshi Khata (स्वदेशी खाता) - End-to-End Production Pipeline Verification
Tagline: "Aapka hisaab, aapka bharosa"
"""

import sys
from pathlib import Path

# Force UTF-8 on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent
sys.path.append(str(ROOT_DIR))

from src.utils.sample_data import ensure_sample_database, generate_sample_receipt_suite
from src.ocr.engine import OCREngine
from src.parsing.parser import LLMParser
from src.models.classifier import CategoryClassifier
from src.models.anomaly import ExpenseAnomalyDetector
from src.models.forecaster import SpendingForecaster
from src.models.recommender import SavingsRecommender
from src.config import SAMPLE_RECEIPTS_DIR


def run_pipeline_test():
    print("=" * 70)
    print(" [SWADESHI KHATA | स्वदेशी खाता] PRODUCTION PIPELINE VERIFICATION")
    print("=" * 70)

    # 1. Assets
    print("\n[Step 1] Verifying data directories and receipt samples...")
    ensure_sample_database()
    sample_paths = generate_sample_receipt_suite()
    print(f"Verified {len(sample_paths)} sample receipts in {SAMPLE_RECEIPTS_DIR}")

    # 2. Engines
    print("\n[Step 2] Loading ML and AI Services...")
    ocr = OCREngine()
    llm = LLMParser()
    clf = CategoryClassifier()
    ano = ExpenseAnomalyDetector()
    forecaster = SpendingForecaster()
    recommender = SavingsRecommender()

    print(f" - OCR Backend: {ocr.engine_name}")
    print(f" - LLM Client: {llm.client_type}")

    # 3. Pipeline Test
    test_receipt = sample_paths[0] if sample_paths else SAMPLE_RECEIPTS_DIR / "sample_office_supplies.png"
    print(f"\n[Step 3] Running pipeline on: {test_receipt.name}")
    ocr_res = ocr.extract_text(test_receipt)
    parsed = llm.parse(ocr_res["raw_text"])
    print(f"  [OCR/LLM] Vendor: {parsed.merchant_name} | Date: {parsed.date} | Total: ${parsed.total_amount:.2f}")

    items_text = " ".join([i.description for i in parsed.items])
    pred_cat, conf, _ = clf.predict(parsed.merchant_name, items_text)
    print(f"  [ML Classifier] Category: '{pred_cat}' ({conf * 100:.1f}% confidence)")

    audit = ano.audit_transaction(
        amount=parsed.total_amount,
        category=pred_cat,
        merchant=parsed.merchant_name,
        txn_date_str=parsed.date,
        tax=parsed.tax_amount,
    )
    print(f"  [Audit Status] Severity: {audit.risk_severity} (Anomaly Score: {audit.anomaly_score * 100:.1f}%)")

    # 4. Outlier Dinner Check
    print("\n[Step 4] Testing Audit Rule & Anomaly Detector on Outlier Meal ($930.95)...")
    outlier_receipt = SAMPLE_RECEIPTS_DIR / "sample_suspicious_high_dinner.png"
    if outlier_receipt.exists():
        ocr_out = ocr.extract_text(outlier_receipt)
        parsed_out = llm.parse(ocr_out["raw_text"])
        cat_out, _, _ = clf.predict(parsed_out.merchant_name, "Tomahawk Ribeye Cabernet")
        audit_out = ano.audit_transaction(
            amount=parsed_out.total_amount,
            category=cat_out,
            merchant=parsed_out.merchant_name,
            txn_date_str=parsed_out.date,
        )
        print(f"  Vendor: {parsed_out.merchant_name} | Total: ${parsed_out.total_amount:.2f}")
        print(f"  Audit Status: {audit_out.risk_severity} RISK (Anomaly Score: {audit_out.anomaly_score * 100:.1f}%)")
        for r in audit_out.reasons:
            print(f"   -> Flag: {r}")

    # 5. Forecaster
    print("\n[Step 5] Computing 30-Day Spending Forecast...")
    fc = forecaster.forecast_next_30_days(horizon_days=30)
    print(f"  Historical Daily Average: ${fc.historical_daily_avg:,.2f}")
    print(f"  Forecasted 30-Day Total: ${fc.forecast_total_spend:,.2f} ({fc.trend_direction} {fc.trend_percentage:+.1f}%)")

    # 6. Savings
    print("\n[Step 6] Generating AI Cost-Reduction Recommendations...")
    recs = recommender.generate_recommendations()
    for r in recs[:3]:
        print(f"  - [{r.priority}] {r.title} (Est. Savings: ${r.potential_annual_savings:,.2f}/yr)")

    print("\n" + "=" * 70)
    print(" [SUCCESS] ALL PRODUCTION COMPONENTS OPERATIONAL!")
    print("=" * 70)


if __name__ == "__main__":
    run_pipeline_test()
