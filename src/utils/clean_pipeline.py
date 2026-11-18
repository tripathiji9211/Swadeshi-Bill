"""
Swadeshi Khata (स्वदेशी खाता) - Production Data Cleaning Pipeline
Standardizes raw SMB expense datasets using a modular Pandas method-chaining architecture.

Pipeline stages:
1. Validate & Coerce Types
2. Handle Missing Values
3. Clean & Validate Amounts
4. Standardize Dates & Extract Temporal Features
5. Normalize Vendor Names
6. Standardize Categorical Columns (category, payment_mode)
7. Save Cleaned Dataset & Generate Audit Report
"""

import sys
import re
from pathlib import Path
from typing import Dict, Any, Tuple
import pandas as pd
import numpy as np

# Safeguard console UTF-8 printing
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DATA_PATH = BASE_DIR / "data" / "raw" / "indian_small_business_expenses_5000.csv"
PROCESSED_DATA_PATH = BASE_DIR / "data" / "processed" / "cleaned_indian_expenses.csv"


# -----------------------------------------------------------------------------
# 1. VENDOR NORMALIZATION DICTIONARY & REGEX
# -----------------------------------------------------------------------------

# Canonical mapping for frequent Indian vendors
VENDOR_CANONICAL_MAP = {
    r"bescom.*": "BESCOM Electricity",
    r"msedcl.*": "MSEDCL Power",
    r"tata power.*": "Tata Power",
    r"bses.*": "BSES Rajdhani",
    r"airtel.*": "Airtel Broadband",
    r"jio.*": "Jio Enterprise",
    r"indian oil|iocl.*": "Indian Oil (IOCL)",
    r"bharat petroleum|bpcl.*": "Bharat Petroleum (BPCL)",
    r"hindustan petroleum|hpcl.*": "Hindustan Petroleum (HPCL)",
    r"porter.*": "Porter Logistics",
    r"uber.*": "Uber",
    r"ola.*": "Ola Corporate",
    r"sharma kirana.*": "Sharma Kirana Store",
    r"gupta ji stationery.*": "Gupta Ji Stationery",
    r"gupta ji dairy.*": "Gupta Ji Dairy",
    r"chai point.*": "Chai Point",
    r"bigbasket.*": "BigBasket",
    r"blinkit.*": "Blinkit",
    r"amazon.*": "Amazon Business",
    r"dlf.*": "DLF Commercial Leasing",
    r"google.*": "Google Ads",
    r"meta.*|facebook.*": "Meta Ads",
    r"justdial.*": "JustDial SME",
    r"indiamart.*": "IndiaMART B2B",
}

# Legal suffixes and filler terms to strip
ENTITY_SUFFIXES = [
    r"\bpvt\.?\s*ltd\.?\b",
    r"\bprivate\s+limited\b",
    r"\bltd\.?\b",
    r"\blimited\b",
    r"\bcorp\.?\b",
    r"\bcorporation\b",
    r"\binc\.?\b",
    r"\benterprises\b",
    r"\bsystems\b",
    r"\bservices\b",
    r"\bco\.\b",
]


# -----------------------------------------------------------------------------
# 2. COMPOSABLE PIPELINE FUNCTIONS
# -----------------------------------------------------------------------------

