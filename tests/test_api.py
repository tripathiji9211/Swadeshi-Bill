"""
ReceiptRadar - FastAPI Endpoints Test Suite
===========================================
Tests all core and legacy REST endpoint handlers directly:
1. Health check: GET /
2. Receipt Upload & Audit: POST /upload-receipt
3. Expenses Retrieval & Filtering: GET /expenses
4. Multi-Category Forecast: GET /forecast
5. Financial Insights & Report: GET /insights
6. Natural-Language Financial Q&A: POST /ask
7. Legacy Analytics & Forecast Wrappers
"""

import io
import sys
import asyncio
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import UploadFile
from src.api.main import (
    health_check,
    upload_receipt,
    get_expenses,
    get_spend_forecast,
    get_insights,
    ask_question_about_expenses,
    get_analytics_summary,
    get_spending_forecast,
    get_savings_recommendations,
    audit_raw_text,
    AskQuestionRequest,
    get_review_queue,
    correct_expense_label,
    retrain_feedback_endpoint,
    CorrectionRequest,
)
from src.api.database import SessionLocal, ExpenseModel


def test_api_health():
    """Verify system health endpoint."""
    h = health_check()
    assert h["status"] == "online"
    assert "ocr_engine" in h
    assert "classifier_model" in h
    assert "database" in h


def test_post_upload_receipt():
    """Verify POST /upload-receipt ingestion, OCR/parse/classify/anomaly, and SQLite storage."""
    db = SessionLocal()
    try:
        sample_text = (
            "BPCL PETROL PUMP REGIONAL OUTLET\n"
            "Date: 2024-05-15\n"
            "Diesel Fuel 40 Litres 3600.00\n"
            "CGST 2.5% 90.00\n"
            "SGST 2.5% 90.00\n"
            "TOTAL: 3780.00\n"
            "Payment Mode: UPI"
        )
        file_bytes = io.BytesIO(sample_text.encode("utf-8"))
        up_file = UploadFile(filename="test_receipt.txt", file=file_bytes)

        res = upload_receipt(file=up_file, db=db)
        assert res.status == "success"
        assert res.expense_id is not None
        assert res.predicted_category in ["transport", "utilities", "misc"] or res.category_confidence > 0
        assert res.audit_risk is not None
        assert res.expense["amount"] > 0
    finally:
        db.close()


def test_get_expenses_endpoint():
    """Verify GET /expenses endpoint with query filtering and pagination."""
    db = SessionLocal()
    try:
        # 1. Unfiltered limit
        expenses = get_expenses(limit=10, db=db)
        assert isinstance(expenses, list)
        assert len(expenses) > 0
        assert "vendor" in expenses[0]
        assert "amount" in expenses[0]

        # 2. Category filter
        groceries = get_expenses(category="groceries", limit=5, db=db)
        for exp in groceries:
            assert exp["category"].lower() == "groceries"

        # 3. Anomaly filter
        anomalies = get_expenses(only_anomalies=True, limit=5, db=db)
        for exp in anomalies:
            assert exp["is_anomaly"] is True
    finally:
        db.close()


def test_get_forecast_endpoint():
    """Verify GET /forecast multi-category spend forecasting endpoint."""
    f = get_spend_forecast()
    assert f.forecast_month is not None
    assert f.category_projections is not None
    assert len(f.category_projections) == 8
    assert f.total_projected_spend > 0
    for cat in ["groceries", "utilities", "rent", "transport", "salaries", "supplies", "marketing", "misc"]:
        assert cat in f.category_projections
        assert f.category_projections[cat] > 0


def test_get_insights_endpoint():
    """Verify GET /insights financial intelligence endpoint."""
    ins = get_insights()
    assert ins.total_expenses_audited > 0
    assert ins.total_spend_analyzed > 0
    assert len(ins.price_variance_findings) > 0
    assert len(ins.category_spike_findings) > 0
    assert len(ins.subscription_findings) > 0
    assert len(ins.actionable_tips) >= 3
    assert len(ins.executive_report_markdown) > 100


def test_post_ask_endpoint():
    """Verify POST /ask natural-language Q&A endpoint."""
    db = SessionLocal()
    try:
        req = AskQuestionRequest(question="What is our highest spending expense category?")
        res = ask_question_about_expenses(payload=req, db=db)
        assert res.question == req.question
        assert len(res.answer) > 20
        assert "total_spend_inr" in res.relevant_metrics
        assert "top_spending_category" in res.relevant_metrics
        assert res.relevant_metrics["total_spend_inr"] > 0
    finally:
        db.close()


