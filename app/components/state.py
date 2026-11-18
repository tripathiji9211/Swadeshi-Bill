"""
ReceiptRadar - Unified Session State Management
================================================
Centralizes Streamlit session state initialization across all multi-page modules.
"""

import streamlit as st
from app.components.api_client import DEFAULT_API_URL


def init_session_state():
    """Initializes global session state keys if not already defined."""
    if "backend_url" not in st.session_state:
        st.session_state.backend_url = DEFAULT_API_URL

    if "currency_setting" not in st.session_state:
        st.session_state.currency_setting = "INR (₹)"

    if "messages" not in st.session_state:
        st.session_state.messages = [
            {
                "role": "assistant",
                "content": (
                    "Namaste! I am **ReceiptRadar AI**, your financial auditor. "
                    "You can ask me anything about your 5,000 audited expenses, "
                    "such as highest spending categories, detected anomalies, vendor breakdowns, or next month's forecast."
                ),
            }
        ]

    if "last_uploaded_result" not in st.session_state:
        st.session_state.last_uploaded_result = None

    if "selected_sample" not in st.session_state:
        st.session_state.selected_sample = "None"
