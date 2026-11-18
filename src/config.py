"""
ReceiptRadar Central Configuration
"""

from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODELS_DIR = DATA_DIR / "models"
SAMPLE_RECEIPTS_DIR = DATA_DIR / "sample_receipts"
EXPENSES_DB_PATH = DATA_DIR / "expenses_history.csv"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

CLASSIFIER_MODEL_PATH = MODELS_DIR / "category_classifier.joblib"
ANOMALY_MODEL_PATH = MODELS_DIR / "anomaly_detector.joblib"

from dotenv import load_dotenv

# Load variables from .env
load_dotenv(PROJECT_ROOT / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

EXPENSE_CATEGORIES = [
    "groceries",
    "utilities",
    "rent",
    "transport",
    "salaries",
    "supplies",
    "marketing",
    "misc",
]

