"""
ReceiptRadar - Page 5: Expense Insights & Savings Sentinel
==========================================================
Algorithmic detection of vendor price variance, unbudgeted category budget spikes (>25%),
and recurring subscriptions with LLM-generated plain language actionable tips.
"""

import streamlit as st
import pandas as pd

from app.components.api_client import api_get_insights, check_backend_health
from app.components.styles import (
    kpi_card,
    section_header,
    empty_state,
    format_currency,
    render_offline_banner,
)

st.markdown('<div class="app-title">💡 Expense Insights & Savings Sentinel</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">Algorithmic detection of vendor price variance, unbudgeted category '
    'budget spikes (>25%), and recurring subscriptions.</div>',
    unsafe_allow_html=True,
)

backend_url = st.session_state.get("backend_url", "http://127.0.0.1:8000")
is_online, _ = check_backend_health(backend_url)

if not is_online:
    render_offline_banner(backend_url)
    empty_state(
        title="Insights Sentinel Offline",
        message="FastAPI backend is required to analyze cross-vendor price variance and category budget spikes. Please start the backend service.",
        icon="🔌",
    )
    st.stop()

with st.spinner("Analyzing vendor price variance, budget spikes, and generating executive report..."):
    try:
        insights_res = api_get_insights(backend_url)
        audited_count = insights_res.get("total_expenses_audited", 0)
        spend_analyzed = insights_res.get("total_spend_analyzed", 0.0)
        savings = insights_res.get("total_potential_annual_savings", 0.0)
        tips = insights_res.get("actionable_tips", [])

        # Top Metrics using reusable kpi_card() helper
        s1, s2, s3 = st.columns(3)
        with s1:
            kpi_card(
                label="Potential Annual Savings",
                value=format_currency(savings, decimals=0),
                sub="Recoverable through vendor arbitrage & pruning",
                value_color="#34D399",
                icon="💵",
                tooltip="Calculated annual cash recoverable by eliminating recurring duplicates and vendor overcharges.",
            )
        with s2:
            kpi_card(
                label="Audited Expenditure",
                value=format_currency(spend_analyzed, decimals=0),
                sub=f"{audited_count:,} expense records verified",
                value_color="#FFFFFF",
                icon="📊",
                tooltip="Aggregate financial volume audited for algorithmic savings opportunities.",
            )
        with s3:
            roi_pct = (savings / spend_analyzed * 100) if spend_analyzed else 0
            kpi_card(
                label="Savings ROI",
                value=f"{roi_pct:.1f}%",
                sub="Direct operational cash flow improvement",
                value_color="#38BDF8",
                icon="📈",
                tooltip="Percentage of total audited expenditure recoverable through actionable recommendations.",
            )

        st.markdown("<br>", unsafe_allow_html=True)

        # 3 Actionable Tips Callout
        section_header("3 Actionable Tips for This Month", "AI-recommended cash flow optimizations", icon="🎯")
        for i, tip in enumerate(tips[:3]):
            title = f"Actionable Tip #{i+1}"
            st.markdown(f"""
            <div class="tip-card">
                <div class="tip-title">⚡ {title}</div>
                <div class="tip-text">{tip}</div>
            </div>
            """, unsafe_allow_html=True)

        # Tabs for Detailed Findings
        tab_pv, tab_spikes, tab_subs, tab_report = st.tabs([
            "🛒 Vendor Price Arbitrage",
            "🚨 Budget Spikes (>25%)",
            "🔁 Recurring Subscriptions",
            "📄 Plain-Language Executive Report",
        ])

        with tab_pv:
            section_header("Identical Items Purchased at Different Prices", icon="🛒")
            pv_items = insights_res.get("price_variance_findings", [])
            if pv_items:
                pv_df = pd.DataFrame(pv_items)
                st.dataframe(pv_df, use_container_width=True, hide_index=True)
            else:
                empty_state("No Significant Price Variance", "Vendors have consistent pricing across identical products.", icon="🛒")

        with tab_spikes:
            section_header("Categories Surging >25% Above 3-Month Rolling Average", icon="🚨")
            spikes = insights_res.get("category_spike_findings", [])
            if spikes:
                spikes_df = pd.DataFrame(spikes)
                st.dataframe(spikes_df, use_container_width=True, hide_index=True)
            else:
                empty_state("No Unbudgeted Spikes", "All category spend levels remain within 25% of baseline averages.", icon="✅")

        with tab_subs:
            section_header("Recurring Services & Subscriptions to Audit", icon="🔁")
            subs = insights_res.get("subscription_findings", [])
            if subs:
                subs_df = pd.DataFrame(subs)
                st.dataframe(subs_df, use_container_width=True, hide_index=True)
            else:
                empty_state("No Subscription Anomalies", "No abnormal subscription renewals or price escalations found.", icon="🔁")

        with tab_report:
            section_header("Executive Summary Report", "LLM-synthesized plain-language financial review", icon="📄")
            report_md = insights_res.get("executive_report_markdown", "")
            st.markdown(report_md)

    except Exception as e:
        st.error(f"Error fetching savings insights: {e}")
