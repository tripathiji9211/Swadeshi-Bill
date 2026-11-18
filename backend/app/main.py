"""
ReceiptRadar - FastAPI Application Backend
Exposes RESTful endpoints for OCR text extraction, LLM parsing,
ML category prediction, forensic anomaly audit, forecasting, and savings advisory.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
from typing import Optional, List, Dict, Any
from pathlib import Path
import shutil
import uuid
import json

from backend.app.config import (
    EXPENSES_DB_PATH,
    SAMPLE_RECEIPTS_DIR,
)
from backend.app.models.schemas import (
    ParsedReceipt,
    AuditedReceipt,
    ExpenseRecord,
    AnalyticsSummary,
    ForecastResponse,
    SavingsRecommendation,
)
from backend.app.services.ocr_engine import OCREngine
from backend.app.services.llm_parser import LLMParser
from backend.app.services.category_classifier import CategoryClassifier
from backend.app.services.anomaly_detector import ExpenseAnomalyDetector
from backend.app.services.forecaster import SpendingForecaster
from backend.app.services.savings_recommender import SavingsRecommender
from backend.app.utils.sample_data import ensure_sample_database, generate_sample_receipt_suite

# Service Singletons
ocr_service: Optional[OCREngine] = None
llm_service: Optional[LLMParser] = None
classifier_service: Optional[CategoryClassifier] = None
anomaly_service: Optional[ExpenseAnomalyDetector] = None
forecaster_service: Optional[SpendingForecaster] = None
savings_service: Optional[SavingsRecommender] = None


def init_services():
    """Initializes models and ensures sample data exists."""
    global ocr_service, llm_service, classifier_service, anomaly_service, forecaster_service, savings_service

    if ocr_service is not None:
        return

    ensure_sample_database()
    generate_sample_receipt_suite()

    ocr_service = OCREngine()
    llm_service = LLMParser()
    classifier_service = CategoryClassifier()
    anomaly_service = ExpenseAnomalyDetector()
    forecaster_service = SpendingForecaster()
    savings_service = SavingsRecommender()


# Eagerly initialize services on module load
init_services()


app = FastAPI(
    title="ReceiptRadar API",
    description="AI Expense Auditor for Small Businesses",
    version="1.0.0",
)

# Enable CORS for Streamlit and web frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    """Health check endpoint providing engine status."""
    return {
        "status": "online",
        "app": "ReceiptRadar AI Expense Auditor",
        "ocr_engine": ocr_service.engine_name if ocr_service else "Initializing",
        "llm_client": llm_service.client_type if llm_service else "Initializing",
    }


@app.post("/api/audit/upload", response_model=AuditedReceipt)
async def audit_uploaded_receipt(file: UploadFile = File(...)):
    """
    End-to-End Pipeline:
    Receipt Image/PDF -> OpenCV Preprocess -> OCR Text -> LLM JSON -> ML Classifier -> Anomaly Audit
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file missing name.")

    # Save temporary file for OpenCV / OCR
    temp_path = SAMPLE_RECEIPTS_DIR / f"upload_{uuid.uuid4().hex[:6]}_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. OCR Extraction
        ocr_result = ocr_service.extract_text(temp_path)
        raw_text = ocr_result.get("raw_text", "")

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="No readable text detected on document.")

        # 2. LLM JSON Parsing
        parsed_receipt = llm_service.parse(raw_text)

        # 3. ML Category Classification
        items_desc = " ".join([i.description for i in parsed_receipt.items])
        predicted_cat, confidence, _ = classifier_service.predict(
            merchant=parsed_receipt.merchant_name,
            items_text=items_desc,
        )

        # 4. Anomaly Detection & Forensic Audit
        audit_risk = anomaly_service.audit_transaction(
            amount=parsed_receipt.total_amount,
            category=predicted_cat,
            merchant=parsed_receipt.merchant_name,
            txn_date_str=parsed_receipt.date,
            tax=parsed_receipt.tax_amount,
        )

        return AuditedReceipt(
            parsed=parsed_receipt,
            predicted_category=predicted_cat,
            category_confidence=confidence,
            audit_risk=audit_risk,
        )

    finally:
        # Cleanup temp file
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass


@app.post("/api/audit/text", response_model=AuditedReceipt)
def audit_raw_text(payload: Dict[str, str]):
    """Audits raw OCR receipt text or manual entry."""
    raw_text = payload.get("raw_text", "")
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text field cannot be empty.")

    # 1. LLM JSON Parsing
    parsed_receipt = llm_service.parse(raw_text)

    # 2. ML Category Classification
    items_desc = " ".join([i.description for i in parsed_receipt.items])
    predicted_cat, confidence, _ = classifier_service.predict(
        merchant=parsed_receipt.merchant_name,
        items_text=items_desc,
    )

    # 3. Anomaly Detection & Forensic Audit
    audit_risk = anomaly_service.audit_transaction(
        amount=parsed_receipt.total_amount,
        category=predicted_cat,
        merchant=parsed_receipt.merchant_name,
        txn_date_str=parsed_receipt.date,
        tax=parsed_receipt.tax_amount,
    )

    return AuditedReceipt(
        parsed=parsed_receipt,
        predicted_category=predicted_cat,
        category_confidence=confidence,
        audit_risk=audit_risk,
    )


