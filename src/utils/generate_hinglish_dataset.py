"""
ReceiptRadar - Hinglish & Hindi Synthetic Dataset Generator
===========================================================
Generates:
1. data/processed/hinglish_augmented_500.csv: 500 Hinglish & Hindi training records across all 8 categories.
2. data/processed/hinglish_test_100.csv: 100 strict holdout test records for out-of-domain evaluation.
3. data/processed/combined_expenses_5500.csv: Combined 5,500 record dataset (original 5,000 + 500 Hinglish).
"""

import sys
import os
import random
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Windows console encoding safeguard
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pandas as pd
import numpy as np

from src.config import DATA_DIR

PROCESSED_DIR = DATA_DIR / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

AUGMENTED_500_PATH = PROCESSED_DIR / "hinglish_augmented_500.csv"
TEST_100_PATH = PROCESSED_DIR / "hinglish_test_100.csv"
COMBINED_5500_PATH = PROCESSED_DIR / "combined_expenses_5500.csv"
ORIGINAL_5000_PATH = PROCESSED_DIR / "cleaned_indian_expenses.csv"


# =============================================================================
# 1. HINGLISH & HINDI TEMPLATES ACROSS 8 CATEGORIES
# =============================================================================

HINGLISH_TEMPLATES = {
    "groceries": {
        "vendors": [
            "Sharma Sabzi Mandi", "Gupta Ji Kirana Store", "Chawla Dairy & Paneer",
            "Aggarwal Sweets & Namkeen", "Chai Point Stall", "Apna Ration Bhandar",
            "शर्मा सब्जी मंडी", "गुप्ता जी किराना स्टोर", "अग्रवाल स्वीट्स"
        ],
        "items": [
            "sbzi mandi se taaza aalu pyaaz tamatar khareed",
            "doodh dahi paneer daily staff pantry supply",
            "chai patti 1kg cheeni 5kg sugar packet",
            "office nashta samosa kachori namkn snacks",
            "ration dukan atta chawal tel cooking oil",
            "dudh packet 5 litre morning delivery",
            "green tea lemon tea biscut biskut snacks",
            "mithai dabba diwali gift box sweets",
            "dood makhan dahi chaas for lunch",
            "सब्जी मंडी आलू प्याज टमाटर ताजा खरीद",
            "दूध दही पनीर राशन किराना दुकान",
            "चाय पत्ती चीनी बिस्कुट स्टाफ नाश्ता",
            "दुकान पेंट्री के लिए तेल आटा चावल राशन"
        ],
        "amount_range": (150, 4500),
    },
    "utilities": {
        "vendors": [
            "BSES Rajdhani Power", "Tata Power DDL Bijli", "Delhi Jal Board Water",
            "Indane Gas Agency", "Airtel Broadband Office", "Mahanagar Gas Limited",
            "बीएसईएस राजधानी बिजली", "दिल्ली जल बोर्ड", "इंडेन गैस एजेंसी"
        ],
        "items": [
            "bjli ka bill electricity metre reading commercial unit",
            "pani water bill nagar nigam quarterly supply",
            "commercial lpg gas cylinder refill bharwaya",
            "airtel wifi broadband monthly net recharge",
            "godown bijli bill payment online receipt",
            "submersible pump water tanker charges",
            "bses bijlee power consumption charges",
            "office wifi fiber internet connection recharge",
            "बिजली का बिल मीटर रीडिंग कमर्शियल भुगतान",
            "दिल्ली जल बोर्ड पानी सप्लाई बिल",
            "एलपीजी गैस सिलेंडर रिफिल बुकिंग",
            "ऑफिस वाईफाई ब्रॉडबैंड इंटरनेट रिचार्ज"
        ],
        "amount_range": (800, 18500),
    },
    "rent": {
        "vendors": [
            "Shri Ram Complex Godown Bhada", "DLF Commercial Space", "Lalita Market Dukan",
            "Sethi Properties Office Cabin", "Godown Bhada Okhla Phase 2",
            "श्री राम कॉम्प्लेक्स गोदाम भाड़ा", "दुकान किराया लाल बाज़ार", "सेठी प्रॉपर्टीज"
        ],
        "items": [
            "dukan kiraya mahina shop advance lease rent",
            "godown bhada warehouse storage space rent payment",
            "office cabin lease monthly kiraya cheque",
            "gudam space monthly rent bhada advance",
            "dukaan advance security and monthly lease",
            "commercial building ground floor godown bhada",
            "दुकान किराया मासिक गोदाम भाड़ा एडवांस चेक",
            "गोदाम भाड़ा वेयरहाउस स्टोरेज लीज पेमेंट",
            "ऑफिस केबिन मासिक किराया कमर्शियल स्पेस"
        ],
        "amount_range": (15000, 65000),
    },
    "transport": {
        "vendors": [
            "Porter Tempo Fleet", "Local Auto Rickshaw Union", "Indian Oil Petrol Pump",
            "TCI Freight Cargo", "Bharat Petroleum BPCL", "Uber Commercial Delivery",
            "पोर्टर टेम्पो ट्रांसपोर्ट", "इंडियन ऑयल पेट्रोल पंप", "लोकल ऑटो भाड़ा"
        ],
        "items": [
            "tempo bhda maal transport delivery to market",
            "porter chota hathi tempo bhada outstation loading",
            "auto rickshaw fare local parcel delivery",
            "disel petrol pump bharwaya commercial tempo",
            "petrl bharwaya gadi delivery van petrol",
            "toll tax parchi fastag recharge outstation",
            "freight parcel outstation cargo bhada",
            "loading tempo auto maal transport delivery",
            "टेम्पो भाड़ा माल ट्रांसपोर्ट डिलीवरी बाज़ार",
            "डीजल पेट्रोल पंप भरवाया डिलीवरी गाड़ी",
            "लोकल ऑटो रिक्शा भाड़ा पार्सल डिलीवरी",
            "टोल टैक्स पर्ची फास्टैग रिचार्ज माल ढुलाई"
        ],
        "amount_range": (250, 8500),
    },
    "salaries": {
        "vendors": [
            "Staff Payroll Account", "Palledar Union Cash", "Daily Labor Contractor",
            "Driver Monthly Payout", "Safai Staff Wages", "Munshi Ji Accounts",
            "स्टाफ वेतन भुगतान", "मजदूर यूनियन दिहाड़ी", "ड्राइवर तनख्वाह"
        ],
        "items": [
            "palledar mazdoor dihadi roz ka kharcha loading wages",
            "driver tankhwah monthly salary advance payout",
            "munshi babu accountant monthly salary payment",
            "safai karmachari sweeper cleaning monthly wages",
            "godown labor overtime and weekly dihadi wages",
            "helper boy dukan staff tankha bonus",
            "mazdoor dihadi 4 workers daily wage payout",
            "मजदूरी दिहाड़ी पल्लेदार लेबर लोडिंग खर्चा",
            "ड्राइवर तनख्वाह मासिक वेतन एडवांस",
            "मुंशी बाबू अकाउंटेंट सैलरी चेक",
            "सफाई कर्मचारी तनख्वाह और साप्ताहिक दिहाड़ी"
        ],
        "amount_range": (400, 32000),
    },
    "supplies": {
        "vendors": [
            "Gupta Ji Stationery & Xerox", "Amazon Packaging Hub", "Vardhman Plastics Lifafe",
            "Khosla Cartridge Refilling", "National Paper Mart",
            "गुप्ता जी स्टेशनरी", "वर्धमान पैकेजिंग लिफाफे", "नेशनल पेपर मार्ट"
        ],
        "items": [
            "dukan packing panni lifafe polybag packets",
            "bill book printing cash receipt counter slip",
            "packing tape patti brown carton dabba",
            "jk copier a4 paper ream printer kagaz",
            "barcode label rolls and sticker price tags",
            "printer ink cartridge refil black toner",
            "khata bahi register account ledger notebook",
            "दुकान पैकिंग पन्नी लिफाफे थैली कार्टन",
            "बिल बुक छपाई रसीद पर्ची काउंटर स्लिप",
            "प्रिंटर जेके कॉपियर पेपर कार्ट्रिज रिफिल",
            "खाता बही रजिस्टर स्टेशनरी मार्कर पेन"
        ],
        "amount_range": (250, 9500),
    },
    "marketing": {
        "vendors": [
            "Aggarwal Flex & Banner Print", "Meta Ads India", "Digital India Promo",
            "National Newspaper Ishtehar", "Printo Signage Hub",
            "अग्रवाल फ्लेक्स बैनर", "प्रिंटो साइन बोर्ड", "विज्ञापन प्रचार केंद्र"
        ],
        "items": [
            "pamplet chhapwaya banner flex board dukan prachar",
            "visiting card 1000 print and shop board",
            "facebook ad promo online customer marketing campaign",
            "newspaper local ishtehar advertisement slip",
            "dukan opening banner flex hoarding chhapayi",
            "flyers pamphlets distribution in market",
            "पंपलेट छपवाया बैनर फ्लेक्स बोर्ड दुकान प्रचार",
            "विजिटिंग कार्ड छपाई साइन बोर्ड फ्लेक्स",
            "अख़बार लोकल इश्तेहार विज्ञापन पर्ची",
            "फेसबुक इंस्टाग्राम विज्ञापन ऑनलाइन प्रचार"
        ],
        "amount_range": (600, 22000),
    },
    "misc": {
        "vendors": [
            "Local Mistri Plumbing", "Sharma Hardware & Locks", "Pandit Ji Pooja Samagri",
            "Urban Company Repair", "Aggarwal Chai & Water Jar",
            "लोकल मिस्त्री प्लंबिंग", "शर्मा हार्डवेयर ताला चाबी", "पंडित जी पूजा सामग्री"
        ],
        "items": [
            "mistri plumbing pipe repair hathoda screwdriver",
            "taala chabi key duplicate lock repair kaam",
            "office pooja diwali samagri hawan dhoop batti",
            "visitor hospitality tea chai nashta mehmaan kharcha",
            "dustbin floor mop jhadoo cleaning liquid",
            "lock change and godown shutter greasing repair",
            "मिस्त्री प्लंबिंग नल रिपेयर हथौड़ा पेचकस",
            "ताला चाबी डुप्लीकेट लॉक रिपेयर गोदाम",
            "ऑफिस पूजा सामग्री अगरबत्ती धूपबत्ती",
            "मेहमान नवाज़ी चाय नाश्ता फुटकर खर्च"
        ],
        "amount_range": (150, 4800),
    },
}


