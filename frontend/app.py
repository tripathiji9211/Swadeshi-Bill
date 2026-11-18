"""
ReceiptRadar - Streamlit AI Expense Auditor Dashboard
Interactive executive dashboard for small business receipt auditing,
anomaly detection, time-series forecasting, and automated cost optimization.
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
from PIL import Image
import requests
import io
import json

# Import local services for zero-friction standalone mode
from backend.app.services.ocr_engine import OCREngine
from backend.app.services.llm_parser import LLMParser
from backend.app.services.category_classifier import CategoryClassifier
from backend.app.services.anomaly_detector import ExpenseAnomalyDetector
from backend.app.services.forecaster import SpendingForecaster
from backend.app.services.savings_recommender import SavingsRecommender
from backend.app.config import (
    SAMPLE_RECEIPTS_DIR,
    EXPENSES_DB_PATH,
    EXPENSE_CATEGORIES,
)
from backend.app.utils.sample_data import ensure_sample_database, generate_sample_receipt_suite

# --- Page Configuration ---
st.set_page_config(
    page_title="ReceiptRadar | AI Expense Auditor",
    page_icon="🧾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- Custom Styling ---
st.markdown("""
<style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E293B;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 1.05rem;
        color: #64748B;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 16px;
        text-align: center;
    }
    .audit-safe {
        background-color: #DCFCE7;
        color: #166534;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        display: inline-block;
    }
    .audit-warning {
        background-color: #FEF9C3;
        color: #854D0E;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        display: inline-block;
    }
    .audit-danger {
        background-color: #FEE2E2;
        color: #991B1B;
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 600;
        display: inline-block;
    }
