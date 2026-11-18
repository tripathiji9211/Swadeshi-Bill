# 🏛️ Swadeshi Khata (स्वदेशी खाता): AI Bahi-Khata & Financial Sentinel

> **"आपका हिसाब, आपका भरोसा" (Aapka hisaab, aapka bharosa — Your accounts, your trust)**  
> *End-to-End Forensic Expense Auditing & Financial Intelligence for Indian Small Businesses and Enterprises*  
> *Pipeline: Receipt Image/PDF/Thermal Bill ➔ OpenCV Preprocessing ➔ EasyOCR (Hindi + English) ➔ LLM JSON Extraction (Gemini/OpenAI) ➔ ML Category Classifier ➔ Forensic Anomaly Audit (Isolation Forest + Z-Scores + Rules) ➔ 30-Day Spending Forecast (SARIMA/Prophet/XGBoost) ➔ Bachat Margdarshak Savings Arbitrage ➔ Immersive 3D React Frontend + FastAPI Backend*

---

## 📌 Executive Summary & Problem Statement

Indian MSMEs and small businesses routinely process hundreds of paper slips, thermal kirana receipts, multi-lingual invoices, and digital bills monthly. Due to limited accounting headcount and fragmented supplier networks, businesses lose **3% to 6% of revenue** to:
1. **Accidental Duplicate Invoicing** (vendors billing twice across 24–48 hours).
2. **Policy Evasion & Anomalies** (e.g., split purchases bypassing managerial thresholds, off-hours billing).
3. **Vendor Price Dispersion & Arbitrage** (paying different prices to different suppliers for identical goods).
4. **Unpredictable Cash Burn & Festival Demand Spikes** (Diwali, Holi, and seasonal procurement swings).

**Swadeshi Khata (स्वदेशी खाता)** transforms messy paper receipts, thermal slips, and invoices into an audited, tamper-evident digital ledger with calibrated machine learning confidence, forensic anomaly detection, and predictive cash-flow forecasting.

---

## 🏗️ System Architecture

```
+----------------------------------------------------+
| Receipt Image, PDF, or Thermal Slip (Hindi/English)|
+----------------------------------------------------+
                          |
                          v
+----------------------------------------------------+
| 1. OpenCV Preprocessing & Multi-Lingual OCR        |
|    - Bilateral edge-preserving denoising           |
|    - Contrast stretching & Otsu binarization       |
|    - EasyOCR (English + Devanagari/Hindi)          |
+----------------------------------------------------+
                          |
                          v [Raw Multi-Lingual Text Stream]
+----------------------------------------------------+
| 2. LLM JSON Information Extraction Engine          |
|    - Structured schema: Merchant, Date, GSTIN, Total|
|    - Google Gemini 2.5 Flash / OpenAI GPT-4o       |
|    - Deterministic regex & Hinglish normalization  |
+----------------------------------------------------+
                          |
                          v [Structured JSON: Vendor, Date, Items, Total, Tax]
+----------------------------------------------------+
| 3. ML Expense Category Classifier                  |
|    - Scikit-learn Pipeline (Stratified CV)         |
|    - TF-IDF Vectorizer (Unigrams + Bigrams)        |
|    - Evaluated: Logistic Regression vs Random      |
|      Forest vs DistilBERT / Embeddings             |
|    - Calibrated prediction probability & confidence|
+----------------------------------------------------+
                          |
                          v [Predicted Category + Confidence Score]
+----------------------------------------------------+
| 4. Multi-Layer Forensic Anomaly Detector           |
|    - Unsupervised Scikit-learn Isolation Forest    |
|    - Category Statistical Z-Scores (Z > 2.5)       |
|    - Rule Engine: 48h Duplicates, Threshold Splits,|
|      Weekend/Off-hours charges, Round number flags |
+----------------------------------------------------+
                          |
                          v [Audited Transaction with Risk Score & Findings]
+----------------------------------------------------+
| 5. Autoregressive Time-Series Forecaster           |
|    - Daily spend aggregation & lag features        |
|    - Moving Average vs SARIMA vs XGBoost per cat   |
|    - Festival calendar markers (Diwali, Holi, etc.)|
|    - Best model selection by holdout MAPE & MAE    |
+----------------------------------------------------+
                          |
                          v
+----------------------------------------------------+
| 6. Bachat Margdarshak (AI Savings Advisor)         |
|    - Cross-vendor pricing arbitrage identification |
|    - Category budget spikes (>25% vs 3M rolling)   |
|    - Recurring subscription & retainer tracking    |
|    - Executive monthly report with actionable tips |
+----------------------------------------------------+
                          |
        +-----------------+-----------------+
        |                                   |
        v                                   v
+-----------------------+   +-------------------------------+
| FastAPI REST Backend  |   | Swadeshi Khata React Frontend |
| (SQLite, Auth, JWT)   |   | (R3F 3D Scene, i18n, Tailwind)|
| Port 8000             |   | Port 5173                     |
+-----------------------+   +-------------------------------+
```

---

## 🎨 Design & Indian Identity Language

- **Visual Architecture**: Pure black command canvas (`#000000` to `#050505`) with 1px architectural grid lines. No blue, slate, or navy fills.
- **Color Tokens**:
  - **Saffron (`#FF9933`)**: Primary brand accent, glowing rings, active navigation, hero highlights.
  - **India Green (`#138808`)**: Success, verified audits, savings confirmations.
  - **Antique Gold (`#D4A017`)**: Coin stacks, high-priority notifications, festival markers.
  - **Kumkum Red (`#B3202A`)**: Critical anomalies, fraud warnings, risk indicators.
  - **Warm White (`#F5EFE6`)**: Primary typography and high-contrast titles.
  - **Muted Sand (`#A59E92`)**: Secondary body labels and metadata.
