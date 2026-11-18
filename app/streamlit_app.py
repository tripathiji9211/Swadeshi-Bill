"""
ReceiptRadar - Streamlit Application Entrypoint
================================================
Multi-page application router powered by `st.navigation` and `st.Page`.

Architecture:
- app/components/
    - styles.py        -> Global design system CSS, fonts, badges, cards
    - api_client.py    -> Backend REST API client & health check
    - ui_helpers.py    -> Sidebar indicators, metric cards, sample file loaders
    - charts.py        -> Plotly data visualizations (trends, pies, bars)
    - state.py         -> Centralized session state initialization
- app/pages/
    - 1_Upload.py          -> Page 1: Ingest & Audit Receipt
    - 2_Review_Queue.py    -> Page 2: Human-in-the-Loop Review Queue
    - 3_Dashboard.py       -> Page 3: Financial Intelligence Dashboard
    - 4_Forecast.py        -> Page 4: Spend Forecasting Engine
    - 5_Insights.py        -> Page 5: Expense Insights & Savings Sentinel
    - 6_Ask.py             -> Page 6: Ask Your Expenses AI Copilot
"""

import sys
from pathlib import Path

# Add project root to sys.path so modules resolve cleanly across all subpages
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import streamlit as st

from app.components.styles import apply_global_styles
from app.components.state import init_session_state
from app.components.ui_helpers import render_sidebar_header_and_status

# 1. Global Page Configuration (must be called first)
st.set_page_config(
    page_title="ReceiptRadar | AI Expense Auditor",
    page_icon="🧾",
    layout="wide",
    initial_sidebar_state="expanded",
)

# 2. Inject Design System & Initialize Shared Session State
apply_global_styles()
init_session_state()

# 3. Sidebar Header, Backend Status & Demo Sample Selectors
backend_url, is_online = render_sidebar_header_and_status()

# 4. Multi-Page Navigation Definition
PAGES_DIR = Path(__file__).resolve().parent / "pages"

upload_page = st.Page(
    str(PAGES_DIR / "1_Upload.py"),
    title="Upload Receipt",
    icon="🧾",
    default=True,
)
review_page = st.Page(
    str(PAGES_DIR / "2_Review_Queue.py"),
    title="Needs Review Queue",
    icon="📋",
)
dashboard_page = st.Page(
    str(PAGES_DIR / "3_Dashboard.py"),
    title="Dashboard",
    icon="📊",
)
forecast_page = st.Page(
    str(PAGES_DIR / "4_Forecast.py"),
    title="Forecast",
    icon="📈",
)
insights_page = st.Page(
    str(PAGES_DIR / "5_Insights.py"),
    title="Savings Insights",
    icon="💡",
)
ask_page = st.Page(
    str(PAGES_DIR / "6_Ask.py"),
    title="Ask Your Expenses",
    icon="💬",
)
about_page = st.Page(
    str(PAGES_DIR / "7_About.py"),
    title="How It Works",
    icon="ℹ️",
)

# Group navigation into logical operational sections
nav = st.navigation(
    {
        "Operations": [upload_page, review_page],
        "Intelligence & Analytics": [dashboard_page, forecast_page, insights_page, ask_page],
        "System": [about_page],
    }
)

# 5. Execute Current Active Page
nav.run()
