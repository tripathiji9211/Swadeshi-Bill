"""
ReceiptRadar - Backend REST API Client
=======================================
Centralized HTTP client functions communicating with the FastAPI backend.
"""

import os
from typing import Dict, Any, List, Optional, Tuple
import requests

DEFAULT_API_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")


def check_backend_health(base_url: str = DEFAULT_API_URL) -> Tuple[bool, Dict[str, Any]]:
    """Checks whether the FastAPI backend is running and reachable."""
    try:
        resp = requests.get(f"{base_url.rstrip('/')}/", timeout=1.5)
        if resp.status_code == 200:
            return True, resp.json()
        return False, {"error": f"Status code {resp.status_code}"}
    except Exception as e:
        return False, {"error": str(e)}


def api_post_upload_receipt(base_url: str, file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Sends receipt document to POST /upload-receipt endpoint."""
    url = f"{base_url.rstrip('/')}/upload-receipt"
    files = {"file": (filename, file_bytes, "application/octet-stream")}
    resp = requests.post(url, files=files, timeout=45.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_get_expenses(base_url: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Fetches stored expenses from GET /expenses endpoint with filters."""
    url = f"{base_url.rstrip('/')}/expenses"
    resp = requests.get(url, params=params or {}, timeout=15.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_get_forecast(base_url: str) -> Dict[str, Any]:
    """Fetches spend forecast from GET /forecast endpoint."""
    url = f"{base_url.rstrip('/')}/forecast"
    resp = requests.get(url, timeout=20.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_get_insights(base_url: str) -> Dict[str, Any]:
    """Fetches financial insights from GET /insights endpoint."""
    url = f"{base_url.rstrip('/')}/insights"
    resp = requests.get(url, timeout=25.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_post_ask(base_url: str, question: str) -> Dict[str, Any]:
    """Submits natural-language query to POST /ask endpoint."""
    url = f"{base_url.rstrip('/')}/ask"
    resp = requests.post(url, json={"question": question}, timeout=25.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_get_review_queue(base_url: str) -> List[Dict[str, Any]]:
    """Fetches receipts from GET /review-queue endpoint."""
    url = f"{base_url.rstrip('/')}/review-queue"
    resp = requests.get(url, timeout=15.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_post_correct_expense(base_url: str, expense_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Submits human correction to POST /review-queue/{expense_id}/correct."""
    url = f"{base_url.rstrip('/')}/review-queue/{expense_id}/correct"
    resp = requests.post(url, json=payload, timeout=15.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")


def api_post_retrain_feedback(base_url: str) -> Dict[str, Any]:
    """Triggers retraining on human feedback via POST /retrain-feedback."""
    url = f"{base_url.rstrip('/')}/retrain-feedback"
    resp = requests.post(url, timeout=60.0)
    if resp.status_code == 200:
        return resp.json()
    raise RuntimeError(f"API Error ({resp.status_code}): {resp.text}")

