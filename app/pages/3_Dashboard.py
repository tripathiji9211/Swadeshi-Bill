"""
ReceiptRadar - Page 3: Financial Intelligence Dashboard
========================================================
Real-time expenditure telemetry across 5,000 audited Indian small-business
expense records stored in SQLite with KPI cards, multi-dimensional filters,
interactive Plotly charts, and categorized tabs (Overview, Categories, Vendors, Anomalies).
"""

from datetime import datetime
from pathlib import Path
import streamlit as st
import pandas as pd
import numpy as np

from src.config import DATA_DIR, EXPENSES_DB_PATH
from app.components.api_client import api_get_expenses, check_backend_health
from app.components.charts import (
    render_monthly_spend_trend,
    render_category_pie_chart,
    render_category_bar_chart,
    render_top_vendors_bar_chart,
    render_anomaly_severity_pie_chart,
)
from app.components.styles import (
    kpi_card,
    section_header,
    empty_state,
    status_badge,
    format_currency,
    render_offline_banner,
)

st.markdown('<div class="app-title">📊 Financial Intelligence Dashboard</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">Real-time expenditure telemetry across 5,000 audited Indian small-business '
    'expense records stored in SQLite with multi-engine anomaly surveillance.</div>',
    unsafe_allow_html=True,
)

backend_url = st.session_state.get("backend_url", "http://127.0.0.1:8000")
is_online, _ = check_backend_health(backend_url)

if not is_online:
    render_offline_banner(backend_url)

# 1. Fetch data from FastAPI backend (or fallback to SQLite/CSV)
df = None
if is_online:
    try:
        raw_expenses = api_get_expenses(backend_url, params={"limit": 5000})
        if raw_expenses:
            df = pd.DataFrame(raw_expenses)
    except Exception:
        pass

if df is None or df.empty:
    csv_file = DATA_DIR / "processed" / "cleaned_indian_expenses.csv"
    if not csv_file.exists():
        csv_file = EXPENSES_DB_PATH
    if csv_file.exists():
        df = pd.read_csv(csv_file)
        if "vendor_normalized" in df.columns:
            df["vendor"] = df["vendor_normalized"]

if df is None or df.empty:
    empty_state(
        title="No Expense Data Available",
        message="Unable to load expense records from the SQLite database or CSV files. Check FastAPI backend connection.",
        icon="⚠️",
    )
    st.stop()

# Ensure standard columns & data types
df["date_dt"] = pd.to_datetime(df["date"], errors="coerce")
df["month_year"] = df["date_dt"].dt.strftime("%Y-%m")
if "ocr_confidence" not in df.columns:
    df["ocr_confidence"] = 0.85
else:
    df["ocr_confidence"] = df["ocr_confidence"].fillna(0.85)

if "risk_reasons" not in df.columns:
    df["risk_reasons"] = df.get("is_anomaly", False).map(lambda a: "Statistical outlier spike" if a else "Clean audit pass")
if "risk_severity" not in df.columns:
    df["risk_severity"] = df.get("is_anomaly", False).map(lambda a: "HIGH" if a else "LOW")

# =============================================================================
# 2. FILTER BAR (Date Range, Category, Vendor)
# =============================================================================
with st.container():
    st.markdown("""
    <div style="background: #131B2E; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 0.82rem; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
            🔍 Filter Expenditure Records
        </div>
    </div>
    """, unsafe_allow_html=True)

    f1, f2, f3, f4 = st.columns([1.3, 1.2, 1.3, 0.9])

    # Date Range Filter
    valid_dates = df["date_dt"].dropna()
    min_date = valid_dates.min().date() if not valid_dates.empty else datetime(2023, 1, 1).date()
    max_date = valid_dates.max().date() if not valid_dates.empty else datetime(2026, 12, 31).date()

    with f1:
        date_selection = st.date_input(
            "Date Range",
            value=(min_date, max_date),
            min_value=min_date,
            max_value=max_date,
            key="dash_date_filter",
        )

    # Category Filter
    all_categories = sorted([str(c) for c in df["category"].dropna().unique()])
    with f2:
        selected_category = st.selectbox(
            "Category",
            options=["All Categories"] + all_categories,
            index=0,
            key="dash_cat_filter",
        )

    # Vendor Filter
    all_vendors = sorted([str(v) for v in df["vendor"].dropna().unique()])
    with f3:
        selected_vendor = st.selectbox(
            "Merchant / Vendor",
            options=["All Vendors"] + all_vendors,
            index=0,
            key="dash_vendor_filter",
        )

    # Anomaly Quick-Toggle Filter
    with f4:
        only_anomalies = st.checkbox("Only Anomalies", value=False, key="dash_anom_checkbox")
        max_rows = st.number_input("Limit Rows", min_value=50, max_value=5000, value=2500, step=250)

