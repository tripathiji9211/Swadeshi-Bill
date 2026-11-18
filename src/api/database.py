"""
ReceiptRadar - SQLAlchemy SQLite Database Layer
================================================
Manages persistent expense records, seed data initialization from cleaned historical CSV,
and transactional CRUD operations for the FastAPI backend.
"""

from typing import Optional, Generator
import os
import sys
import uuid
from pathlib import Path
from datetime import datetime

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pandas as pd
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    desc,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from src.config import DATA_DIR

SQLITE_DB_PATH = DATA_DIR / "receiptradar.db"
DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH.as_posix()}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Safe for SQLite with FastAPI multi-threading
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# =============================================================================
# 1. SQLALCHEMY ORM MODEL
# =============================================================================

class ExpenseModel(Base):
    __tablename__ = "expenses"

    id = Column(String(64), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    date = Column(String(32), index=True, nullable=False)
    vendor = Column(String(128), index=True, nullable=False)
    item_description = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    category = Column(String(64), index=True, nullable=False)
    payment_mode = Column(String(64), default="UPI")
    tax = Column(Float, default=0.0)
    is_anomaly = Column(Boolean, default=False, index=True)
    anomaly_score = Column(Float, default=0.0)
    risk_severity = Column(String(32), default="LOW")
    risk_reasons = Column(Text, default="")
    raw_text = Column(Text, default="")
    ocr_confidence = Column(Float, default=0.85)
    classifier_confidence = Column(Float, default=0.85)
    needs_review = Column(Boolean, default=False, index=True)
    review_reason = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String(64), nullable=True, index=True)

    def to_dict(self):
        reasons_list = [r.strip() for r in str(self.risk_reasons).split(";") if r.strip()] if self.risk_reasons else []
        return {
            "id": self.id,
            "date": self.date,
            "vendor": self.vendor,
            "merchant": self.vendor,
            "item_description": self.item_description or f"Expense at {self.vendor}",
            "amount": self.amount,
            "category": self.category,
            "payment_mode": self.payment_mode,
            "tax": self.tax,
            "is_anomaly": self.is_anomaly,
            "anomaly_score": self.anomaly_score,
            "risk_severity": self.risk_severity,
            "risk_reasons": reasons_list,
            "raw_text": self.raw_text,
            "receipt_text": self.raw_text,
            "ocr_confidence": round(self.ocr_confidence, 4) if self.ocr_confidence is not None else 0.85,
            "classifier_confidence": round(self.classifier_confidence, 4) if self.classifier_confidence is not None else 0.85,
            "needs_review": bool(self.needs_review),
            "review_reason": self.review_reason or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "user_id": self.user_id,
            "category_code": self.category.lower().replace(" ", "_") if self.category else "misc",
            "risk_code": (self.risk_severity or "LOW").upper(),
            "reason_codes": [r.upper().replace(" ", "_") for r in reasons_list],
        }


# =============================================================================
# 1B. USER & AUTH ORM MODELS
# =============================================================================

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(128), nullable=False)
    business_name = Column(String(128), nullable=False)
    business_type = Column(String(64), nullable=False)
    state = Column(String(64), nullable=False)
    mobile = Column(String(20), nullable=False, index=True)
    email = Column(String(128), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    gstin = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "business_name": self.business_name,
            "business_type": self.business_type,
            "state": self.state,
            "mobile": self.mobile,
            "email": self.email,
            "gstin": self.gstin,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OtpRequestModel(Base):
    __tablename__ = "otp_requests"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    mobile = Column(String(20), index=True, nullable=False)
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================================================
# 2. DATABASE DEPENDENCY & SEED INITIALIZATION
# =============================================================================

def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency yield-generator for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(seed_from_csv: bool = True):
    """
    Creates SQLite schema and automatically seeds initial 5,000 Indian SMB
    expense records if the database table is empty.
    Also executes non-destructive schema migration for newly added columns.
    """
    Base.metadata.create_all(bind=engine)

    # Perform lightweight schema migration for SQLite
    import sqlite3
    try:
        raw_conn = sqlite3.connect(str(SQLITE_DB_PATH))
        cursor = raw_conn.cursor()
        cursor.execute("PRAGMA table_info(expenses)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        
        migration_cols = [
            ("ocr_confidence", "FLOAT DEFAULT 0.85"),
            ("classifier_confidence", "FLOAT DEFAULT 0.85"),
            ("needs_review", "BOOLEAN DEFAULT 0"),
            ("review_reason", "VARCHAR(255) DEFAULT ''"),
            ("user_id", "VARCHAR(64) DEFAULT NULL"),
        ]
        for col_name, col_def in migration_cols:
            if col_name not in existing_cols:
                cursor.execute(f"ALTER TABLE expenses ADD COLUMN {col_name} {col_def}")
        raw_conn.commit()
        raw_conn.close()
    except Exception as e:
        pass

    if not seed_from_csv:
        return

    db = SessionLocal()
    try:
        count = db.query(ExpenseModel).count()
        if count == 0:
            csv_path = Path("data/processed/cleaned_indian_expenses.csv")
            if not csv_path.exists():
                csv_path = Path("data/raw/indian_small_business_expenses_5000.csv")

            if csv_path.exists():
                df = pd.read_csv(csv_path)
                records = []
                for _, row in df.iterrows():
                    amt = float(row["amount"])
                    is_anom = bool(row.get("is_anomaly", False))
                    reasons = "Injected anomaly" if is_anom else "Standard operational spend"
                    severity = "HIGH" if (is_anom and amt > 25000) else ("MEDIUM" if is_anom else "LOW")

                    vendor_name = str(row.get("vendor_normalized", row.get("vendor", "Unknown Vendor")))
                    records.append(
                        ExpenseModel(
                            id=str(uuid.uuid4()),
                            date=str(row["date"]),
                            vendor=vendor_name,
                            item_description=str(row.get("item_description", f"Expense at {vendor_name}")),
                            amount=amt,
                            category=str(row.get("category", "misc")),
                            payment_mode=str(row.get("payment_mode", "UPI")),
                            tax=round(amt * 0.05, 2),
                            is_anomaly=is_anom,
                            anomaly_score=0.85 if is_anom else 0.05,
                            risk_severity=severity,
                            risk_reasons=reasons,
                            raw_text=f"{vendor_name} {row.get('item_description', '')} Total: Rs.{amt}",
                        )
                    )

                db.bulk_save_objects(records)
                db.commit()
                print(f"[Database] Initialized and seeded {len(records):,} records into SQLite: {SQLITE_DB_PATH}")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
