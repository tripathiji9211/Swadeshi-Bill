"""
Sample Data and Synthetic Dataset Generator for ReceiptRadar
Generates realistic small business financial transactions, synthetic receipts,
and labeled training data for category classification and anomaly detection.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import uuid

from backend.app.config import (
    EXPENSES_DB_PATH,
    SAMPLE_RECEIPTS_DIR,
    EXPENSE_CATEGORIES,
)

# Realistic vendors and typical item templates per category
VENDOR_TEMPLATES = {
    "Office Supplies & Software": [
        ("Staples", ["Printer Paper Box", "Gel Pens 12pk", "Desk Organizer", "Ergonomic Mouse", "Whiteboard Markers"], (25.0, 180.0)),
        ("Amazon Business", ["Standing Desk Mat", "USB-C Hub", "HDMI Cables 3pk", "Label Printer Tape"], (35.0, 220.0)),
        ("Slack Technologies", ["Slack Pro Monthly Subscription - 10 seats"], (85.0, 150.0)),
        ("Google Workspace", ["Business Standard 12 users monthly plan"], (144.0, 288.0)),
        ("Adobe Systems", ["Creative Cloud All Apps Monthly License"], (79.99, 159.98)),
        ("Best Buy", ["Logitech 4K Webcam", "Mechanical Keyboard", "Monitor Arm Mount"], (90.0, 350.0)),
    ],
    "Meals & Entertainment": [
        ("Starbucks", ["Caramel Macchiato", "Ham & Swiss Croissant", "Cold Brew 4pk", "Client Morning Coffee"], (12.0, 48.0)),
        ("Chipotle Mexican Grill", ["Burrito Bowls x3", "Chips & Guacamole", "Bottled Drinks"], (28.0, 65.0)),
        ("Ruth's Chris Steak House", ["Client Dinner: Ribeye, Sea Bass, Cabernet Sauvignon, Dessert Trio"], (250.0, 680.0)),
        ("The Capital Grille", ["Quarterly Partner Dinner: Dry Aged NY Strip, Wine Pairing"], (320.0, 850.0)),
        ("Panera Bread", ["Catering Box: Assorted Sandwiches and Salad for 8"], (95.0, 185.0)),
        ("Uber Eats", ["Team Late Night Pizza Order", "Sodas 6pk"], (45.0, 120.0)),
    ],
    "Travel & Fuel": [
        ("Shell Oil", ["Regular Unleaded 14.5 Gallons", "Windshield Washer Fluid"], (40.0, 75.0)),
        ("Chevron", ["Supreme Gasoline 18.2 Gallons"], (45.0, 85.0)),
        ("Delta Air Lines", ["Roundtrip Flight SFO to ORD - Client Onsite Visit"], (380.0, 750.0)),
        ("United Airlines", ["Direct Flight JFK to SFO Economy Plus"], (420.0, 820.0)),
        ("Marriott Hotels", ["2 Nights Deluxe King Room - Tech Conference"], (360.0, 850.0)),
        ("Uber Technologies", ["Ride from Airport to Downtown Hotel", "Client Office Transit"], (32.0, 95.0)),
    ],
    "Utilities & Rent": [
        ("Pacific Gas & Electric", ["Commercial Electric & Gas Service - Monthly Billing"], (280.0, 650.0)),
        ("Comcast Business", ["Gigabit Fiber Internet & Backup LTE Service"], (180.0, 320.0)),
        ("City Water & Sewer", ["Municipal Commercial Utility Service"], (80.0, 190.0)),
        ("WeWork Management", ["Dedicated 4-Person Private Office Monthly Rent"], (1600.0, 2800.0)),
    ],
    "Inventory & Raw Materials": [
        ("Uline Shipping Supplies", ["Corrugated Cardboard Boxes 200pk", "Bubble Wrap 500ft", "Packing Tape 24 Rolls"], (220.0, 750.0)),
        ("Fastenal Industrial", ["Stainless Steel Fasteners", "Drill Bit Set", "Industrial Cleaner 5gal"], (150.0, 620.0)),
        ("Grainger Supplies", ["Warehouse Storage Shelving Unit", "Heavy Duty Casters 8pk"], (310.0, 950.0)),
    ],
    "Marketing & Advertising": [
        ("Google Ads", ["PPC Search Campaign - Small Business Software Leads"], (350.0, 1200.0)),
        ("Meta Advertising", ["Instagram & Facebook Retargeting Ads Campaign"], (250.0, 850.0)),
        ("LinkedIn Ads", ["Sponsored Content B2B Lead Gen Ads"], (300.0, 900.0)),
        ("Canva Pro", ["Annual Graphic Design Team Subscription"], (119.99, 119.99)),
    ],
    "Professional & Legal Services": [
        ("Baker & McKenzie LLP", ["Legal Consultation: Vendor Contract Review & NDA Drafting"], (650.0, 1800.0)),
        ("H&R Block Business Advisors", ["Quarterly Corporate Tax Prep & Payroll Filing"], (450.0, 1200.0)),
        ("BDO Consulting", ["Financial Advisory & Accounting Audit Review"], (800.0, 2200.0)),
    ],
    "Repairs & Maintenance": [
        ("Commercial HVAC Solutions", ["Biannual Office AC Filter Replacement & Coil Cleaning"], (220.0, 580.0)),
        ("ServiceMaster Clean", ["Monthly Office Deep Cleaning & Sanitation"], (180.0, 420.0)),
        ("Mr. Handyman", ["Conference Room Door Lock Repair & Drywall Touchup"], (140.0, 360.0)),
    ],
}


def generate_synthetic_history(n_records: int = 650, days_back: int = 180) -> pd.DataFrame:
    """
    Generates realistic historical transactions with dates, categories, vendors,
    and deliberately injected anomalies for auditing.
    """
    np.random.seed(42)
    random.seed(42)

    records = []
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)

    # Category selection distribution (office & meals are frequent, legal is less frequent)
    cat_weights = [0.22, 0.25, 0.18, 0.08, 0.10, 0.09, 0.04, 0.04]

    for _ in range(n_records):
        random_days = random.randint(0, days_back)
        txn_date = start_date + timedelta(days=random_days, hours=random.randint(8, 20), minutes=random.randint(0, 59))
        
        category = random.choices(EXPENSE_CATEGORIES, weights=cat_weights, k=1)[0]
        vendor_info = random.choice(VENDOR_TEMPLATES[category])
        merchant = vendor_info[0]
        item_pool = vendor_info[1]
        price_range = vendor_info[2]

        # Generate base amount with some realistic log-normal variance
        base_amount = round(random.uniform(price_range[0], price_range[1]), 2)
        tax = round(base_amount * 0.0825, 2)
        total_amount = round(base_amount + tax, 2)

        selected_items = random.sample(item_pool, k=min(len(item_pool), random.randint(1, 3)))
        description_text = f"{merchant} - " + ", ".join(selected_items)

        records.append({
            "id": f"REC-{uuid.uuid4().hex[:8].upper()}",
            "date": txn_date.strftime("%Y-%m-%d %H:%M:%S"),
            "merchant": merchant,
            "amount": total_amount,
            "category": category,
            "tax": tax,
            "is_anomaly": False,
            "risk_severity": "LOW",
            "risk_reasons": "",
            "receipt_text": description_text,
        })

    df = pd.DataFrame(records)

    # --- INJECT INTENTIONAL REALISTIC ANOMALIES FOR AUDIT CAPABILITY ---
    
    # 1. Exact duplicate charge within 12 hours (e.g. accidental double billing)
    dup_base = df.iloc[15].copy()
    dup_record = dup_base.copy()
    dup_record["id"] = f"REC-{uuid.uuid4().hex[:8].upper()}"
    dup_date = datetime.strptime(dup_base["date"], "%Y-%m-%d %H:%M:%S") + timedelta(hours=6, minutes=12)
    dup_record["date"] = dup_date.strftime("%Y-%m-%d %H:%M:%S")
    dup_record["is_anomaly"] = True
    dup_record["risk_severity"] = "HIGH"
    dup_record["risk_reasons"] = "Duplicate transaction detected (Same vendor & exact amount within 48h)"
    df = pd.concat([df, pd.DataFrame([dup_record])], ignore_index=True)

    # 2. Outrageous outlier dinner charge (e.g. $4,280 at Ruth's Chris Steak House)
    df.loc[42, "merchant"] = "Ruth's Chris Steak House"
    df.loc[42, "category"] = "Meals & Entertainment"
    df.loc[42, "amount"] = 4280.00
    df.loc[42, "tax"] = 353.10
    df.loc[42, "is_anomaly"] = True
    df.loc[42, "risk_severity"] = "HIGH"
    df.loc[42, "risk_reasons"] = "Abnormal transaction amount for Meals & Entertainment (>4x std dev)"

    # 3. Split transaction evasion (two $975 charges on the same day right below a $1000 threshold)
    split_date = (end_date - timedelta(days=14)).strftime("%Y-%m-%d 14:15:00")
    split_1 = {
        "id": f"REC-{uuid.uuid4().hex[:8].upper()}",
        "date": split_date,
        "merchant": "Best Buy",
        "amount": 975.00,
        "category": "Office Supplies & Software",
        "tax": 75.00,
        "is_anomaly": True,
        "risk_severity": "HIGH",
        "risk_reasons": "Suspected split purchase to avoid $1,000 managerial approval limit",
        "receipt_text": "Best Buy - High End Graphics Card Pt 1",
    }
    split_2 = {
        "id": f"REC-{uuid.uuid4().hex[:8].upper()}",
        "date": (end_date - timedelta(days=14, hours=-1)).strftime("%Y-%m-%d 15:10:00"),
        "merchant": "Best Buy",
        "amount": 975.00,
        "category": "Office Supplies & Software",
        "tax": 75.00,
        "is_anomaly": True,
        "risk_severity": "HIGH",
        "risk_reasons": "Suspected split purchase to avoid $1,000 managerial approval limit",
        "receipt_text": "Best Buy - High End Graphics Card Pt 2",
    }
    df = pd.concat([df, pd.DataFrame([split_1, split_2])], ignore_index=True)

    # 4. Weekend luxury spending or nightclub
    df.loc[88, "merchant"] = "Omnia Nightclub & Lounge"
    df.loc[88, "category"] = "Meals & Entertainment"
    df.loc[88, "amount"] = 1850.00
    df.loc[88, "date"] = (end_date - timedelta(days=22)).replace(hour=23, minute=45).strftime("%Y-%m-%d %H:%M:%S")
    df.loc[88, "is_anomaly"] = True
    df.loc[88, "risk_severity"] = "HIGH"
    df.loc[88, "risk_reasons"] = "High-risk vendor category on weekend off-hours; Extreme amount for entertainment"

    # 5. Suspicious round amount
    df.loc[120, "merchant"] = "Fastenal Industrial"
    df.loc[120, "category"] = "Inventory & Raw Materials"
    df.loc[120, "amount"] = 1500.00
    df.loc[120, "is_anomaly"] = True
    df.loc[120, "risk_severity"] = "MEDIUM"
    df.loc[120, "risk_reasons"] = "Round number transaction flag ($1,500.00) lacking itemized tax"

    # Sort chronological
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df["date"] = df["date"].dt.strftime("%Y-%m-%d %H:%M:%S")

    return df


def ensure_sample_database():
    """Generates the expense database CSV if not already present."""
    if not EXPENSES_DB_PATH.exists():
        print(f"Creating synthetic expenses database at {EXPENSES_DB_PATH}...")
        df = generate_synthetic_history(n_records=700, days_back=180)
        df.to_csv(EXPENSES_DB_PATH, index=False)
        print("Historical database generated successfully.")
    return EXPENSES_DB_PATH


def create_sample_receipt_image(file_name: str, merchant: str, date_str: str, items: list, subtotal: float, tax: float, total: float):
    """
    Renders a realistic black-and-white thermal printed receipt PNG image.
    Useful for OCR testing and demo portfolio presentations.
    """
    width, height = 500, 750
    # Warm off-white background typical of receipt paper
    img = Image.new("RGB", (width, height), color=(250, 250, 248))
    draw = ImageDraw.Draw(img)

    # Use default bitmap font to avoid OS font dependency issues
    font = ImageFont.load_default()

    # Draw receipt header
    draw.text((160, 40), f"*** {merchant.upper()} ***", fill=(20, 20, 20), font=font)
    draw.text((180, 65), "STORE #49102", fill=(60, 60, 60), font=font)
    draw.text((140, 85), "123 INNOVATION BLVD, STE 400", fill=(60, 60, 60), font=font)
    draw.text((170, 105), "TEL: (555) 019-2834", fill=(60, 60, 60), font=font)
    
    draw.text((40, 140), f"DATE: {date_str}   TIME: 14:32", fill=(40, 40, 40), font=font)
    draw.text((40, 160), f"RECEIPT ID: RCT-{random.randint(100000, 999999)}", fill=(40, 40, 40), font=font)
    draw.line([(40, 185), (460, 185)], fill=(120, 120, 120), width=1)

    # Line items
    y = 210
    draw.text((40, y), "DESCRIPTION", fill=(20, 20, 20), font=font)
    draw.text((400, y), "PRICE", fill=(20, 20, 20), font=font)
    y += 25
    draw.line([(40, y), (460, y)], fill=(180, 180, 180), width=1)
    y += 15

    for item_name, price in items:
        # Truncate if long
        name_str = item_name[:28]
        draw.text((40, y), name_str, fill=(30, 30, 30), font=font)
        price_str = f"${price:.2f}"
        draw.text((400, y), price_str, fill=(30, 30, 30), font=font)
        y += 25

    # Totals section
    y += 20
    draw.line([(40, y), (460, y)], fill=(120, 120, 120), width=1)
    y += 15
    draw.text((260, y), "SUBTOTAL:", fill=(40, 40, 40), font=font)
    draw.text((400, y), f"${subtotal:.2f}", fill=(40, 40, 40), font=font)
    y += 25
    draw.text((260, y), "TAX (8.25%):", fill=(40, 40, 40), font=font)
    draw.text((400, y), f"${tax:.2f}", fill=(40, 40, 40), font=font)
    y += 25
    draw.line([(260, y), (460, y)], fill=(80, 80, 80), width=2)
    y += 10
    draw.text((260, y), "TOTAL PAID:", fill=(10, 10, 10), font=font)
    draw.text((395, y), f"${total:.2f}", fill=(10, 10, 10), font=font)

    # Footer
    y += 50
    draw.text((150, y), "AUTH CODE: 981240 - VISA APPROVED", fill=(70, 70, 70), font=font)
    y += 25
    draw.text((170, y), "THANK YOU FOR YOUR BUSINESS!", fill=(50, 50, 50), font=font)

    target_path = SAMPLE_RECEIPTS_DIR / file_name
    img.save(target_path)
    return target_path


def generate_sample_receipt_suite():
    """Generates a collection of diverse sample receipt images for live testing."""
    SAMPLE_RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)
    today_str = datetime.now().strftime("%Y-%m-%d")

    receipts = [
        {
            "filename": "sample_office_supplies.png",
            "merchant": "Staples Office Store",
            "date": today_str,
            "items": [("Multi-Purpose Paper 10 Reams", 54.99), ("Highlighter 6-Pack Assorted", 8.49), ("Heavy Duty Stapler", 22.50)],
            "subtotal": 85.98,
            "tax": 7.09,
            "total": 93.07,
        },
        {
            "filename": "sample_client_dinner.png",
            "merchant": "Chipotle Mexican Grill",
            "date": today_str,
            "items": [("Chicken Burrito Bowl", 11.50), ("Steak Bowl with Guac", 14.85), ("Large Fountain Beverage", 3.25), ("Chips & Fresh Guacamole", 5.10)],
            "subtotal": 34.70,
            "tax": 2.86,
            "total": 37.56,
        },
        {
            "filename": "sample_travel_fuel.png",
            "merchant": "Shell Oil Station",
            "date": today_str,
            "items": [("Unleaded Plus 16.4 Gal", 65.44), ("Bottled Spring Water", 2.29)],
            "subtotal": 67.73,
            "tax": 5.59,
            "total": 73.32,
        },
        {
            "filename": "sample_suspicious_high_dinner.png",
            "merchant": "Ruth's Chris Steak House",
            "date": today_str,
            "items": [("Tomahawk Ribeye 40oz", 195.00), ("Bottle Caymus Cabernet", 280.00), ("Chilean Sea Bass", 65.00), ("Executive Tasting Menu", 320.00)],
            "subtotal": 860.00,
            "tax": 70.95,
            "total": 930.95,
        },
    ]

    created_paths = []
    for r in receipts:
        path = create_sample_receipt_image(
            r["filename"], r["merchant"], r["date"], r["items"], r["subtotal"], r["tax"], r["total"]
        )
        created_paths.append(path)
    return created_paths


if __name__ == "__main__":
    ensure_sample_database()
    generate_sample_receipt_suite()