# Apply dynamic filters
filtered_df = df.copy()

# Date range filtering
if isinstance(date_selection, tuple) and len(date_selection) == 2:
    start_d, end_d = date_selection
    filtered_df = filtered_df[
        (filtered_df["date_dt"].dt.date >= start_d) & (filtered_df["date_dt"].dt.date <= end_d)
    ]
elif isinstance(date_selection, tuple) and len(date_selection) == 1:
    filtered_df = filtered_df[filtered_df["date_dt"].dt.date >= date_selection[0]]

# Category filter
if selected_category != "All Categories":
    filtered_df = filtered_df[filtered_df["category"] == selected_category]

# Vendor filter
if selected_vendor != "All Vendors":
    filtered_df = filtered_df[filtered_df["vendor"] == selected_vendor]

# Anomaly filter
if only_anomalies:
    filtered_df = filtered_df[filtered_df["is_anomaly"] == True]

filtered_df = filtered_df.head(max_rows)


# =============================================================================
# 3. TOP ROW OF 4 KPI CARDS (Total Spend, Receipts Processed, Anomalies, Avg OCR)
# =============================================================================
total_spend = float(filtered_df["amount"].sum())
total_count = len(filtered_df)
anom_subset = filtered_df[filtered_df["is_anomaly"] == True]
anom_count = len(anom_subset)
anom_rate = (anom_count / total_count * 100.0) if total_count > 0 else 0.0
avg_spend = (total_spend / total_count) if total_count > 0 else 0.0
avg_ocr_conf = float(filtered_df["ocr_confidence"].mean() * 100.0) if total_count > 0 else 85.0

k1, k2, k3, k4 = st.columns(4)
with k1:
    kpi_card(
        label="Total Spend",
        value=format_currency(total_spend, decimals=0),
        sub=f"{total_count:,} invoices aggregated",
        value_color="#38BDF8",
        icon="💳",
        tooltip="Total net expenditure across all invoices matching the active filters.",
    )
with k2:
    kpi_card(
        label="Receipts Processed",
        value=f"{total_count:,}",
        sub=f"Avg {format_currency(avg_spend, decimals=0)} per ticket",
        value_color="#FFFFFF",
        icon="🧾",
        tooltip="Total number of discrete receipt records audited in the SQLite store.",
    )
with k3:
    kpi_card(
        label="Anomalies Flagged",
        value=f"{anom_count:,}",
        sub=f"{anom_rate:.1f}% forensic risk rate",
        value_color="#F87171" if anom_count > 0 else "#34D399",
        icon="🚨",
        tooltip="Transactions flagged by Isolation Forest or Category Z-Score analysis exceeding risk thresholds.",
    )
with k4:
    ocr_gate_status = "≥85% Optimal Quality" if avg_ocr_conf >= 85.0 else "<85% Moderate Quality"
    kpi_card(
        label="Avg OCR Confidence",
        value=f"{avg_ocr_conf:.1f}%",
        sub=ocr_gate_status,
        value_color="#34D399" if avg_ocr_conf >= 85.0 else "#FBBF24",
        icon="🔍",
        tooltip="Mean character recognition confidence score generated by EasyOCR across processed documents.",
    )

st.markdown("<br>", unsafe_allow_html=True)


# =============================================================================
# 4. DASHBOARD TABS (Overview, Categories, Vendors, Anomalies)
# =============================================================================
tab_overview, tab_categories, tab_vendors, tab_anomalies = st.tabs([
    "📊 Overview",
    "🏷️ Categories",
    "🏪 Vendors",
    "🚨 Anomalies",
])