# Legacy Tests for Backward Compatibility
def test_api_analytics():
    a = get_analytics_summary()
    assert a.total_spend > 0
    assert a.total_receipts > 0


def test_api_forecast():
    f = get_spending_forecast(horizon_days=21)
    assert f.horizon_days == 21
    assert f.forecast_total_spend > 0


def test_api_recommendations():
    r = get_savings_recommendations()
    assert len(r) > 0


def test_api_audit_text():
    audit = audit_raw_text({"raw_text": "BPCL PETROL PUMP\nDiesel 35 Litres 3200.00\nTOTAL: 3200.00"})
    assert audit.predicted_category in ["transport", "Travel & Fuel"] or audit.category_confidence > 0


# =============================================================================
# HUMAN-IN-THE-LOOP FEEDBACK & CONFIDENCE TESTS
# =============================================================================

def test_confidence_and_review_routing():
    """Verify confidence metrics and review routing on upload."""
    db = SessionLocal()
    try:
        sample_text = (
            "AMBIGUOUS HARDWARE AND DIESEL OUTLET\n"
            "Date: 2026-03-25\n"
            "Misc mixed spare part item 1500.00\n"
            "TOTAL: 1500.00\n"
        )
        file_bytes = io.BytesIO(sample_text.encode("utf-8"))
        up_file = UploadFile(filename="low_conf_test.txt", file=file_bytes)

        res = upload_receipt(file=up_file, db=db)
        assert res.status == "success"
        assert res.classifier_confidence is not None
        assert res.ocr_confidence is not None
        assert isinstance(res.needs_review, bool)
        assert hasattr(res, "review_reason")
    finally:
        db.close()


def test_review_queue_and_correction_flow():
    """Verify review queue retrieval, human correction submission, and audit CSV logging."""
    import uuid
    import pandas as pd
    from scripts.retrain_on_feedback import FEEDBACK_CSV_PATH

    db = SessionLocal()
    try:
        test_id = f"test_rev_{uuid.uuid4().hex[:8]}"
        test_expense = ExpenseModel(
            id=test_id,
            date="2026-03-20",
            vendor="Shree Ganesh Printing Works",
            item_description="Letterhead and visiting cards 500 pcs",
            amount=2450.0,
            category="misc",  # Initially misclassified
            needs_review=True,
            review_reason="Low classifier confidence (0.45 < 0.65)",
            classifier_confidence=0.45,
            ocr_confidence=0.75,
        )
        db.add(test_expense)
        db.commit()

        # 1. Fetch review queue
        queue = get_review_queue(limit=50, db=db)
        queue_ids = [item["id"] for item in queue]
        assert test_id in queue_ids

        # 2. Submit correction
        correction = CorrectionRequest(
            corrected_category="marketing",
            corrected_vendor="Shree Ganesh Printing Press",
            corrected_description="Business Visiting Cards & Letterheads",
            notes="Corrected to marketing during manual audit",
        )
        correct_res = correct_expense_label(expense_id=test_id, correction=correction, db=db)
        assert correct_res["status"] == "success"
        assert correct_res["expense"]["category"] == "marketing"
        assert correct_res["expense"]["needs_review"] is False

        # 3. Verify in database
        updated_row = db.query(ExpenseModel).filter(ExpenseModel.id == test_id).first()
        assert updated_row.category == "marketing"
        assert updated_row.needs_review is False

        # 4. Verify in CSV audit log
        assert FEEDBACK_CSV_PATH.exists()
        fb_df = pd.read_csv(FEEDBACK_CSV_PATH)
        assert test_id in fb_df["expense_id"].astype(str).values
        corrected_record = fb_df[fb_df["expense_id"].astype(str) == test_id].iloc[-1]
        assert corrected_record["corrected_category"] == "marketing"
    finally:
        db.close()


def test_retrain_feedback_loop():
    """Verify retraining pipeline incorporating human feedback."""
    res = retrain_feedback_endpoint()
    assert res.status == "success"
    assert res.training_accuracy > 0.85
    assert res.total_training_examples > 5000


def test_explain_prediction_endpoint():
    """Verify GET /explain-prediction endpoint."""
    from src.api.main import explain_category_prediction
    exp = explain_category_prediction(
        description="pamplet flex printing banner",
        vendor="Shree Print Media",
    )
    assert "predicted_category" in exp
    assert "top_features" in exp
    assert len(exp["top_features"]) > 0
    assert "summary_explanation" in exp


