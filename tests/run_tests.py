"""
ReceiptRadar Test Suite Runner
"""

import sys
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

import tests.test_ocr as t_ocr
import tests.test_parser as t_parser
import tests.test_models as t_models
import tests.test_api as t_api

def run_all():
    print("=" * 60)
    print("RUNNING RECEIPTRADAR AUTOMATED UNIT & INTEGRATION TESTS")
    print("=" * 60)

    print("\n[1/4] Testing OCR Components...")
    t_ocr.test_ocr_engine_initialization()
    t_ocr.test_ocr_extraction_sample()
    print(" -> OCR Engine tests PASSED.")

    print("\n[2/4] Testing LLM Parsing Components...")
    t_parser.test_llm_parser_heuristic()
    print(" -> LLM Parser tests PASSED.")

    print("\n[3/4] Testing ML & Forecasting Models...")
    t_models.test_category_classifier()
    t_models.test_anomaly_detector_safe()
    t_models.test_anomaly_detector_high_risk()
    t_models.test_spending_forecaster()
    t_models.test_category_spend_forecaster()
    t_models.test_expense_insights_analyzer()
    print(" -> Classification, Anomaly, Forecast, & Insights models PASSED.")

    print("\n[4/4] Testing FastAPI Endpoints...")
    t_api.test_api_health()
    t_api.test_post_upload_receipt()
    t_api.test_get_expenses_endpoint()
    t_api.test_get_forecast_endpoint()
    t_api.test_get_insights_endpoint()
    t_api.test_post_ask_endpoint()
    t_api.test_api_analytics()
    t_api.test_api_forecast()
    t_api.test_api_recommendations()
    t_api.test_api_audit_text()
    print(" -> All FastAPI Endpoints (Core & Legacy) PASSED.")

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_all()