# -----------------------------------------------------------------------------
# TAB 1: OVERVIEW
# -----------------------------------------------------------------------------
with tab_overview:
    section_header(f"Monthly Spend Trend ({st.session_state.get('currency_setting', 'INR')})", "Aggregated monthly cash expenditure over time", icon="📈")

    monthly_summary = (
        filtered_df.groupby("month_year")["amount"]
        .sum()
        .reset_index()
        .sort_values("month_year")
    )

    if not monthly_summary.empty:
        fig_trend = render_monthly_spend_trend(monthly_summary)
        st.plotly_chart(fig_trend, use_container_width=True)
    else:
        st.info("No time-series data available for the selected filters.")

    # Overview Sub-Metrics
    st.markdown("<br>", unsafe_allow_html=True)
    m_sub1, m_sub2, m_sub3 = st.columns(3)
    with m_sub1:
        daily_avg = total_spend / max(len(filtered_df["date_dt"].dt.date.unique()), 1)
        kpi_card(
            label="Daily Spend Velocity",
            value=f"{format_currency(daily_avg, decimals=0)} / day",
            sub="Average daily cash burn rate",
            value_color="#A78BFA",
            icon="⚡",
            tooltip="Total spend divided by number of active business days in the selected timeframe.",
        )
    with m_sub2:
        median_ticket = float(filtered_df["amount"].median()) if total_count > 0 else 0.0
        kpi_card(
            label="Median Ticket Size",
            value=format_currency(median_ticket, decimals=0),
            sub="50th percentile transaction cost",
            value_color="#FFFFFF",
            icon="🎯",
            tooltip="Median receipt amount (robust to high-dollar outlier purchases).",
        )
    with m_sub3:
        if not monthly_summary.empty:
            peak_row = monthly_summary.loc[monthly_summary["amount"].idxmax()]
            peak_label = f"{peak_row['month_year']} ({format_currency(peak_row['amount'], decimals=0)})"
        else:
            peak_label = "N/A"
        kpi_card(
            label="Peak Outlay Month",
            value=peak_label,
            sub="Highest monthly expenditure recorded",
            value_color="#38BDF8",
            icon="🏔️",
            tooltip="The calendar month with the highest aggregate audited expenditure.",
        )

    # Recent Invoices Table Preview
    st.markdown("<br>", unsafe_allow_html=True)
    section_header("Recent Audited Invoices Preview", "Latest 10 transactions matching current filters", icon="📋")
    recent_cols = ["date", "vendor", "amount", "category", "payment_mode", "is_anomaly", "risk_severity"]
    recent_df = filtered_df[recent_cols].copy().head(10)
    recent_df["amount"] = recent_df["amount"].map(lambda x: format_currency(x, decimals=2))
    recent_df = recent_df.rename(columns={
        "date": "Date",
        "vendor": "Merchant / Vendor",
        "amount": "Amount",
        "category": "Category",
        "payment_mode": "Payment Mode",
        "is_anomaly": "Anomaly Flag",
        "risk_severity": "Severity",
    })
    st.dataframe(recent_df, hide_index=True, use_container_width=True)


# -----------------------------------------------------------------------------
# TAB 2: CATEGORIES
# -----------------------------------------------------------------------------
with tab_categories:
    cat_summary = (
        filtered_df.groupby("category")
        .agg(
            amount=("amount", "sum"),
            count=("amount", "count"),
            avg_ticket=("amount", "mean"),
        )
        .reset_index()
        .sort_values("amount", ascending=False)
    )
    cat_summary["share_pct"] = (cat_summary["amount"] / total_spend * 100.0) if total_spend > 0 else 0.0

    c_cat1, c_cat2 = st.columns([1.1, 1.3], gap="large")
    with c_cat1:
        section_header("Category Allocation Donut", "Distribution of spend across categories", icon="🍩")
        fig_donut = render_category_pie_chart(cat_summary[["category", "amount"]])
        st.plotly_chart(fig_donut, use_container_width=True)

    with c_cat2:
        section_header("Category Outlay Ranking", "Volume-ranked category spending totals", icon="📊")
        fig_bars = render_category_bar_chart(cat_summary[["category", "amount"]])
        st.plotly_chart(fig_bars, use_container_width=True)

    st.markdown("<br>", unsafe_allow_html=True)
    section_header("Category Telemetry Summary Table", icon="📑")
    cat_display_df = cat_summary.rename(columns={
        "category": "Expense Category",
        "amount": "Total Spend",
        "count": "Invoices Count",
        "avg_ticket": "Average Ticket",
        "share_pct": "Share of Spend (%)",
    })
    cat_display_df["Total Spend"] = cat_display_df["Total Spend"].map(lambda x: format_currency(x, decimals=2))
    cat_display_df["Average Ticket"] = cat_display_df["Average Ticket"].map(lambda x: format_currency(x, decimals=2))
    cat_display_df["Share of Spend (%)"] = cat_display_df["Share of Spend (%)"].map(lambda x: f"{x:.1f}%")
    st.dataframe(cat_display_df, hide_index=True, use_container_width=True)


