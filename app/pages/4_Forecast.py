"""
ReceiptRadar - Page 4: Spend Forecasting Engine
================================================
Predicts next month's spend per category comparing SARIMA, XGBoost with lag features,
and Moving Average models trained on 24 months of business history.
"""

import streamlit as st
import pandas as pd

from app.components.api_client import api_get_forecast, check_backend_health
from app.components.charts import render_forecast_bar_chart
from app.components.styles import (
    kpi_card,
    section_header,
    format_currency,
    render_offline_banner,
    empty_state,
)

st.markdown('<div class="app-title">📈 Spend Forecasting Engine</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">Predicts next month\'s spend per category comparing SARIMA, '
    'XGBoost with lag features, and Moving Average models trained on 24 months of business history.</div>',
    unsafe_allow_html=True,
)

backend_url = st.session_state.get("backend_url", "http://127.0.0.1:8000")
is_online, _ = check_backend_health(backend_url)

if not is_online:
    render_offline_banner(backend_url)
    empty_state(
        title="Forecasting Engine Offline",
        message="The FastAPI backend service is not reachable. Connect to the backend to generate time-series forecasts.",
        icon="🔌",
    )
    st.stop()

with st.spinner("Generating category projections using trained time-series estimators..."):
    try:
        forecast_res = api_get_forecast(backend_url)
        target_month = forecast_res.get("forecast_month", "Next Month")
        target_date = forecast_res.get("forecast_date", "2024-12-01")
        proj_dict = forecast_res.get("category_projections", {})
        total_proj = forecast_res.get("total_projected_spend", 0.0)

        # Forecast KPI Row using reusable kpi_card() helper
        k1, k2, k3 = st.columns(3)
        with k1:
            kpi_card(
                label="Forecast Horizon",
                value=str(target_month),
                sub=f"Target Start Date: {target_date}",
                value_color="#38BDF8",
                icon="📅",
                tooltip="Target calendar projection window evaluated from historical monthly run-rates.",
            )
        with k2:
            kpi_card(
                label="Total Projected Spend",
                value=format_currency(total_proj, decimals=0),
                sub="Sum of all 8 category projections",
                value_color="#FFFFFF",
                icon="💰",
                tooltip="Ensemble aggregated expenditure predicted across SARIMA and XGBoost lag estimators.",
            )
        with k3:
            top_cat = max(proj_dict, key=proj_dict.get) if proj_dict else "N/A"
            top_val = proj_dict.get(top_cat, 0.0)
            share_pct = (top_val / total_proj * 100) if total_proj else 0
            kpi_card(
                label="Primary Spend Driver",
                value=top_cat.title(),
                sub=f"{format_currency(top_val, decimals=0)} ({share_pct:.1f}% of forecast)",
                value_color="#34D399",
                icon="🏆",
                tooltip="The largest forecasted expenditure category by aggregate projected amount.",
            )

        st.markdown("<br>", unsafe_allow_html=True)

        # Category Bar Chart
        section_header("Next Month's Projected Category Breakdown", "Machine learning projected spend across categories", icon="📊")
        f_df = pd.DataFrame([
            {"Category": k.title(), "Projected Spend": v}
            for k, v in proj_dict.items()
        ]).sort_values("Projected Spend", ascending=False)

        fig_bar = render_forecast_bar_chart(f_df.rename(columns={"Projected Spend": "Projected Spend (INR)"}))
        st.plotly_chart(fig_bar, use_container_width=True)

        # Data Table with formatted currency
        section_header("Category Projection Details", icon="📋")
        display_f_df = f_df.copy()
        display_f_df["Formatted Outlay"] = display_f_df["Projected Spend"].map(lambda x: format_currency(x, decimals=2))
        st.dataframe(display_f_df[["Category", "Formatted Outlay"]], hide_index=True, use_container_width=True)

        # Methodology Notes
        with st.expander("🧠 Forecasting Architecture & Methodology"):
            st.markdown("""
            **Model Selection Strategy:**
            1. **SARIMA(1,1,0)(0,1,0)[12]**: Chosen for recurring utilities and predictable seasonal expenses with strong cyclicality.
            2. **XGBoost with Autoregressive Lags (L1, L2, L3 + 3M Rolling Mean/Std)**: Chosen for high-variance categories like marketing and miscellaneous expenses where recent momentum is highly predictive.
            3. **Moving-Average Baseline (3-Month Window)**: Robust backoff for stable, inelastic categories like fixed rent and baseline supplies.
            """)

    except Exception as e:
        st.error(f"Error fetching spend forecast: {e}")
