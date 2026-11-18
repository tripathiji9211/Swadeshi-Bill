"""
ReceiptRadar - Shared UI Helper Components (Dark Fintech Theme)
================================================================
Sidebar connection status and centralized review alert banners.
Maintains sidebar strictly to navigation, backend connection, and currency settings.
"""

from typing import Tuple, List
import streamlit as st
from app.components.api_client import check_backend_health, DEFAULT_API_URL

STANDARD_CATEGORIES: List[str] = [
    "office_supplies",
    "utilities",
    "rent",
    "travel",
    "marketing",
    "software",
    "meals",
    "repairs",
    "inventory",
    "misc",
]


def render_sidebar_header_and_status() -> Tuple[str, bool]:
    """
    Renders sidebar branding, FastAPI connection status, and currency setting only.
    Keeps sidebar clean and minimal for st.navigation.
    Returns:
        (backend_url: str, is_online: bool)
    """
    with st.sidebar:
        st.markdown("""
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 2rem;">🧾</span>
            <div>
                <div style="font-size: 1.25rem; font-weight: 800; color: #FFFFFF; line-height: 1.1; letter-spacing: -0.02em;">ReceiptRadar</div>
                <div style="font-size: 0.74rem; color: #94A3B8; font-weight: 500;">AI Expense Auditor & Forecaster</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        current_url = st.session_state.get("backend_url", DEFAULT_API_URL)
        backend_url = st.text_input(
            "FastAPI Backend URL",
            value=current_url,
            help="URL where src/api/main.py is serving.",
            key="sidebar_backend_url_input",
        )
        st.session_state.backend_url = backend_url

        is_online, health_data = check_backend_health(backend_url)

        if is_online:
            st.markdown("""
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
                <div style="color: #34D399; font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 7px;">
                    <span style="height: 8px; width: 8px; background-color: #10B981; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #10B981;"></span>
                    Backend Online (FastAPI)
                </div>
                <div style="color: #A7F3D0; font-size: 0.72rem; margin-top: 3px;">SQLite DB • Isolation Forest • Gemini</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown("""
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(248, 113, 113, 0.3); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
                <div style="color: #F87171; font-size: 0.82rem; font-weight: 700; display: flex; align-items: center; gap: 7px;">
                    <span style="height: 8px; width: 8px; background-color: #EF4444; border-radius: 50%; display: inline-block;"></span>
                    Backend Disconnected
                </div>
                <div style="color: #FECACA; font-size: 0.72rem; margin-top: 3px;">Run: <code>python -m uvicorn src.api.main:app --port 8000</code></div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("---")

        # Global Currency Setting Selector
        st.selectbox(
            "Currency Display",
            options=["INR (₹)", "USD ($)", "EUR (€)", "GBP (£)"],
            index=0,
            key="currency_setting",
            help="Sets the active currency symbol throughout the entire dashboard.",
        )

        st.markdown("---")

    return backend_url, is_online


def render_review_alert_banner_html(reason: str) -> str:
    """Returns HTML for the warning banner displayed when a receipt is routed to review queue."""
    return f"""
    <div style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(251, 191, 36, 0.35); border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;">
        <div style="color: #FBBF24; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span> Routed to Human Review Queue
        </div>
        <div style="color: #FDE68A; font-size: 0.84rem; margin-top: 4px;">
            <b>Reason:</b> {reason}
        </div>
        <div style="color: #D97706; font-size: 0.80rem; margin-top: 6px;">
            Navigate to <b>📋 Needs Review Queue</b> to verify or correct the category and trigger classifier retraining.
        </div>
    </div>
    """