# =============================================================================
# 2. GENERATE AUGMENTED TRAINING & STRICT HOLDOUT DATASETS
# =============================================================================

def generate_hinglish_records(count: int, seed: int = 42) -> pd.DataFrame:
    """Generates synthetic bilingual Hinglish and Devanagari expense records."""
    random.seed(seed)
    np.random.seed(seed)

    records = []
    categories = list(HINGLISH_TEMPLATES.keys())
    per_cat = count // len(categories)
    remainder = count % len(categories)

    base_date = datetime(2024, 1, 15)

    for cat_idx, cat in enumerate(categories):
        n_samples = per_cat + (1 if cat_idx < remainder else 0)
        config = HINGLISH_TEMPLATES[cat]

        for _ in range(n_samples):
            vendor = random.choice(config["vendors"])
            desc = random.choice(config["items"])
            min_amt, max_amt = config["amount_range"]
            amt = round(random.uniform(min_amt, max_amt), 2)
            payment = random.choice(["UPI", "Cash", "NEFT/RTGS", "Debit Card"])
            txn_date = base_date + timedelta(days=random.randint(0, 365), hours=random.randint(9, 20), minutes=random.randint(0, 59))

            records.append({
                "date": txn_date.strftime("%Y-%m-%d %H:%M:%S"),
                "vendor": vendor,
                "item_description": desc,
                "amount": amt,
                "category": cat,
                "payment_mode": payment,
                "is_anomaly": False,
                "language_type": "devanagari" if any('\u0900' <= ch <= '\u097f' for ch in desc) else "hinglish_roman",
            })

    random.shuffle(records)
    return pd.DataFrame(records)