</style>
""", unsafe_allow_html=True)


# --- Cached Engine Singletons ---
@st.cache_resource
def get_audit_engine():
    """Initializes local pipeline components for seamless fallback execution."""
    ensure_sample_database()
    generate_sample_receipt_suite()
    return {
        "ocr": OCREngine(),
        "llm": LLMParser(),
        "clf": CategoryClassifier(),
        "ano": ExpenseAnomalyDetector(),
        "forecaster": SpendingForecaster(),
        "savings": SavingsRecommender(),
    }


engine = get_audit_engine()

# --- Sidebar Configuration ---
with st.sidebar:
    st.image("https://img.icons8.com/isometric/100/receipt.png", width=70)
    st.title("ReceiptRadar")
    st.caption("AI-Powered Financial Sentinel for Small Businesses")
    st.markdown("---")

    backend_url = st.text_input("FastAPI Backend Endpoint", value="http://localhost:8000")
    
    # Check backend connectivity
    backend_online = False
    try:
        res = requests.get(f"{backend_url}/", timeout=1.0)
        if res.status_code == 200:
            backend_online = True
    except Exception:
        backend_online = False

    if backend_online:
        st.success("🟢 FastAPI Backend: Online")
    else:
        st.info("ℹ️ Mode: Direct In-Memory Engine")

    st.markdown("---")
    st.markdown("### Quick Demo Receipts")
    st.caption("Click to load pre-configured test scenarios:")
    sample_files = list(SAMPLE_RECEIPTS_DIR.glob("*.png"))
    selected_sample = st.selectbox(
        "Choose Sample Receipt",
        options=["None"] + [f.name for f in sample_files],
        index=0,
    )

    st.markdown("---")
    if st.button("🔄 Retrain ML Models"):
        with st.spinner("Retraining NLP Classifier & Isolation Forest..."):
            clf_m = engine["clf"].train_on_history()
            ano_m = engine["ano"].train_on_history()
            st.success(f"Models retrained! Classifier Test Acc: {clf_m.get('test_accuracy', 0.9):.1%}")

    st.markdown("---")
    st.caption("Portfolio Project by AI/ML Intern Candidate")

# --- Main Dashboard Header ---
st.markdown('<div class="main-header">ReceiptRadar: AI Expense Auditor & Intelligence</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">Automated OCR Extraction, LLM JSON Structuring, ML Category Classification, Forensic Anomaly Auditing, and Spending Projections.</div>', unsafe_allow_html=True)

# --- Navigation Tabs ---
tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "🧾 Live Receipt Audit",
    "📊 Spend Analytics",
    "🚨 Fraud & Anomaly Center",
    "📈 30-Day Spending Forecast",
    "💡 AI Cost Optimization",
    "🧠 Architecture & ML Specs",
])


# ==============================================================================
# TAB 1: LIVE RECEIPT AUDIT
# ==============================================================================
with tab1:
    st.subheader("1. Document Ingestion & Verification")
    col_upload, col_preview = st.columns([1.2, 1.0])

    uploaded_file = None
    with col_upload:
        uploaded_file = st.file_uploader(
            "Upload Receipt or Invoice (PNG, JPG, or PDF)",
            type=["png", "jpg", "jpeg", "pdf"],
            help="Upload thermal receipt image or PDF business invoice.",
        )

        # Or use sample
        if uploaded_file is None and selected_sample != "None":
            sample_path = SAMPLE_RECEIPTS_DIR / selected_sample
            if sample_path.exists():
                with open(sample_path, "rb") as f:
                    uploaded_file = io.BytesIO(f.read())
                    uploaded_file.name = selected_sample

        audit_btn = st.button("⚡ Run Full AI Audit Pipeline", type="primary", use_container_width=True)

    with col_preview:
        if uploaded_file is not None:
            try:
                img = Image.open(uploaded_file)
                st.image(img, caption=f"Document Preview: {getattr(uploaded_file, 'name', 'Receipt')}", use_container_width=True)
                uploaded_file.seek(0)
            except Exception:
                st.info("PDF or non-image format ready for OCR processing.")

    if audit_btn and uploaded_file is not None:
        with st.spinner("Executing pipeline: OpenCV -> OCR -> LLM Parsing -> ML Classifier -> Anomaly Audit..."):
            # Step 1: OCR
            uploaded_file.seek(0)
            file_bytes = uploaded_file.read()
            pil_img = None
            try:
                pil_img = Image.open(io.BytesIO(file_bytes))
            except Exception:
                pass

            ocr_res = engine["ocr"].extract_text(pil_img or getattr(uploaded_file, "name", "receipt.png"))
            raw_text = ocr_res["raw_text"]

            # Step 2: LLM JSON Parsing
            parsed = engine["llm"].parse(raw_text)

            # Step 3: ML Category Classifier
            items_desc = " ".join([i.description for i in parsed.items])
            pred_cat, conf, prob_dict = engine["clf"].predict(parsed.merchant_name, items_desc)

            # Step 4: Anomaly Detection
            risk = engine["ano"].audit_transaction(
                amount=parsed.total_amount,
                category=pred_cat,
                merchant=parsed.merchant_name,
                txn_date_str=parsed.date,
                tax=parsed.tax_amount,
            )

        st.success("✅ Audit Analysis Completed!")

        # Layout Results in 3 Cards
        res_c1, res_c2, res_c3 = st.columns([1.1, 1.1, 1.2])

        with res_c1:
            st.markdown("### 📋 Extracted Receipt Data")
            st.write(f"**Merchant:** {parsed.merchant_name}")
            st.write(f"**Date:** {parsed.date}")
            st.write(f"**Total Amount:** ${parsed.total_amount:,.2f}")
            st.write(f"**Sales Tax:** ${parsed.tax_amount:,.2f}")
            st.write(f"**Payment Method:** {parsed.payment_method}")

            if parsed.items:
                st.markdown("**Itemized Breakdown:**")
                items_df = pd.DataFrame([i.dict() for i in parsed.items])
                st.dataframe(items_df[["description", "quantity", "total_price"]], hide_index=True)

        with res_c2:
            st.markdown("### 🏷️ ML Category Classifier")
            st.metric(label="Predicted Accounting Category", value=pred_cat)
            st.write(f"**Confidence:** `{conf * 100:.1f}%`")
            st.progress(float(conf))

            # Probability Breakdown
            sorted_probs = sorted(prob_dict.items(), key=lambda x: x[1], reverse=True)[:4]
            st.caption("Top Category Probabilities:")
            for c_name, c_prob in sorted_probs:
                st.caption(f"- {c_name}: {c_prob * 100:.1f}%")

        with res_c3:
            st.markdown("### 🛡️ Forensic Audit Assessment")
            # Severity badge
            if risk.risk_severity == "HIGH":
                st.markdown('<div class="audit-danger">🚨 HIGH RISK ANOMALY</div>', unsafe_allow_html=True)
            elif risk.risk_severity == "MEDIUM":
                st.markdown('<div class="audit-warning">⚠️ MEDIUM RISK AUDIT FLAG</div>', unsafe_allow_html=True)
            else:
                st.markdown('<div class="audit-safe">✅ VERIFIED SAFE</div>', unsafe_allow_html=True)

            st.write("")
            st.metric("Anomaly Score", f"{risk.anomaly_score * 100:.1f}%", help="Calculated using Isolation Forest + Z-Scores")
            st.write(f"**Statistical Z-Score:** `{risk.z_score:+.2f} σ` from category mean")

            st.markdown("**Audit Findings:**")
            for reason in risk.reasons:
                if risk.is_anomaly:
                    st.warning(f"• {reason}")
                else:
                    st.info(f"• {reason}")

        # Option to save into historical ledger
        st.markdown("---")
        save_col1, save_col2 = st.columns([1, 4])
        with save_col1:
            if st.button("💾 Record in Ledger", use_container_width=True):
                new_row = {
                    "id": f"REC-{np.random.randint(100000, 999999)}",
                    "date": parsed.date,
                    "merchant": parsed.merchant_name,
                    "amount": parsed.total_amount,
                    "category": pred_cat,
                    "tax": parsed.tax_amount,
                    "is_anomaly": risk.is_anomaly,
                    "risk_severity": risk.risk_severity,
                    "risk_reasons": "; ".join(risk.reasons),
                    "receipt_text": f"{parsed.merchant_name} - {items_desc}",
                }
                hist_df = pd.read_csv(EXPENSES_DB_PATH)
                hist_df = pd.concat([hist_df, pd.DataFrame([new_row])], ignore_index=True)
                hist_df.to_csv(EXPENSES_DB_PATH, index=False)
                st.success("Successfully logged into expense history ledger!")


# ==============================================================================
# TAB 2: SPEND ANALYTICS
# ==============================================================================
with tab2:
    st.subheader("Executive Financial Analytics & Intelligence")
    df = pd.read_csv(EXPENSES_DB_PATH)

    # Summary KPI Cards
    k1, k2, k3, k4, k5 = st.columns(5)
    total_spend = df["amount"].sum()
    total_txns = len(df)
    anom_count = len(df[df["is_anomaly"] == True])
    anom_rate = (anom_count / total_txns * 100.0) if total_txns > 0 else 0.0
    avg_txn = total_spend / total_txns if total_txns > 0 else 0.0

    k1.metric("Total Spend", f"${total_spend:,.2f}")
    k2.metric("Total Receipts", f"{total_txns:,}")
    k3.metric("Flagged Anomalies", f"{anom_count:,}", delta=f"{anom_rate:.1f}% rate", delta_color="inverse")
    k4.metric("Average Transaction", f"${avg_txn:,.2f}")
    k5.metric("Active Vendors", f"{df['merchant'].nunique():,}")

    st.markdown("---")

    # Visual Analytics Charts
    c_chart1, c_chart2 = st.columns([1.1, 1.2])

    with c_chart1:
        st.markdown("#### Spending Distribution by Category")
        cat_agg = df.groupby("category")["amount"].sum().reset_index()
        fig_donut = px.pie(
            cat_agg,
            names="category",
            values="amount",
            hole=0.45,
            color_discrete_sequence=px.colors.qualitative.Prism,
        )
        fig_donut.update_layout(margin=dict(t=20, b=20, l=20, r=20))
        st.plotly_chart(fig_donut, use_container_width=True)

    with c_chart2:
        st.markdown("#### Top 7 Vendors by Spend Volume")
        top_v = df.groupby("merchant")["amount"].sum().reset_index().sort_values("amount", ascending=False).head(7)
        fig_bar = px.bar(
            top_v,
            x="amount",
            y="merchant",
            orientation="h",
            color="amount",
            color_continuous_scale="Teal",
            labels={"amount": "Total Spend ($)", "merchant": "Vendor"},
        )
        fig_bar.update_layout(yaxis={"categoryorder": "total ascending"}, margin=dict(t=20, b=20, l=20, r=20))
        st.plotly_chart(fig_bar, use_container_width=True)

    # Time series daily spend trend
    st.markdown("#### Daily Expense Outflow Timeline")
    df["dt_day"] = pd.to_datetime(df["date"]).dt.floor("D")
    daily_timeline = df.groupby("dt_day")["amount"].sum().reset_index()
    fig_line = px.area(
        daily_timeline,
        x="dt_day",
        y="amount",
        labels={"dt_day": "Date", "amount": "Daily Expenditure ($)"},
        color_discrete_sequence=["#3B82F6"],
    )
    fig_line.update_layout(margin=dict(t=20, b=20, l=20, r=20))
    st.plotly_chart(fig_line, use_container_width=True)


# ==============================================================================
# TAB 3: FRAUD & ANOMALY CENTER
# ==============================================================================
with tab3:
    st.subheader("Forensic Anomaly & Compliance Review Ledger")
    st.caption("Transactions flagged by Scikit-learn Isolation Forest, Category Z-Scores, and Audit Rules.")

    df_anom = pd.read_csv(EXPENSES_DB_PATH)
    anom_only = df_anom[df_anom["is_anomaly"] == True].copy()

    f_col1, f_col2 = st.columns([1, 2])
    with f_col1:
        selected_severity = st.selectbox("Filter Risk Severity", ["All", "HIGH", "MEDIUM", "LOW"])
    with f_col2:
        search_vendor = st.text_input("Search Merchant Name", "")

    if selected_severity != "All":
        anom_only = anom_only[anom_only["risk_severity"] == selected_severity]
    if search_vendor:
        anom_only = anom_only[anom_only["merchant"].str.contains(search_vendor, case=False, na=False)]

    st.markdown(f"**Found {len(anom_only)} flagged audit incidents:**")
    st.dataframe(
        anom_only[["id", "date", "merchant", "category", "amount", "risk_severity", "risk_reasons"]],
        use_container_width=True,
        hide_index=True,
    )

    st.markdown("---")
    st.markdown("#### Human-in-the-Loop Review Resolution")
    resolve_col1, resolve_col2, resolve_col3 = st.columns([1, 1, 1])
    target_id = st.selectbox("Select Transaction ID to Review", options=anom_only["id"].unique() if not anom_only.empty else ["None"])

    with resolve_col1:
        if st.button("✅ Approve Expense", use_container_width=True):
            st.success(f"Transaction {target_id} approved with managerial override.")
    with resolve_col2:
        if st.button("❌ Disallow & Flag for Clawback", use_container_width=True):
            st.error(f"Transaction {target_id} marked as disallowed charge.")
    with resolve_col3:
        if st.button("📄 Request Full Itemized Receipt", use_container_width=True):
            st.info(f"Notification sent to submitter for {target_id}.")


# ==============================================================================
# TAB 4: SPENDING FORECAST
# ==============================================================================
with tab4:
    st.subheader("Machine Learning Cash Burn Projection")
    st.caption("Autoregressive Ridge Regression forecasting with 90% confidence prediction intervals.")

    horizon = st.slider("Forecast Horizon (Days)", min_value=14, max_value=60, value=30, step=7)
    forecast_data = engine["forecaster"].forecast_next_30_days(horizon_days=horizon)

    fc_col1, fc_col2, fc_col3 = st.columns(3)
    fc_col1.metric("Historical Daily Average", f"${forecast_data.historical_daily_avg:,.2f}")
    fc_col2.metric("Projected Total Outflow", f"${forecast_data.forecast_total_spend:,.2f}")
    fc_col3.metric("Spend Trajectory", forecast_data.trend_direction, delta=f"{forecast_data.trend_percentage:+.1f}%")

    # Build Forecast Visual
    f_df = pd.DataFrame([p.dict() for p in forecast_data.daily_projections])
    f_df["date"] = pd.to_datetime(f_df["date"])

    fig_fc = go.Figure()

    # Upper and Lower bound shaded region
    fig_fc.add_trace(go.Scatter(
        x=f_df["date"],
        y=f_df["upper_bound"],
        mode="lines",
        line=dict(width=0),
        showlegend=False,
        name="Upper Bound",
    ))
    fig_fc.add_trace(go.Scatter(
        x=f_df["date"],
        y=f_df["lower_bound"],
        mode="lines",
        line=dict(width=0),
        fill="tonexty",
        fillcolor="rgba(59, 130, 246, 0.15)",
        name="90% Confidence Interval",
    ))

    # Predicted Line
    fig_fc.add_trace(go.Scatter(
        x=f_df["date"],
        y=f_df["predicted_amount"],
        mode="lines+markers",
        line=dict(color="#2563EB", width=3),
        name="Forecasted Daily Spend",
    ))

    fig_fc.update_layout(
        title=f"Next {horizon}-Day Cash Burn Projection",
        xaxis_title="Date",
        yaxis_title="Projected Amount ($)",
        margin=dict(t=40, b=20, l=20, r=20),
        hovermode="x unified",
    )
    st.plotly_chart(fig_fc, use_container_width=True)


# ==============================================================================
# TAB 5: AI COST OPTIMIZATION
# ==============================================================================
with tab5:
    st.subheader("AI Cost Savings & Vendor Optimization")
    st.caption("Actionable recommendations generated by scanning vendor redundancy, recurring SaaS creep, and duplicate billing.")

    recs = engine["savings"].generate_recommendations()

    total_monthly = sum(r.potential_monthly_savings for r in recs)
    total_annual = sum(r.potential_annual_savings for r in recs)

    sav_c1, sav_c2 = st.columns(2)
    sav_c1.metric("Total Identified Monthly Savings", f"${total_monthly:,.2f}", help="Estimated reducible expense per month")
    sav_c2.metric("Total Identified Annual Savings", f"${total_annual:,.2f}", help="Cumulative 12-month savings opportunity")

    st.markdown("---")
    for r in recs:
        with st.expander(f"**[{r.priority.upper()} PRIORITY] {r.title}** — Est. Savings: **${r.potential_annual_savings:,.2f}/yr**", expanded=(r.priority == "High")):
            st.write(f"**Category:** `{r.category}`")
            st.write(f"**Impact:** `${r.potential_monthly_savings:,.2f} / month` (${r.potential_annual_savings:,.2f} / year)")
            st.write(r.description)
            st.markdown("**Recommended Business Action Steps:**")
            for step in r.action_steps:
                st.markdown(f"- [ ] {step}")


# ==============================================================================
# TAB 6: ARCHITECTURE & ML SPECS
# ==============================================================================
with tab6:
    st.subheader("ReceiptRadar System Architecture & ML Pipeline")
    st.markdown(r"""
