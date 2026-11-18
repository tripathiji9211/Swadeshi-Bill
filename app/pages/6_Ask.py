"""
ReceiptRadar - Page 6: Ask Your Expenses (AI Copilot)
=====================================================
Natural language conversational financial analyst powered by Google Gemini and SQLite.
"""

import streamlit as st
from app.components.api_client import api_post_ask, check_backend_health
from app.components.styles import (
    section_header,
    render_offline_banner,
    empty_state,
)

st.markdown('<div class="app-title">💬 Ask Your Expenses (AI Copilot)</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">Ask questions in plain English or Hinglish about your expenses. '
    'The copilot pulls live data from your SQLite database and provides factual answers with exact Rupee figures.</div>',
    unsafe_allow_html=True,
)

backend_url = st.session_state.get("backend_url", "http://127.0.0.1:8000")
is_online, _ = check_backend_health(backend_url)

if not is_online:
    render_offline_banner(backend_url)
    empty_state(
        title="AI Copilot Offline",
        message="Cannot reach FastAPI backend. Please run 'python -m uvicorn src.api.main:app --port 8000' in terminal to enable interactive natural-language queries.",
        icon="🔌",
    )
    st.stop()

# Pre-populated Quick Question Chips
section_header("Suggested Financial Inquiries", "Click any question below to audit expenditure instantly", icon="💡")
chip_cols = st.columns(4)
preset_questions = [
    "What was our highest spending category?",
    "How many anomalies were detected and what is the at-risk amount?",
    "Who are our top 5 vendors by spend?",
    "How much did we spend on fuel and utilities?",
]

selected_prompt = None
for idx, (col, q_text) in enumerate(zip(chip_cols, preset_questions)):
    with col:
        if st.button(f"💡 {q_text[:34]}...", key=f"chip_{idx}", use_container_width=True):
            selected_prompt = q_text

st.markdown("<br>", unsafe_allow_html=True)

# Display Chat History
for message in st.session_state.messages:
    avatar = "🤖" if message["role"] == "assistant" else "👤"
    with st.chat_message(message["role"], avatar=avatar):
        st.markdown(message["content"])

# Chat Input
user_input = st.chat_input("Ask a question about your business expenses...")
prompt_to_send = selected_prompt or user_input

if prompt_to_send:
    # Display user message
    st.session_state.messages.append({"role": "user", "content": prompt_to_send})
    with st.chat_message("user", avatar="👤"):
        st.markdown(prompt_to_send)

    # Call FastAPI backend
    with st.chat_message("assistant", avatar="🤖"):
        with st.spinner("Analyzing database and querying Gemini..."):
            try:
                ask_res = api_post_ask(backend_url, prompt_to_send)
                ans = ask_res.get("answer", "I could not generate an answer.")
                st.markdown(ans)

                metrics = ask_res.get("relevant_metrics", {})
                if metrics:
                    with st.expander("📊 View Referenced Metrics from SQLite"):
                        st.json(metrics)

                st.session_state.messages.append({"role": "assistant", "content": ans})

            except Exception as e:
                err_text = f"Error processing query: {e}"
                st.error(err_text)
                st.session_state.messages.append({"role": "assistant", "content": err_text})