def create_all_datasets():
    """Builds and serializes the 500 augmented training set, 100 holdout test set, and combined dataset."""
    print("=" * 80)
    print(" GENERATING BILINGUAL HINGLISH & HINDI EXPENSE DATASETS")
    print("=" * 80)

    # 1. 500 Augmented Training Examples (Seed 101)
    df_augmented_500 = generate_hinglish_records(count=500, seed=101)
    df_augmented_500.to_csv(AUGMENTED_500_PATH, index=False)
    print(f"[OK] Generated 500 Hinglish training examples:\n  -> {AUGMENTED_500_PATH}")
    print(f"     Distribution across 8 categories:\n{df_augmented_500['category'].value_counts().to_string()}\n")

    # 2. 100 Strict Holdout Test Set (Seed 999) - Unseen in training
    df_test_100 = generate_hinglish_records(count=100, seed=999)
    df_test_100.to_csv(TEST_100_PATH, index=False)
    print(f"[OK] Generated 100 Hinglish holdout test examples:\n  -> {TEST_100_PATH}")
    print(f"     Distribution:\n{df_test_100['category'].value_counts().to_string()}\n")

    # 3. Combined Training Set (Original 5,000 + 500 Hinglish = 5,500 total)
    if ORIGINAL_5000_PATH.exists():
        df_orig = pd.read_csv(ORIGINAL_5000_PATH)
        combined_df = pd.concat([df_orig, df_augmented_500], ignore_index=True)
        combined_df.to_csv(COMBINED_5500_PATH, index=False)
        print(f"[OK] Created combined training dataset ({len(combined_df):,} total records):\n  -> {COMBINED_5500_PATH}")
    else:
        print("[Notice] Original dataset not found at cleaned path; using raw dataset if present.")


if __name__ == "__main__":
    create_all_datasets()