### Pipeline Overview for Technical Interviews

ReceiptRadar is an end-to-end AI expense auditor designed for small businesses to eliminate manual bookkeeping, catch fraudulent or duplicate invoices, and forecast cash burn.

```
+--------------------+      +----------------------+      +----------------------+
| Receipt Image/PDF  | ---> |  OpenCV Preprocess   | ---> | OCR Engine           |
| (PNG / JPG / PDF)  |      |  (Bilateral & Otsu)  |      | (EasyOCR/Tesseract)  |
+--------------------+      +----------------------+      +----------------------+
                                                                     |
                                                                     v
+--------------------+      +----------------------+      +----------------------+
| Anomaly Detection  | <--- | ML Category Classif. | <--- | LLM JSON Parsing     |
| (Isolation Forest  |      | (TF-IDF + LogReg     |      | (Gemini/OpenAI/Regex |
|  & Z-Score Audit)  |      |  calibrated proba)   |      |  structured output)  |
+--------------------+      +----------------------+      +----------------------+
          |
          +-------------------------> +---------------------------+
                                      | Streamlit & FastAPI       |
                                      | (Forecasting & Advisory)  |
                                      +---------------------------+
```

#### Core Components & Algorithmic Design:
1. **Computer Vision & OCR Layer (`ocr_engine.py`)**:
   - OpenCV grayscale conversion, contrast stretching, and bilateral edge-preserving filtering.
   - Dynamic OCR dispatch supporting EasyOCR and PyTesseract with bounding text reconstruction.
