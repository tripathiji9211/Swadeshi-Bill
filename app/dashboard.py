"""
ReceiptRadar - Streamlit AI Expense Auditor Dashboard
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

from src.ocr.engine import OCREngine
from src.parsing.parser import LLMParser
from src.models.classifier import CategoryClassifier
from src.models.anomaly import ExpenseAnomalyDetector
from src.models.forecaster import SpendingForecaster
from src.models.recommender import SavingsRecommender
from src.config import (
    SAMPLE_RECEIPTS_DIR,
    EXPENSES_DB_PATH,
    EXPENSE_CATEGORIES,
)
from src.utils.sample_data import ensure_sample_database, generate_sample_receipt_suite

st.set_page_config(
    page_title="ReceiptRadar | AI Expense Auditor",
    page_icon="🧾",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    .main-header { font-size: 2.2rem; font-weight: 700; color: #1E293B; margin-bottom: 0.2rem; }
    .sub-header { font-size: 1.05rem; color: #64748B; margin-bottom: 1.5rem; }
    .audit-safe { background-color: #DCFCE7; color: #166534; padding: 6px 12px; border-radius: 20px; font-weight: 600; display: inline-block; }
    .audit-warning { background-color: #FEF9C3; color: #854D0E; padding: 6px 12px; border-radius: 20px; font-weight: 600; display: inline-block; }
    .audit-danger { background-color: #FEE2E2; color: #991B1B; padding: 6px 12px; border-radius: 20px; font-weight: 600; display: inline-block; }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def get_audit_engine():
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

# Sidebar
with st.sidebar:
    st.image("https://img.icons8.com/isometric/100/receipt.png", width=70)
    st.title("ReceiptRadar")
    st.caption("AI-Powered Financial Sentinel for Small Businesses")
    st.markdown("---")

    backend_url = st.text_input("FastAPI Backend Endpoint", value="http://localhost:8000")
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
    sample_files = list(SAMPLE_RECEIPTS_DIR.glob("*.png"))
    selected_sample = st.selectbox("Choose Sample Receipt", options=["None"] + [f.name for f in sample_files], index=0)

    st.markdown("---")
    if st.button("🔄 Retrain ML Models"):
        with st.spinner("Retraining NLP Classifier & Isolation Forest..."):
            clf_m = engine["clf"].train_on_history()
            ano_m = engine["ano"].train_on_history()
            st.success(f"Models retrained! Accuracy: {clf_m.get('test_accuracy', 0.9):.1%}")

# Main Header
st.markdown('<div class="main-header">ReceiptRadar: AI Expense Auditor & Intelligence</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">Automated OCR Extraction, LLM JSON Structuring, ML Category Classification, Forensic Anomaly Auditing, and Spending Projections.</div>', unsafe_allow_html=True)

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "🧾 Live Receipt Audit",
    "📊 Spend Analytics",
    "🚨 Fraud & Anomaly Center",
    "📈 30-Day Spending Forecast",
    "💡 AI Cost Optimization",
    "🧠 Architecture & ML Specs",
])

# TAB 1: LIVE RECEIPT AUDIT
with tab1:
    st.subheader("1. Document Ingestion & Verification")
    col_upload, col_preview = st.columns([1.2, 1.0])

    uploaded_file = None
    with col_upload:
        uploaded_file = st.file_uploader("Upload Receipt or Invoice (PNG, JPG, PDF)", type=["png", "jpg", "jpeg", "pdf"])
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
                st.image(img, caption=f"Preview: {getattr(uploaded_file, 'name', 'Receipt')}", use_container_width=True)
                uploaded_file.seek(0)
            except Exception:
                st.info("Document ready for processing.")

    if audit_btn and uploaded_file is not None:
        with st.spinner("Running pipeline: OCR -> LLM -> Classifier -> Anomaly Audit..."):
            uploaded_file.seek(0)
            file_bytes = uploaded_file.read()
            pil_img = None
            try:
                pil_img = Image.open(io.BytesIO(file_bytes))
            except Exception:
                pass

            ocr_res = engine["ocr"].extract_text(pil_img or getattr(uploaded_file, "name", "receipt.png"))
            raw_text = ocr_res["raw_text"]
            parsed = engine["llm"].parse(raw_text)

            items_desc = " ".join([i.description for i in parsed.items])
            pred_cat, conf, prob_dict = engine["clf"].predict(parsed.merchant_name, items_desc)
            risk = engine["ano"].audit_transaction(
                amount=parsed.total_amount,
                category=pred_cat,
                merchant=parsed.merchant_name,
                txn_date_str=parsed.date,
                tax=parsed.tax_amount,
            )

        st.success("✅ Audit Completed!")
        c1, c2, c3 = st.columns([1.1, 1.1, 1.2])
        with c1:
            st.markdown("### 📋 Extracted Data")
            st.write(f"**Merchant:** {parsed.merchant_name}")
            st.write(f"**Date:** {parsed.date}")
            st.write(f"**Total Amount:** ${parsed.total_amount:,.2f}")
            st.write(f"**Tax:** ${parsed.tax_amount:,.2f}")
            if parsed.items:
                st.dataframe(pd.DataFrame([i.dict() for i in parsed.items])[["description", "quantity", "total_price"]], hide_index=True)
        with c2:
            st.markdown("### 🏷️ ML Category")
            st.metric("Predicted Category", pred_cat)
            st.write(f"**Confidence:** `{conf * 100:.1f}%`")
            st.progress(float(conf))
        with c3:
            st.markdown("### 🛡️ Audit Findings")
            if risk.risk_severity == "HIGH":
                st.markdown('<div class="audit-danger">🚨 HIGH RISK ANOMALY</div>', unsafe_allow_html=True)
            elif risk.risk_severity == "MEDIUM":
                st.markdown('<div class="audit-warning">⚠️ MEDIUM RISK FLAG</div>', unsafe_allow_html=True)
            else:
                st.markdown('<div class="audit-safe">✅ VERIFIED SAFE</div>', unsafe_allow_html=True)
            st.write(f"**Anomaly Score:** `{risk.anomaly_score * 100:.1f}%` | **Z-Score:** `{risk.z_score:+.2f}σ`")
            for reason in risk.reasons:
                st.warning(f"• {reason}") if risk.is_anomaly else st.info(f"• {reason}")

# TAB 2: SPEND ANALYTICS
with tab2:
    st.subheader("Executive Financial Analytics")
    df = pd.read_csv(EXPENSES_DB_PATH)
    k1, k2, k3, k4 = st.columns(4)
    tot = df["amount"].sum()
    anoms = len(df[df["is_anomaly"] == True])
    k1.metric("Total Spend", f"${tot:,.2f}")
    k2.metric("Total Receipts", f"{len(df):,}")
    k3.metric("Flagged Anomalies", f"{anoms:,}", delta=f"{(anoms/len(df)*100):.1f}%", delta_color="inverse")
    k4.metric("Avg Transaction", f"${tot/len(df):,.2f}")

    ch1, ch2 = st.columns(2)
    with ch1:
        cat_agg = df.groupby("category")["amount"].sum().reset_index()
        fig_pie = px.pie(cat_agg, names="category", values="amount", hole=0.4)
        st.plotly_chart(fig_pie, use_container_width=True)
    with ch2:
        top_v = df.groupby("merchant")["amount"].sum().reset_index().sort_values("amount", ascending=False).head(6)
        fig_bar = px.bar(top_v, x="amount", y="merchant", orientation="h", color="amount")
        st.plotly_chart(fig_bar, use_container_width=True)

# TAB 3: FRAUD & ANOMALY CENTER
with tab3:
    st.subheader("Forensic Audit Ledger")
    df_anom = pd.read_csv(EXPENSES_DB_PATH)
    anom_only = df_anom[df_anom["is_anomaly"] == True]
    st.dataframe(anom_only[["id", "date", "merchant", "category", "amount", "risk_severity", "risk_reasons"]], use_container_width=True, hide_index=True)

# TAB 4: SPENDING FORECAST
with tab4:
    st.subheader("Machine Learning Cash Burn Projection")
    horizon = st.slider("Forecast Horizon (Days)", 14, 60, 30, 7)
    fc = engine["forecaster"].forecast_next_30_days(horizon_days=horizon)
    st.metric("Projected Total Outflow", f"${fc.forecast_total_spend:,.2f}", delta=f"{fc.trend_direction} {fc.trend_percentage:+.1f}%")
    f_df = pd.DataFrame([p.dict() for p in fc.daily_projections])
    f_df["date"] = pd.to_datetime(f_df["date"])
    fig_fc = px.line(f_df, x="date", y="predicted_amount", title=f"Next {horizon}-Day Spend Forecast")
    st.plotly_chart(fig_fc, use_container_width=True)

# TAB 5: AI COST OPTIMIZATION
with tab5:
    st.subheader("AI Cost Savings & Vendor Optimization")
    recs = engine["savings"].generate_recommendations()
    s1, s2 = st.columns(2)
    s1.metric("Identified Monthly Savings", f"${sum(r.potential_monthly_savings for r in recs):,.2f}")
    s2.metric("Identified Annual Savings", f"${sum(r.potential_annual_savings for r in recs):,.2f}")
    for r in recs:
        with st.expander(f"**[{r.priority}] {r.title}** (Est: ${r.potential_annual_savings:,.2f}/yr)"):
            st.write(r.description)
            for step in r.action_steps:
                st.markdown(f"- [ ] {step}")

# TAB 6: ARCHITECTURE
with tab6:
    st.subheader("ReceiptRadar Architecture")
    st.markdown(r"""
```
Receipt (Image/PDF) -> OpenCV Prep -> OCR -> LLM JSON -> ML Classifier (TF-IDF + LogReg)
                   -> Anomaly Detection (Isolation Forest + Z-Scores)
                   -> Autoregressive Ridge Forecaster -> AI Savings Engine
```
""")
