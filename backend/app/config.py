"""
ReceiptRadar Configuration Settings
Defines file paths, model paths, API settings, and business rule constants.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"
SAMPLE_RECEIPTS_DIR = DATA_DIR / "sample_receipts"
EXPENSES_DB_PATH = DATA_DIR / "expenses_history.csv"

# Ensure runtime directories exist
MODELS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)

# Model Artifact Paths
CLASSIFIER_MODEL_PATH = MODELS_DIR / "category_classifier.joblib"
ANOMALY_MODEL_PATH = MODELS_DIR / "anomaly_detector.joblib"

# API & LLM Settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Standard Business Expense Categories
EXPENSE_CATEGORIES = [
    "Office Supplies & Software",
    "Meals & Entertainment",
    "Travel & Fuel",
    "Utilities & Rent",
    "Inventory & Raw Materials",
    "Marketing & Advertising",
    "Professional & Legal Services",
    "Repairs & Maintenance",
]

# Business Audit Heuristic Thresholds
ANOMALY_SETTINGS = {
    "high_value_percentile": 95,
    "z_score_threshold": 2.5,
    "duplicate_window_hours": 48,
    "weekend_flag_enabled": True,
    "split_transaction_threshold": 950.0,  # Below $1000 approval limit
}

