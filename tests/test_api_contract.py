"""
ReceiptRadar - Backend API Contract Parity Test Suite
=====================================================
Enforces backward compatibility across all REST API endpoints.
Loads the baseline contract snapshot (tests/api_contract_snapshot.json)
and asserts that:
1. Every specified endpoint exists and responds with HTTP 200.
2. Every expected response field is present (field removals FAIL loudly).
3. New/additive fields are permitted to allow non-breaking feature extensions.
"""

import json
from pathlib import Path
import pytest
import requests

from src.api.database import SessionLocal
from src.api import main as api_module

SNAPSHOT_PATH = Path(__file__).parent / "api_contract_snapshot.json"
BASE_URL = "http://127.0.0.1:8000"


def is_live_server_running() -> bool:
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=1.0)
        return r.status_code == 200
    except Exception:
        return False


LIVE_SERVER = is_live_server_running()


@pytest.fixture(scope="module")
def contract_snapshot():
    assert SNAPSHOT_PATH.exists(), f"Snapshot file missing at {SNAPSHOT_PATH}"
    with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_data(path: str, params: dict = None):
    if LIVE_SERVER:
        resp = requests.get(f"{BASE_URL}{path}", params=params, timeout=10.0)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        return resp.json()
    else:
        db = SessionLocal()
        try:
            if path == "/health":
                return api_module.health_check()
            elif path == "/expenses":
                limit = (params or {}).get("limit", 10)
                return [r for r in api_module.get_expenses(limit=limit, db=db)]
            elif path == "/dashboard/summary":
                return api_module.get_dashboard_summary(db=db).model_dump()
            elif path == "/forecast":
                return api_module.get_spend_forecast().model_dump()
            elif path == "/insights":
                return api_module.get_insights().model_dump()
            elif path == "/review-queue":
                return [r for r in api_module.get_review_queue(limit=10, db=db)]
            elif path == "/sample-receipts":
                return [s.model_dump() for s in api_module.list_sample_receipts()]
            elif path == "/ask/suggestions":
                return api_module.get_ask_suggestions()
            elif path.startswith("/explain-prediction"):
                desc = (params or {}).get("description", "fuel")
                vendor = (params or {}).get("vendor", "")
                return api_module.explain_category_prediction(description=desc, vendor=vendor)
            else:
                raise ValueError(f"Unmapped path in fallback: {path}")
        finally:
            db.close()


def _post_data(path: str, json_body: dict = None, files: dict = None):
    if LIVE_SERVER:
        if files:
            resp = requests.post(f"{BASE_URL}{path}", files=files, timeout=15.0)
        else:
            resp = requests.post(f"{BASE_URL}{path}", json=json_body, timeout=10.0)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        return resp.json()
    else:
        db = SessionLocal()
        try:
            if path == "/ask":
                req = api_module.AskQuestionRequest(**(json_body or {}))
                return api_module.ask_question_about_expenses(req, db=db).model_dump()
            elif path == "/upload-receipt":
                from fastapi import UploadFile
                import io
                text = "BPCL Petrol Pump\nDate: 2026-03-25\nDiesel fuel 3000\nTotal: 3000"
                file_obj = io.BytesIO(text.encode("utf-8"))
                up = UploadFile(filename="sample_test.txt", file=file_obj)
                res = api_module.upload_receipt(file=up, db=db)
                return res.model_dump() if hasattr(res, "model_dump") else res.dict()
            else:
                raise ValueError(f"Unmapped path in fallback: {path}")
        finally:
            db.close()


def test_api_contract_health(contract_snapshot):
    spec = contract_snapshot["GET /health"]
    data = _get_data("/health")
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in GET /health: {missing}. Field removal is forbidden."


def test_api_contract_upload_receipt(contract_snapshot):
    spec = contract_snapshot["POST /upload-receipt"]
    payload = "BPCL Petrol Pump\nDate: 2026-03-25\nDiesel fuel 3000\nTotal: 3000"
    files = {"file": ("test_invoice.txt", payload.encode("utf-8"), "text/plain")}
    data = _post_data("/upload-receipt", files=files)
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in POST /upload-receipt: {missing}. Field removal is forbidden."


def test_api_contract_expenses(contract_snapshot):
    spec = contract_snapshot["GET /expenses"]
    data = _get_data("/expenses", params={"limit": 5})
    assert isinstance(data, list)
    if data:
        item = data[0]
        missing = set(spec["required_fields"]) - set(item.keys())
        assert not missing, f"Missing fields in GET /expenses item: {missing}. Field removal is forbidden."


def test_api_contract_dashboard_summary(contract_snapshot):
    spec = contract_snapshot["GET /dashboard/summary"]
    data = _get_data("/dashboard/summary")
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in GET /dashboard/summary: {missing}. Field removal is forbidden."


def test_api_contract_forecast(contract_snapshot):
    spec = contract_snapshot["GET /forecast"]
    data = _get_data("/forecast")
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in GET /forecast: {missing}. Field removal is forbidden."


def test_api_contract_insights(contract_snapshot):
    spec = contract_snapshot["GET /insights"]
    data = _get_data("/insights")
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in GET /insights: {missing}. Field removal is forbidden."


def test_api_contract_ask(contract_snapshot):
    spec = contract_snapshot["POST /ask"]
    data = _post_data("/ask", json_body={"question": "What is our total spend?"})
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in POST /ask: {missing}. Field removal is forbidden."


def test_api_contract_review_queue(contract_snapshot):
    spec = contract_snapshot["GET /review-queue"]
    data = _get_data("/review-queue", params={"limit": 10})
    assert isinstance(data, list)
    if data:
        item = data[0]
        missing = set(spec["required_fields"]) - set(item.keys())
        assert not missing, f"Missing fields in GET /review-queue item: {missing}. Field removal is forbidden."


def test_api_contract_sample_receipts(contract_snapshot):
    spec = contract_snapshot["GET /sample-receipts"]
    data = _get_data("/sample-receipts")
    assert isinstance(data, list)
    assert len(data) > 0
    item = data[0]
    missing = set(spec["required_fields"]) - set(item.keys())
    assert not missing, f"Missing fields in GET /sample-receipts item: {missing}. Field removal is forbidden."


def test_api_contract_ask_suggestions(contract_snapshot):
    spec = contract_snapshot["GET /ask/suggestions"]
    data = _get_data("/ask/suggestions")
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in GET /ask/suggestions: {missing}. Field removal is forbidden."


def test_api_contract_explain_prediction(contract_snapshot):
    spec = contract_snapshot["GET /explain-prediction"]
    data = _get_data("/explain-prediction", params={"description": "diesel fuel refill", "vendor": "BPCL"})
    missing = set(spec["required_fields"]) - set(data.keys())
    assert not missing, f"Missing fields in GET /explain-prediction: {missing}. Field removal is forbidden."