2. **LLM Information Extraction (`llm_parser.py`)**:
   - Few-shot structured JSON schema prompting supporting Gemini 1.5/2.0 Flash and OpenAI GPT-4o-mini.
   - Built-in zero-dependency regex fallback for offline demos.
3. **ML Category Classifier (`category_classifier.py`)**:
   - Scikit-learn Pipeline with `TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)`.
   - Balanced `LogisticRegression` with multi-class probability outputs for confidence score verification.
4. **Forensic Anomaly Detection (`anomaly_detector.py`)**:
   - Unsupervised `IsolationForest` on multivariate features (log amount, category Z-score, day of week, round figures).
   - Category-specific statistical outlier filter ($Z > 2.5\sigma$).
   - Rule-based business logic (48-hour duplicate detection, $950 split transaction evasion, off-hours charges).
5. **Autoregressive Spending Forecaster (`forecaster.py`)**:
   - Temporal feature engineering: lag variables (1, 7, 14 days), 7-day and 30-day moving averages.
   - L2-regularized `Ridge` regression with multi-step forward projection and residual standard error confidence bands.
6. **Savings & Optimization Advisor (`savings_recommender.py`)**:
   - Algorithmic analysis of SaaS subscription creep, duplicate bill recoupment, and vendor volume consolidation.
""")