@app.get("/api/expenses", response_model=List[ExpenseRecord])
def get_expenses(
    category: Optional[str] = Query(None),
    only_anomalies: Optional[bool] = Query(False),
    limit: int = Query(100, ge=1, le=1000),
):
    """Retrieves filtered historical transactions."""
    if not EXPENSES_DB_PATH.exists():
        ensure_sample_database()

    df = pd.read_csv(EXPENSES_DB_PATH)

    if category:
        df = df[df["category"].str.lower() == category.lower()]

    if only_anomalies:
        df = df[df["is_anomaly"] == True]

    df = df.sort_values("date", ascending=False).head(limit)

    results = []
    for _, row in df.iterrows():
        reasons_raw = str(row.get("risk_reasons", ""))
        reasons_list = [r.strip() for r in reasons_raw.split(";") if r.strip()] if reasons_raw and reasons_raw != "nan" else []
        results.append(ExpenseRecord(
            id=str(row["id"]),
            date=str(row["date"]),
            merchant=str(row["merchant"]),
            amount=float(row["amount"]),
            category=str(row["category"]),
            tax=float(row.get("tax", 0.0)),
            is_anomaly=bool(row.get("is_anomaly", False)),
            risk_severity=str(row.get("risk_severity", "LOW")),
            risk_reasons=reasons_list,
            receipt_text=str(row.get("receipt_text", "")),
        ))
    return results


@app.post("/api/expenses")
def record_audited_receipt(receipt: AuditedReceipt):
    """Saves an audited receipt to the database log."""
    if not EXPENSES_DB_PATH.exists():
        ensure_sample_database()

    df = pd.read_csv(EXPENSES_DB_PATH)

    reasons_str = "; ".join(receipt.audit_risk.reasons)
    new_record = {
        "id": f"REC-{uuid.uuid4().hex[:8].upper()}",
        "date": receipt.parsed.date,
        "merchant": receipt.parsed.merchant_name,
        "amount": receipt.parsed.total_amount,
        "category": receipt.predicted_category,
        "tax": receipt.parsed.tax_amount,
        "is_anomaly": receipt.audit_risk.is_anomaly,
        "risk_severity": receipt.audit_risk.risk_severity,
        "risk_reasons": reasons_str,
        "receipt_text": f"{receipt.parsed.merchant_name} - " + ", ".join([i.description for i in receipt.parsed.items]),
    }

    df = pd.concat([df, pd.DataFrame([new_record])], ignore_index=True)
    df.to_csv(EXPENSES_DB_PATH, index=False)
    return {"status": "success", "id": new_record["id"]}


@app.get("/api/analytics/summary", response_model=AnalyticsSummary)
def get_analytics_summary():
    """Calculates executive KPI metrics and spending distributions."""
    if not EXPENSES_DB_PATH.exists():
        ensure_sample_database()

    df = pd.read_csv(EXPENSES_DB_PATH)
    total_spend = float(df["amount"].sum())
    total_receipts = len(df)
    anomalous_df = df[df["is_anomaly"] == True]
    anomalous_count = len(anomalous_df)
    anomaly_rate = (anomalous_count / total_receipts * 100.0) if total_receipts > 0 else 0.0
    avg_txn = total_spend / total_receipts if total_receipts > 0 else 0.0

    category_spend = df.groupby("category")["amount"].sum().round(2).to_dict()

    top_vendors_df = df.groupby("merchant")["amount"].agg(total="sum", count="count").reset_index()
    top_vendors = (
        top_vendors_df.sort_values("total", ascending=False)
        .head(6)
        .rename(columns={"merchant": "name"})
        .to_dict(orient="records")
    )

    return AnalyticsSummary(
        total_spend=round(total_spend, 2),
        total_receipts=total_receipts,
        anomalous_receipts=anomalous_count,
        anomaly_rate_pct=round(anomaly_rate, 1),
        average_transaction=round(avg_txn, 2),
        spending_by_category=category_spend,
        top_vendors=top_vendors,
    )


@app.get("/api/forecast", response_model=ForecastResponse)
def get_spending_forecast(horizon_days: int = Query(30, ge=7, le=90)):
    """Computes time-series spending forecast for upcoming days."""
    return forecaster_service.forecast_next_30_days(horizon_days=horizon_days)


@app.get("/api/recommendations", response_model=List[SavingsRecommendation])
def get_savings_recommendations():
    """Generates prioritized cost-saving recommendations."""
    return savings_service.generate_recommendations()


@app.post("/api/retrain")
def retrain_models():
    """Retrains the ML category classifier and anomaly detection models."""
    clf_metrics = classifier_service.train_on_history()
    ano_metrics = anomaly_service.train_on_history()
    return {
        "status": "retrained",
        "classifier_metrics": clf_metrics,
        "anomaly_metrics": ano_metrics,
    }