- **Immersive 3D Experience (React Three Fiber)**:
  - Full-screen persistent WebGL canvas with smooth camera transitions across routes.
  - Signature 24-spoke refractive glass chakra ring with pulsing luminous saffron core.
  - 3D red Bahi-Khata ledger with golden stitching, floating receipts, and minted gold coins.
  - Interactive Kirana scan beam and 3D anomaly galaxy scatter.
- **Indian Financial Localization**:
  - `₹` currency grouping (`formatINR`: e.g. `₹1,23,456` and compact `₹4.5 L`, `₹2.1 Cr`).
  - Indian Financial Year format (`FY 2026-27`, Q1–Q4).
  - GSTIN verification and CGST/SGST/IGST tax breakdowns.
  - UPI-first payment modes (Google Pay, PhonePe, Paytm, BHIM, Net Banking, Cash).
  - Indian festival calendar integration (Diwali, Holi, Eid, Dussehra, Pongal).
  - Multi-lingual i18n support in English and Hindi (Devanagari).

---

## 🚀 Getting Started

### 1. Requirements & Prerequisites
- Python 3.10+ (tested on Python 3.11 & 3.14)
- Node.js 18+ (tested on Node.js v24)
- Modern WebGL2-compatible browser

### 2. Backend Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the end-to-end verification and ML test suite
python run_demo.py

# Launch the FastAPI REST Backend
uvicorn src.api.main:app --reload --port 8000
```
Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Run the development server
npm run dev
```
Open `http://localhost:5173` to access the Swadeshi Khata mission control dashboard.

### 4. Running the Complete Verification Suite
```bash
# Python Backend Tests (59 contract, ML, and API tests)
python -m pytest tests/

# Frontend Unit Tests (Vitest)
cd frontend
npm run test

# Frontend Production Build
npm run build
```

---

## 📂 Project Structure

```
RecieptRadar/
├── src/
│   ├── api/
│   │   ├── auth.py              # JWT authentication & OTP verification service
│   │   ├── database.py          # SQLite database schema (expenses, users, otp_requests)
│   │   └── main.py              # FastAPI endpoints (upload, expenses, forecast, insights, ask)
│   ├── models/
│   │   ├── anomaly.py           # Isolation Forest + Z-Scores + Rule Engine
│   │   ├── classifier.py        # TF-IDF + Logistic Regression / Random Forest
│   │   ├── explainability.py    # LIME & SHAP feature attributions
│   │   ├── forecast.py          # SARIMA, Prophet & XGBoost time-series forecaster
│   │   └── insights.py          # Vendor price variance arbitrage & budget spike detection
│   ├── ocr/
│   │   └── extract.py           # OpenCV deskew, contrast & EasyOCR engine
│   ├── parsing/
│   │   ├── parse_receipt.py     # Gemini & OpenAI LLM parsing with regex fallback
│   │   └── schemas.py           # Pydantic v2 data models & validation
│   └── utils/
│       ├── clean_pipeline.py    # Multi-lingual text cleaner & normalizer
│       └── generate_indian_expenses.py # 5,000 synthetic Indian SMB ledger entries
├── frontend/
│   ├── src/
│   │   ├── api/                 # Typed API client & hooks
│   │   ├── components/          # App shell, Navbar, UserMenu, SoundToggle, OnboardingTour
│   │   ├── context/             # AuthContext (JWT, OTP, Guest mode)
│   │   ├── i18n/                # Localization catalogs (en, hi, ta, bn, mr, te, gu)
│   │   ├── lib/                 # Indian formats (₹ INR, FY, GSTIN, Festivals) & Web Audio Tanpura
│   │   ├── pages/               # Landing, Dashboard, Upload, ReviewQueue, Forecast, Insights, Ask, Auth
│   │   ├── styles/              # Design tokens (tokens.css, pure black, Indian accents)
│   │   └── three/               # React Three Fiber 3D scenes (GlassRing, KhataBook, ScanBeam, AiOrb)
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── receiptradar.db          # SQLite ledger database (5,000 Indian SMB transactions)
│   └── human_feedback_corrections.csv # Human-in-the-loop retraining audit trail
├── tests/
│   ├── test_api.py              # API endpoint functional tests
│   ├── test_api_contract.py     # Contract parity assertions against baseline snapshot
│   ├── test_auth.py             # User signup, login, OTP verification & guest profile tests
│   ├── test_classifier.py       # Classifier model benchmark tests
│   ├── test_models.py           # Anomaly and forecasting model tests
│   ├── test_ocr.py              # OCR extraction accuracy tests
│   └── test_parser.py           # LLM parser and regex fallback tests
├── requirements.txt
├── run_demo.py
└── README.md
```

---

## 🔒 Security, Compliance & Human-in-the-Loop

1. **Human-in-the-Loop Active Learning**:
   Any receipt with classifier probability `< 65%` or OCR quality score `< 60%` is automatically sequestered in the **Needs Review Queue**. Human corrections update the ledger and are fed into the supervised retraining loop with `15x` sample weighting.
2. **Deterministic Parity Contract**:
   Every API endpoint is protected by a saved regression contract test (`tests/test_api_contract.py`). Additive fields are permitted; breaking removals fail CI loudly.
3. **Additive Authentication**:
   Supports both traditional credentials, Indian mobile 6-digit OTP verification, and instant Guest exploration mode. When `AUTH_REQUIRED=False` (default for CI test harnesses), existing test suites run unimpeded.

---

## 📜 License & Acknowledgements

Created with ❤️ for Indian small businesses and kirana merchants.  
*Swadeshi Khata — "Aapka hisaab, aapka bharosa."*