# -----------------------------------------------------------------------------
# TAB 3: VENDORS
# -----------------------------------------------------------------------------
with tab_vendors:
    vendor_summary = (
        filtered_df.groupby("vendor")
        .agg(
            amount=("amount", "sum"),
            count=("amount", "count"),
            avg_ticket=("amount", "mean"),
            primary_category=("category", lambda s: s.mode().iloc[0] if not s.empty else "misc"),
        )
        .reset_index()
        .sort_values("amount", ascending=False)
    )
    top_10_vendors = vendor_summary.head(10)

    v_col1, v_col2 = st.columns([1.3, 1.1], gap="large")
    with v_col1:
        section_header("Top 10 Merchants by Total Spend", "Highest volume counterparties", icon="🏪")
        fig_vendors = render_top_vendors_bar_chart(top_10_vendors[["vendor", "amount"]])
        st.plotly_chart(fig_vendors, use_container_width=True)

    with v_col2:
        section_header("Vendor Concentration Metrics", icon="💼")
        top_5_spend = vendor_summary.head(5)["amount"].sum()
        top_5_share = (top_5_spend / total_spend * 100.0) if total_spend > 0 else 0.0
        unique_vendors_count = len(vendor_summary)

        kpi_card(
            label="Top 5 Counterparties Share",
            value=f"{top_5_share:.1f}%",
            sub=f"{format_currency(top_5_spend, decimals=0)} across top 5 suppliers",
            value_color="#FBBF24" if top_5_share > 50 else "#34D399",
            icon="⚠️",
        )
        st.markdown("<br>", unsafe_allow_html=True)
        kpi_card(
            label="Active Vendor Base",
            value=f"{unique_vendors_count:,} Vendors",
            sub="Unique suppliers in current filter",
            value_color="#FFFFFF",
            icon="🏬",
        )

    st.markdown("<br>", unsafe_allow_html=True)
    section_header("Full Vendor Portfolio Table", icon="📑")
    vendor_display_df = vendor_summary.rename(columns={
        "vendor": "Merchant / Vendor",
        "primary_category": "Primary Category",
        "amount": "Total Spend",
        "count": "Invoices Audited",
        "avg_ticket": "Avg Ticket Size",
    })
    vendor_display_df["Total Spend"] = vendor_display_df["Total Spend"].map(lambda x: format_currency(x, decimals=2))
    vendor_display_df["Avg Ticket Size"] = vendor_display_df["Avg Ticket Size"].map(lambda x: format_currency(x, decimals=2))
    st.dataframe(vendor_display_df.head(100), hide_index=True, use_container_width=True)