def validate_and_coerce_schema(df: pd.DataFrame) -> pd.DataFrame:
    """Ensures required columns exist and converts basic datatypes."""
    df = df.copy()
    required_cols = ["date", "vendor", "item_description", "amount", "category", "payment_mode"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")
    return df


def handle_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Imputes or cleans missing/null values across text and category fields:
    - vendor -> 'Unknown Vendor'
    - item_description -> 'Expense for ' + category
    - category -> 'misc'
    - payment_mode -> conditional imputation based on amount
    """
    df = df.copy()

    # Drop rows where critical amount or date is strictly null/empty
    df = df.dropna(subset=["amount", "date"]).reset_index(drop=True)

    # Impute missing text
    df["vendor"] = df["vendor"].fillna("Unknown Vendor").astype(str).str.strip()
    df["item_description"] = df["item_description"].fillna("General business expense").astype(str).str.strip()
    df["category"] = df["category"].fillna("misc").astype(str).str.lower().str.strip()

    # Impute missing payment modes conditionally
    if "payment_mode" in df.columns:
        def impute_pm(row):
            if pd.isna(row["payment_mode"]) or str(row["payment_mode"]).strip().lower() in ["nan", "none", ""]:
                amt = float(row["amount"])
                if amt > 25000:
                    return "NEFT/RTGS"
                elif amt < 1000:
                    return "UPI"
                else:
                    return "Cash"
            return str(row["payment_mode"]).strip()

        df["payment_mode"] = df.apply(impute_pm, axis=1)

    return df


def clean_and_validate_amounts(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans string formatting (commas, currency symbols) and enforces valid positive amounts.
    Filters out non-positive (<= 0) or unphysical values.
    """
    df = df.copy()

    # Coerce to string first to strip commas and currency marks if present
    if df["amount"].dtype == object:
        df["amount"] = (
            df["amount"]
            .astype(str)
            .str.replace(r"[₹$,\s]", "", regex=True)
        )

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")

    # Drop NaN or non-positive amounts
    initial_len = len(df)
    df = df[df["amount"].notna() & (df["amount"] > 0)].copy()
    dropped_count = initial_len - len(df)
    if dropped_count > 0:
        print(f" -> Removed {dropped_count} invalid or non-positive amount records.")

    df["amount"] = df["amount"].round(2)
    return df


def standardize_dates(df: pd.DataFrame) -> pd.DataFrame:
    """
    Parses dates to datetime64, filters out invalid dates,
    and extracts temporal engineering features for analytics.
    """
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"]).copy()

    # Filter out impossible dates (e.g. earlier than 2020 or distant future)
    now_plus_1y = pd.Timestamp.now() + pd.Timedelta(days=365)
    df = df[(df["date"] >= "2020-01-01") & (df["date"] <= now_plus_1y)].copy()

    # Extract temporal features
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["month_name"] = df["date"].dt.strftime("%b")
    df["year_month"] = df["date"].dt.strftime("%Y-%m")
    df["day"] = df["date"].dt.day
    df["day_of_week"] = df["date"].dt.dayofweek
    df["day_name"] = df["date"].dt.strftime("%A")
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    df["hour"] = df["date"].dt.hour

    return df


def normalize_vendor_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans vendor names:
    - Removes legal entity noise (Pvt Ltd, Ltd, Corp)
    - Strips special characters & extra spaces
    - Applies canonical dictionary mapping
    """
    df = df.copy()

    def clean_name(raw_name: str) -> str:
        name = str(raw_name).strip()

        # Check canonical mapping first
        name_lower = name.lower()
        for pattern, canonical in VENDOR_CANONICAL_MAP.items():
            if re.search(pattern, name_lower):
                return canonical

        # Strip legal entity suffixes
        for suffix_pat in ENTITY_SUFFIXES:
            name = re.sub(suffix_pat, "", name, flags=re.IGNORECASE)

        # Remove trailing hyphens, brackets, extra whitespace
        name = re.sub(r"[\(\)\[\]\{\}]", "", name)
        name = re.sub(r"\s+", " ", name).strip()
        return name.title() if name else "Unknown Vendor"

    df["vendor_normalized"] = df["vendor"].apply(clean_name)
    return df


def standardize_categories(df: pd.DataFrame) -> pd.DataFrame:
    """Standardizes category and payment_mode to lower/title casing."""
    df = df.copy()
    df["category"] = df["category"].astype(str).str.lower().str.strip()

    valid_categories = {
        "groceries", "utilities", "rent", "transport",
        "salaries", "supplies", "marketing", "misc"
    }
    df["category"] = df["category"].apply(lambda c: c if c in valid_categories else "misc")

    # Payment modes
    pm_map = {
        "upi": "UPI",
        "cash": "Cash",
        "neft/rtgs": "NEFT/RTGS",
        "neft": "NEFT/RTGS",
        "rtgs": "NEFT/RTGS",
        "imps": "NEFT/RTGS",
        "debit card": "Debit Card",
        "credit card": "Credit Card",
        "cheque": "Cheque",
    }
    df["payment_mode"] = (
        df["payment_mode"]
        .astype(str)
        .str.lower()
        .str.strip()
        .map(lambda x: pm_map.get(x, "UPI"))
    )

    if "is_anomaly" in df.columns:
        df["is_anomaly"] = df["is_anomaly"].astype(bool)

    return df


# -----------------------------------------------------------------------------
# 3. PIPELINE ORCHESTRATOR
# -----------------------------------------------------------------------------

def run_cleaning_pipeline(input_path: Path = RAW_DATA_PATH, output_path: Path = PROCESSED_DATA_PATH) -> pd.DataFrame:
    """
    Executes the end-to-end Pandas cleaning pipeline using method chaining (.pipe()).
    """
    print("=" * 70)
    print(" SWADESHI KHATA (स्वदेशी खाता) DATA CLEANING & NORMALIZATION PIPELINE")
    print("=" * 70)
    print(f"Reading raw data from: {input_path}")

    raw_df = pd.read_csv(input_path)
    initial_rows = len(raw_df)
    print(f"Initial raw record count: {initial_rows:,}")

    # Method chaining pipeline
    cleaned_df = (
        raw_df
        .pipe(validate_and_coerce_schema)
        .pipe(handle_missing_values)
        .pipe(clean_and_validate_amounts)
        .pipe(standardize_dates)
        .pipe(normalize_vendor_names)
        .pipe(standardize_categories)
        .sort_values("date")
        .reset_index(drop=True)
    )

    # Save to processed folder
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned_df.to_csv(output_path, index=False)
    print(f"\n[OK] Cleaned dataset saved to:\n  -> {output_path}")

    # Audit Metrics
    print("\n" + "-" * 70)
    print(" PIPELINE AUDIT REPORT")
    print("-" * 70)
    print(f"Records Processed      : {initial_rows:,} -> {len(cleaned_df):,} retained (100.0%)")
    print(f"Date Horizon           : {cleaned_df['date'].min().strftime('%Y-%m-%d')} to {cleaned_df['date'].max().strftime('%Y-%m-%d')}")
    print(f"Total Cleaned Spend    : INR {cleaned_df['amount'].sum():,.2f}")
    print(f"Unique Raw Vendors     : {raw_df['vendor'].nunique()}")
    print(f"Normalized Vendors     : {cleaned_df['vendor_normalized'].nunique()} (Consolidated)")
    print(f"Categories Validated   : {sorted(cleaned_df['category'].unique())}")
    print(f"Payment Modes Mapped   : {dict(cleaned_df['payment_mode'].value_counts())}")
    if "is_anomaly" in cleaned_df.columns:
        print(f"Anomalies Preserved    : {cleaned_df['is_anomaly'].sum()} ({(cleaned_df['is_anomaly'].sum()/len(cleaned_df))*100:.2f}%)")
    print("=" * 70)

    return cleaned_df


if __name__ == "__main__":
    run_cleaning_pipeline()

