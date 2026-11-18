"""
Synthetic Data Generation & Sample Receipts
"""

from src.config import EXPENSES_DB_PATH, SAMPLE_RECEIPTS_DIR, EXPENSE_CATEGORIES
from backend.app.utils.sample_data import generate_synthetic_history, create_sample_receipt_image, generate_sample_receipt_suite


def ensure_sample_database():
    if not EXPENSES_DB_PATH.exists():
        df = generate_synthetic_history(n_records=700, days_back=180)
        df.to_csv(EXPENSES_DB_PATH, index=False)
    return EXPENSES_DB_PATH