# -----------------------------------------------------------------------------
# TAB 4: ANOMALIES (Metrics, Severity Chart & Expander Table with "Why flagged?")
# -----------------------------------------------------------------------------
with tab_anomalies:
    anom_total_spend = anom_subset["amount"].sum()
    high_risk_count = int((anom_subset["risk_severity"] == "HIGH").sum())
    med_risk_count = int((anom_subset["risk_severity"] == "MEDIUM").sum())

    a_col1, a_col2 = st.columns([1.1, 1.2], gap="large")
    with a_col1:
        section_header("Forensic Anomaly Overview", "Detected by rule-based, Z-score, and Isolation Forest models", icon="🛡️")

        a_sub1, a_sub2 = st.columns(2)
        with a_sub1:
            kpi_card(
                label="At-Risk Spend",
                value=format_currency(anom_total_spend, decimals=0),
                sub=f"{(anom_total_spend/total_spend*100 if total_spend else 0):.1f}% of total budget",
                value_color="#F87171",
                icon="🚨",
            )
        with a_sub2:
            kpi_card(
                label="High Severity Spikes",
                value=f"{high_risk_count:,}",
                sub="Requires immediate review",
                value_color="#EF4444",
                icon="🔴",
            )

        kpi_card(
            label="Medium Risk Flags",
            value=f"{med_risk_count:,}",
            sub="Moderate statistical deviation (>2σ)",
            value_color="#FBBF24",
            icon="🟡",
        )

    with a_col2:
        section_header("Severity Breakdown", "Risk tier allocation of flagged transactions", icon="🍩")
        if anom_count > 0:
            sev_counts = anom_subset["risk_severity"].value_counts().reset_index()
            sev_counts.columns = ["severity", "count"]
            fig_sev = render_anomaly_severity_pie_chart(sev_counts)
            st.plotly_chart(fig_sev, use_container_width=True)
        else:
            empty_state("No Anomalies in Filter", "All transactions in current filter range passed audit checks.", icon="✅")

    st.markdown("<br>", unsafe_allow_html=True)

    # REQUIRED: Anomaly Table in an expander with a "Why flagged?" column
    with st.expander("🚨 Flagged Anomaly Surveillance Table (with 'Why flagged?' details)", expanded=True):
        if anom_count > 0:
            anom_table_df = anom_subset[[
                "date", "vendor", "amount", "category", "risk_severity", "risk_reasons", "ocr_confidence"
            ]].copy()

            # Clean and map "Why flagged?" column explicitly
            anom_table_df["ocr_conf_str"] = anom_table_df["ocr_confidence"].map(lambda x: f"{x*100:.1f}%")
            anom_table_df["formatted_amount"] = anom_table_df["amount"].map(lambda x: format_currency(x, decimals=2))

            anom_table_df = anom_table_df.rename(columns={
                "date": "Date",
                "vendor": "Merchant / Vendor",
                "formatted_amount": "Amount",
                "category": "Category",
                "risk_severity": "Severity",
                "risk_reasons": "Why flagged?",
                "ocr_conf_str": "OCR Confidence",
            })[["Date", "Merchant / Vendor", "Amount", "Category", "Severity", "Why flagged?", "OCR Confidence"]]

            st.dataframe(anom_table_df, hide_index=True, use_container_width=True)

            # Specific anomaly download button
            anom_csv = anom_table_df.to_csv(index=False).encode("utf-8")
            st.download_button(
                label="📥 Download Flagged Anomalies Only (CSV)",
                data=anom_csv,
                file_name=f"flagged_anomalies_{datetime.now().strftime('%Y%m%d')}.csv",
                mime="text/csv",
                key="download_anomalies_only_btn",
            )
        else:
            st.success("✅ Clean audit pass! Zero anomalies detected within current filter parameters.")


# =============================================================================
# 5. GLOBAL CSV EXPORT
# =============================================================================
st.markdown("---")
exp_col1, exp_col2 = st.columns([1.5, 1.0])
with exp_col1:
    section_header("Export Filtered Dataset", "Download complete audited records matching current filters", icon="📥")
with exp_col2:
    export_cols = [
        c for c in ["date", "vendor", "item_description", "amount", "category", "payment_mode", "is_anomaly", "risk_severity", "risk_reasons", "ocr_confidence"]
        if c in filtered_df.columns
    ]
    export_df = filtered_df[export_cols].copy()
    if "risk_reasons" in export_df.columns:
        export_df = export_df.rename(columns={"risk_reasons": "Why flagged?"})

    csv_data = export_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        label=f"📥 Download Filtered Expenses ({len(filtered_df):,} Rows CSV)",
        data=csv_data,
        file_name=f"audited_expenses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        mime="text/csv",
        type="primary",
        use_container_width=True,
        key="global_csv_download_btn",
    )
