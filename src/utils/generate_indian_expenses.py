"""
Indian Small-Business Expense Dataset Generator
Generates a realistic synthetic dataset of 5,000 Indian SMB financial transactions
with authentic vendor names, Hinglish/abbreviated line items, seasonality,
recurring monthly bills, and 3% injected anomalies.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path
import os
import sys

# Windows console encoding safeguard
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Set seeds for reproducibility
np.random.seed(42)
random.seed(42)

# Target directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = BASE_DIR / "data" / "raw"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_FILE = OUTPUT_DIR / "indian_small_business_expenses_5000.csv"

# -----------------------------------------------------------------------------
# DOMAIN KNOWLEDGE BASES: INDIAN SMB ECOSYSTEM
# -----------------------------------------------------------------------------

CATEGORIES = [
    "groceries",
    "utilities",
    "rent",
    "transport",
    "salaries",
    "supplies",
    "marketing",
    "misc",
]

PAYMENT_MODES = [
    "UPI",
    "Cash",
    "NEFT/RTGS",
    "Debit Card",
    "Credit Card",
    "Cheque",
]

# Realistic Vendors across Indian metro & tier-2/3 business districts
VENDORS_BY_CATEGORY = {
    "groceries": [
        "Sharma Kirana & General Store",
        "Aapka Supermarket",
        "Patanjali Arogya Kendra",
        "DMart Ready Wholesale",
        "Chai Point & Snacks",
        "Gupta Ji Dairy & Bakery",
        "BigBasket B2B Instamart",
        "Blinkit Commerce Pvt Ltd",
        "Aggarwal Sweets & Namkeen",
        "Laxmi Narayan Provision Store",
    ],
    "utilities": [
        "BESCOM Electricity Bengaluru",
        "MSEDCL Power Supply Mumbai",
        "Tata Power DDL",
        "BSES Rajdhani Delhi",
        "Airtel Broadband Fiber Ltd",
        "JioFiber Enterprise Office",
        "Indraprastha Gas Limited (IGL)",
        "Mahanagar Gas Ltd",
        "Municipal Water Supply Board",
        "Commercial RO Water Delivery",
    ],
    "rent": [
        "Smt. Kanta Devi (Landlord)",
        "Rajesh Kumar Gupta (Shop Owner)",
        "DLF Commercial Space Leasing",
        "Godown Bhada - Shri Ram Complex",
        "Oyo Workspaces / Coworking",
        "Brigade Gateway Office Space",
        "Sardar Manjit Singh (Showroom Lease)",
    ],
    "transport": [
        "Indian Oil Petrol Pump (IOCL)",
        "Bharat Petroleum Corp (BPCL)",
        "Hindustan Petroleum (HPCL)",
        "Porter Local Tempo Services",
        "Uber India Systems Pvt Ltd",
        "Ola Corporate Transit",
        "VRL Logistics Parcel Dept",
        "TCI Freight Cargo",
        "Local Auto Rickshaw Union",
        "Delhivery Surface Express",
    ],
    "salaries": [
        "Ramesh Kumar (Store Helper)",
        "Sunil Verma (Delivery Boy)",
        "Pooja Sharma (Accountant)",
        "Mohammad Aslam (Office Boy)",
        "Dinesh Chand (Driver)",
        "Pawan Singh (Sales Exec)",
        "Sunita Bai (Cleaning & Pantry)",
        "Vikram Sethi (Floor Manager)",
    ],
    "supplies": [
        "Gupta Ji Stationery & Xerox",
        "National Packaging Mart",
        "Balaji Polybags & Packing Rolls",
        "Amazon Business India",
        "Goyal Paper Mart (Chawri Bazar)",
        "Printo Retail Printing Ltd",
        "Khosla Cartridge Refilling",
        "Surya Cleaning Chemicals & Mops",
    ],
    "marketing": [
        "Google India Ads (PPC)",
        "Meta Platforms Ireland (FB/Insta)",
        "JustDial Local SME Listings",
        "Virender Flex Banner & Neon Sign",
        "IndiaMART InterMESH B2B",
        "Prabhat Daily Newspaper (Pamphlet insert)",
        "Star Digital WhatsApp Bulk SMS",
        "Canva Pro Annual India",
    ],
    "misc": [
        "Pandit Ji Pooja Samagri Store",
        "Urban Company Office Cleaning",
        "Sharma AC Repair & Service",
        "Chai-Paani & Petty Cash Peti",
        "Municipal Trade License Renewal",
        "Chubb Lock & Key Maker",
        "Quick Pest Control Services",
        "Diwali Gift Hampers & Dryfruits",
    ],
}

# Messy, authentic item descriptions with Hinglish, abbreviations, and real-world typos
DESCRIPTIONS_BY_CATEGORY = {
    "groceries": [
        ("Office chai patti, sugar & dairy milk powder", 350, 1200),
        ("Monthly pantry ration: biscuits, namkeen, rusk packets", 1200, 3500),
        ("Client meeting snacks samosa & cold drinks", 250, 850),
        ("Coffee sachets, green tea bag box & paper cups", 450, 1400),
        ("Staff evening refreshments samosa jalebi", 180, 600),
        ("Mineral water 20L jars x 6 cans delivery", 480, 960),
        ("Pantry masale, nimbu, sugar for dukan", 220, 650),
        ("Diwali celebration mithai dabba for team", 2500, 8500),
        ("urgent milk packets & ginger for tea stall", 120, 300),
        ("grocerries & snacks for client demo day", 800, 2200),  # typo
    ],
    "utilities": [
        ("Commercial bijli bill payment (main office meter)", 4500, 18500),
        ("Godown electricity bill online NEFT", 2200, 7500),
        ("Airtel high-speed broadband monthly fiber bill", 1199, 2399),
        ("Office Jio Wi-Fi dongle recharge 3 months", 899, 1499),
        ("Commercial PNG gas connection billing", 950, 2800),
        ("Municipal drinking water tanker charges (summer)", 1200, 3200),
        ("electrcity bill paid via GPay", 3500, 12000),  # typo
        ("monthly internet bill broadband inv#902", 1099, 2199),  # abbrev
    ],
    "rent": [
        ("Main showroom monthly rent for shop #4", 35000, 85000),
        ("Basement storage godown rent advance", 15000, 35000),
        ("Office cabin lease payment (via cheque)", 25000, 60000),
        ("dukaan rent paid for current month", 30000, 70000),
        ("godown bhada month end settlement", 12000, 28000),
        ("monthly rent shop room + maintenance charges", 28000, 65000),
    ],
    "transport": [
        ("Delivery van diesel refill 35 litres (IOCL)", 2800, 4200),
        ("Bike petrol fuel reimbursement for sales staff", 300, 950),
        ("Porter tempo bhada for raw material transport", 850, 2500),
        ("Uber cab ride for client meeting at CyberCity", 380, 1250),
        ("VRL freight parcel charges outstation delivery", 650, 2800),
        ("Auto bhada maal delivery to Chandni Chowk", 250, 650),
        ("transpot & loading unloading charges paid", 500, 1800),  # typo
        ("toll tax fastag recharge on car", 1000, 2000),
    ],
    "salaries": [
        ("Monthly helper salary payment via NEFT", 12000, 18000),
        ("Store assistant staff salary for month", 15000, 25000),
        ("Accountant part-time retainership fees", 8000, 16000),
        ("staff ko advance diya cash salary deduction", 2000, 6000),
        ("Delivery boy monthly wages + incentive", 14000, 22000),
        ("Sunita bai cleaning charges monthly", 3500, 6500),
        ("Overtime cash incentive for festival rush", 1500, 4500),
        ("adv sal paid for emergency hospital", 3000, 8000),  # abbrev
    ],
    "supplies": [
        ("Corrugated packing boxes 3-ply 100 pcs bundle", 1800, 5200),
        ("Thermal receipt rolls 80mm 50 rolls carton", 950, 2200),
        ("A4 JK Copier paper 5 reams box + pens", 1250, 2400),
        ("Bubble wrap roll 100 meters & brown packing tape 12 rolls", 1100, 2800),
        ("Printer ink cartridge refil black + color", 650, 1600),  # typo
        ("Dukan barcode label rolls & price tags", 750, 1900),
        ("staionery items file folder stapler clips", 400, 1100),  # typo
        ("cleaning floor lizol duster broom phenyl", 550, 1450),
    ],
    "marketing": [
        ("Google Search Ads click campaign for local customers", 3500, 14000),
        ("Instagram & FB boost post Diwali festive sale", 2500, 9500),
        ("Printing 5,000 double-sided paper pamphlets distribution", 2200, 5500),
        ("Flex board vinyl printing for dukan entrance", 1800, 4500),
        ("IndiaMART SME verified supplier listing renewal", 8500, 24000),
        ("Newspaper hawker insert charges (Sunday edition)", 1200, 2800),
        ("bulk SMS marketing gateway 10k sms pack", 1500, 3500),
        ("mktg ad campaign recharge online", 2000, 7500),  # abbrev
    ],
    "misc": [
        ("Office split AC servicing & gas recharge (summer)", 1800, 4500),
        ("Pooja samagri, agarbatti, flowers & havan samagri", 450, 1500),
        ("Lock change & conference room handle repair", 350, 950),
        ("Pest control treatment for warehouse bugs", 1600, 3200),
        ("Diwali gift boxes for key corporate clients", 4500, 16000),
        ("Municipal trade license fee & challan", 2500, 6500),
        ("chai-paani petty cash daily balance top-up", 500, 1500),
        ("maintanance & electric wiring fix charge", 850, 2200),  # typo
    ],
}


def get_payment_mode_for_category(category: str, amount: float) -> str:
    """Assigns realistic Indian payment methods based on transaction value and category."""
    if category == "rent":
        return random.choices(["NEFT/RTGS", "Cheque", "UPI"], weights=[0.60, 0.30, 0.10])[0]
    elif category == "salaries":
        return random.choices(["NEFT/RTGS", "UPI", "Cash"], weights=[0.55, 0.30, 0.15])[0]
    elif amount < 500:
        return random.choices(["UPI", "Cash"], weights=[0.75, 0.25])[0]
    elif amount > 25000:
        return random.choices(["NEFT/RTGS", "Credit Card", "Cheque"], weights=[0.55, 0.30, 0.15])[0]
    else:
        return random.choices(PAYMENT_MODES, weights=[0.48, 0.18, 0.14, 0.08, 0.08, 0.04])[0]


def generate_dataset(total_records: int = 5000) -> pd.DataFrame:
    """
    Synthesizes 5,000 realistic Indian SMB expense records with:
    - 8 categories
    - Seasonal variations (Diwali in Oct/Nov, Summer in May/June, Year-end in March)
    - Monthly recurring schedules (rent on 1-5th, salaries on 1-7th, utilities on 10-15th)
    - Realistic INR amounts
    - Exactly 3% injected anomalies (150 rows)
    """
    records = []
    
    # 2-Year timeframe: 2024-01-01 to 2025-12-31
    start_date = datetime(2024, 1, 1, 9, 0, 0)
    total_days = 730  # 2 years

    # Target: 97% normal records (4,850) + 3% anomalies (150) = 5,000
    target_anomalies = int(total_records * 0.03)  # 150
    target_normals = total_records - target_anomalies  # 4,850

    # Category frequency distribution in typical retail/trading/service SMB
    # Groceries/Pantry (frequent), Transport (frequent), Supplies, Utilities, etc.
    cat_weights = {
        "groceries": 0.20,
        "transport": 0.22,
        "supplies": 0.18,
        "utilities": 0.10,
        "salaries": 0.08,
        "marketing": 0.08,
        "misc": 0.08,
        "rent": 0.06,
    }

    # Generate normal records
    for i in range(target_normals):
        # Pick date with seasonal weighting
        day_offset = random.randint(0, total_days)
        txn_date = start_date + timedelta(days=day_offset, hours=random.randint(0, 11), minutes=random.randint(0, 59))
        month = txn_date.month
        day = txn_date.day

        # Select category, with adjustments for recurring timing
        if day in [1, 2, 3, 4, 5] and random.random() < 0.35:
            category = random.choice(["rent", "salaries", "utilities"])
        else:
            category = random.choices(list(cat_weights.keys()), weights=list(cat_weights.values()), k=1)[0]

        vendor = random.choice(VENDORS_BY_CATEGORY[category])
        desc_tuple = random.choice(DESCRIPTIONS_BY_CATEGORY[category])
        item_desc = desc_tuple[0]
        min_p, max_p = desc_tuple[1], desc_tuple[2]

        # Base amount
        amount = round(random.uniform(min_p, max_p), 2)

        # Apply Indian Business Seasonality multipliers
        # 1. Diwali Festive Season (October & November): Marketing, Packing supplies, Sweets/Bonus surge
        if month in [10, 11]:
            if category in ["marketing", "supplies", "groceries"]:
                amount *= random.uniform(1.3, 1.8)
            elif category == "misc" and "pooja" in item_desc.lower() or "gift" in item_desc.lower():
                amount *= random.uniform(1.5, 2.2)

        # 2. Peak Summer (May & June): Electricity & cooling bills surge
        if month in [5, 6] and category == "utilities" and "bijli" in item_desc.lower() or "meter" in item_desc.lower():
            amount *= random.uniform(1.4, 1.9)

        # 3. Financial Year-End Closing (March): Audit, accounting, and trade taxes
        if month == 3 and category in ["salaries", "misc"]:
            amount *= random.uniform(1.15, 1.35)

        amount = round(amount, 2)
        payment_mode = get_payment_mode_for_category(category, amount)

        records.append({
            "date": txn_date.strftime("%Y-%m-%d %H:%M:%S"),
            "vendor": vendor,
            "item_description": item_desc,
            "amount": amount,
            "category": category,
            "payment_mode": payment_mode,
            "is_anomaly": False,
        })

    df_normal = pd.DataFrame(records)

    # -------------------------------------------------------------------------
    # INJECT EXACTLY 3% (150) REALISTIC INDIAN BUSINESS ANOMALIES
    # -------------------------------------------------------------------------
    anomaly_records = []

    # Scenario A: Accidental Duplicate UPI / Card Charges (50 records)
    # The same vendor and exact amount billed within 10 minutes to 36 hours
    dup_samples = df_normal.sample(n=50, random_state=101)
    for _, orig in dup_samples.iterrows():
        orig_dt = datetime.strptime(orig["date"], "%Y-%m-%d %H:%M:%S")
        dup_dt = orig_dt + timedelta(minutes=random.randint(5, 1440))
        anomaly_records.append({
            "date": dup_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "vendor": orig["vendor"],
            "item_description": orig["item_description"] + " (duplicate transaction / retry)",
            "amount": orig["amount"],
            "category": orig["category"],
            "payment_mode": orig["payment_mode"],
            "is_anomaly": True,
        })

    # Scenario B: 5x to 10x Fat-Finger Data Entry / Amount Spikes (55 records)
    # e.g., ₹1,200 tea order typed as ₹12,000, or ₹2,500 broadband as ₹25,000
    spike_candidates = df_normal[df_normal["category"].isin(["groceries", "transport", "utilities", "supplies"])].sample(n=55, random_state=202)
    for _, orig in spike_candidates.iterrows():
        multiplier = round(random.uniform(5.5, 10.2), 1)
        spiked_amount = round(orig["amount"] * multiplier, 2)
        spike_dt = datetime.strptime(orig["date"], "%Y-%m-%d %H:%M:%S") + timedelta(days=random.randint(1, 5))
        anomaly_records.append({
            "date": spike_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "vendor": orig["vendor"],
            "item_description": orig["item_description"],
            "amount": spiked_amount,
            "category": orig["category"],
            "payment_mode": orig["payment_mode"],
            "is_anomaly": True,
        })

    # Scenario C: Suspicious Off-Hours Large Round-Sum Payouts & Travel Spikes (45 records)
    # e.g., ₹45,000 cash for auto rickshaw, or ₹85,000 for groceries at midnight
    midnight_vendors = [
        ("Local Auto Rickshaw Union", "transport", "Auto rickshaw charges local transit", 48000.0, "Cash"),
        ("Chai Point & Snacks", "groceries", "Evening tea and dryfruit hampers", 65000.0, "UPI"),
        ("National Packaging Mart", "supplies", "Emergency packaging material cash order", 95000.0, "Cash"),
        ("Sunil Verma (Delivery Boy)", "salaries", "Delivery incentive bonus transfer", 75000.0, "UPI"),
        ("Sharma Kirana & General Store", "groceries", "Ration wholesale bags purchase", 82000.0, "Cash"),
    ]

    for j in range(45):
        vendor_choice = midnight_vendors[j % len(midnight_vendors)]
        random_day = random.randint(10, total_days - 10)
        # Billed between 11:30 PM and 3:30 AM
        off_hour_dt = start_date + timedelta(days=random_day, hours=random.choice([23, 0, 1, 2, 3]), minutes=random.randint(10, 50))
        amt = vendor_choice[3] + random.randint(0, 8) * 1000.0
        anomaly_records.append({
            "date": off_hour_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "vendor": vendor_choice[0],
            "item_description": vendor_choice[2],
            "amount": amt,
            "category": vendor_choice[1],
            "payment_mode": vendor_choice[4],
            "is_anomaly": True,
        })

    # Combine normal and anomaly sets
    df_anomalies = pd.DataFrame(anomaly_records)
    full_df = pd.concat([df_normal, df_anomalies], ignore_index=True)

    # Sort chronologically by date
    full_df["dt_parsed"] = pd.to_datetime(full_df["date"])
    full_df = full_df.sort_values("dt_parsed").drop(columns=["dt_parsed"]).reset_index(drop=True)

    # Verify exact count
    assert len(full_df) == total_records, f"Expected {total_records}, got {len(full_df)}"
    return full_df


if __name__ == "__main__":
    print("=" * 70)
    print(" GENERATING REALISTIC INDIAN SMB EXPENSE DATASET (5,000 RECORDS)")
    print("=" * 70)

    df = generate_dataset(total_records=5000)

    # Save to file
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\n[OK] Successfully saved dataset to:\n  -> {OUTPUT_FILE}")

    # Also save to data/expenses_history.csv to update Swadeshi Khata (स्वदेशी खाता)'s backend ledger
    backend_db = BASE_DIR / "data" / "expenses_history.csv"
    # Format for Swadeshi Khata (स्वदेशी खाता) ledger compatibility
    ledger_df = df.copy()
    ledger_df["id"] = [f"IN-REC-{i+1:05d}" for i in range(len(ledger_df))]
    ledger_df["merchant"] = ledger_df["vendor"]
    ledger_df["receipt_text"] = ledger_df["vendor"] + " - " + ledger_df["item_description"]
    ledger_df["tax"] = (ledger_df["amount"] * 0.18).round(2)  # Standard 18% GST
    ledger_df["risk_severity"] = np.where(ledger_df["is_anomaly"], "HIGH", "LOW")
    ledger_df["risk_reasons"] = np.where(ledger_df["is_anomaly"], "Flagged: Unusual amount spike / duplicate billing", "")
    ledger_df.to_csv(backend_db, index=False)
    print(f"[OK] Synced with Swadeshi Khata (स्वदेशी खाता) ledger at:\n  -> {backend_db}")

    # Print summary statistics
    print("\n" + "-" * 70)
    print(" DATASET SUMMARY & METRICS")
    print("-" * 70)
    print(f"Total Records     : {len(df):,}")
    print(f"Date Range        : {df['date'].min()} to {df['date'].max()}")
    print(f"Total Expenditure : ₹{df['amount'].sum():,.2f}")
    print(f"Average Expense   : ₹{df['amount'].mean():,.2f}")
    print(f"Median Expense    : ₹{df['amount'].median():,.2f}")
    print(f"Max Expense       : ₹{df['amount'].max():,.2f}")

    anom_count = df["is_anomaly"].sum()
    anom_pct = (anom_count / len(df)) * 100
    print(f"Injected Anomalies: {anom_count:,} ({anom_pct:.2f}%)")

    print("\n[Category Breakdown]")
    cat_counts = df["category"].value_counts()
    cat_spend = df.groupby("category")["amount"].sum()
    for cat in cat_counts.index:
        print(f" - {cat:<12} : {cat_counts[cat]:>4} records | Total: ₹{cat_spend[cat]:>12,.2f} | Avg: ₹{df[df['category']==cat]['amount'].mean():>8,.2f}")

    print("\n[Payment Modes]")
    print(df["payment_mode"].value_counts().to_string())

    print("\n[Sample 5 Records]")
    print(df[["date", "vendor", "category", "amount", "payment_mode", "is_anomaly"]].head(5).to_string())
    print("=" * 70)
