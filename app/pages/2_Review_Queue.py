"""
ReceiptRadar - Page 2: Human-in-the-Loop Review Queue
======================================================
Verify low-confidence OCR text or ambiguous expense categories. Correcting receipts
saves feedback to CSV and retrains the model.
"""

import time
import uuid
from pathlib import Path
import streamlit as st
import pandas as pd

from src.config import DATA_DIR
from app.components.api_client import (
    api_get_review_queue,
    api_post_correct_expense,
    api_post_retrain_feedback,
    check_backend_health,
)
from app.components.styles import (
    kpi_card,
    section_header,
    empty_state,
    status_badge,
    format_currency,
    render_offline_banner,
)
from app.components.ui_helpers import STANDARD_CATEGORIES

st.markdown('<div class="app-title">📋 Human-in-the-Loop Review Queue</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">Verify low-confidence OCR text or ambiguous expense categories. '
    'Correcting receipts saves feedback to CSV and retrains the model.</div>',
    unsafe_allow_html=True,
)

backend_url = st.session_state.get("backend_url", "http://127.0.0.1:8000")
feedback_csv_path = DATA_DIR / "human_feedback_corrections.csv"

is_online, _ = check_backend_health(backend_url)
if not is_online:
    render_offline_banner(backend_url)

# Fetch review queue from backend
pending_items = []
if is_online:
    try:
        pending_items = api_get_review_queue(backend_url)
    except Exception as e:
        st.error(f"Failed to fetch review queue from backend: {e}")
else:
    # Try local sqlite fallback
    try:
        from src.api.database import SessionLocal, ExpenseModel
        db_s = SessionLocal()
        rows = db_s.query(ExpenseModel).filter(ExpenseModel.needs_review == True).all()
        pending_items = [r.to_dict() for r in rows]
        db_s.close()
    except Exception:
        pass

# Load existing feedback audit trail if present
feedback_df = pd.DataFrame()
if feedback_csv_path.exists():
    try:
        feedback_df = pd.read_csv(feedback_csv_path)
    except Exception:
        pass

# Top KPI summary cards using reusable kpi_card() helper
k1, k2, k3, k4 = st.columns(4)
with k1:
    pending_color = "#F87171" if len(pending_items) > 0 else "#34D399"
    kpi_card(
        label="Pending Reviews",
        value=str(len(pending_items)),
        sub="Below confidence gates",
        value_color=pending_color,
        icon="⏳",
        tooltip="Receipts whose OCR or category confidence fell below defined quality gates requiring manual sign-off.",
    )

with k2:
    saved_count = len(feedback_df) if not feedback_df.empty else 0
    kpi_card(
        label="Human Corrections",
        value=str(saved_count),
        sub="Saved in feedback CSV",
        value_color="#38BDF8",
        icon="✍️",
        tooltip="Cumulative verified corrections logged to the active learning dataset.",
    )

with k3:
    applied_count = (
        int((feedback_df["applied_in_training"] == True).sum())
        if not feedback_df.empty and "applied_in_training" in feedback_df.columns
        else 0
    )
    kpi_card(
        label="Trained Feedback",
        value=str(applied_count),
        sub="Incorporated into ML pipeline",
        value_color="#A78BFA",
        icon="🧠",
        tooltip="Corrections that have been absorbed by the SGDClassifier model during feedback retraining cycles.",
    )

with k4:
    kpi_card(
        label="Confidence Gates",
        value="OCR: 60% | CLF: 65%",
        sub="Automatic routing thresholds",
        value_color="#FBBF24",
        icon="🛡️",
        tooltip="Pre-configured quality gates: OCR < 0.60 or Classifier < 0.65 automatically routes documents here.",
    )

st.markdown("<br>", unsafe_allow_html=True)

# Action Toolbar
t1, t2 = st.columns([1, 1])
with t1:
    if st.button("🔄 Refresh Queue", use_container_width=True):
        st.rerun()
with t2:
    if st.button("🚀 Retrain Classifier on Feedback Now", type="primary", use_container_width=True, disabled=(not is_online)):
        with st.spinner("Retraining winning pipeline with oversampled human feedback..."):
            try:
                res = api_post_retrain_feedback(backend_url)
                st.success(
                    f"✅ Retraining Complete! Applied {res.get('corrections_applied', 0)} corrections. "
                    f"Training Accuracy: {res.get('training_accuracy', 1.0)*100:.2f}% across {res.get('total_training_examples', 0):,} examples."
                )
                time.sleep(1)
                st.rerun()
            except Exception as err:
                st.error(f"Retraining failed: {err}")

st.markdown("---")

# Review Items Section
if not pending_items:
    empty_state(
        title="Review Queue is Empty!",
        message="All ingested receipts meet high confidence standards (OCR ≥ 60%, Classifier ≥ 65%). No manual verification needed.",
        icon="🎉",
    )

    with st.expander("🧪 Simulate Flagged Low-Confidence Receipt for Testing"):
        st.write("Click below to insert a sample ambiguous receipt (e.g. low classifier confidence) to test the Human-in-the-Loop workflow.")
        if st.button("➕ Inject Test Low-Confidence Expense"):
            try:
                from src.api.database import SessionLocal, ExpenseModel
                db_sess = SessionLocal()
                sim_id = str(uuid.uuid4())
                sim_expense = ExpenseModel(
                    id=sim_id,
                    date="2026-03-28",
                    vendor="Kisan Krishi Kendra & Hardware",
                    item_description="Pesticide spray nozzle and pipe fittings with loose rubber washer",
                    amount=1850.0,
                    category="misc",
                    payment_mode="UPI",
                    tax=92.5,
                    is_anomaly=False,
                    anomaly_score=0.15,
                    risk_severity="LOW",
                    risk_reasons="Simulated low confidence test record",
                    raw_text="Kisan Krishi Kendra - sprayer nozzles 1850",
                    ocr_confidence=0.55,
                    classifier_confidence=0.48,
                    needs_review=True,
                    review_reason="Low classifier confidence (0.48 < 0.65) | Low OCR confidence (0.55 < 0.60)",
                )
                db_sess.add(sim_expense)
                db_sess.commit()
                db_sess.close()
                st.success("Inserted test ambiguous receipt into SQLite review queue!")
                time.sleep(0.5)
                st.rerun()
            except Exception as ex:
                st.error(f"Error injecting test record: {ex}")
else:
    section_header(f"Pending Verification ({len(pending_items)} items)", "Review low-confidence fields and assign verified categories", icon="🚩")

    for idx, item in enumerate(pending_items):
        exp_id = item.get("id", f"exp_{idx}")
        vendor = item.get("vendor", item.get("merchant", "Unknown Merchant"))
        amount = float(item.get("amount", 0.0))
        date = item.get("date", "N/A")
        curr_cat = str(item.get("category", "misc")).lower()
        desc_text = item.get("item_description", "")
        raw_text = item.get("raw_text", item.get("receipt_text", ""))
        clf_conf = float(item.get("classifier_confidence", 0.50))
        ocr_conf = float(item.get("ocr_confidence", 0.50))
        reason = item.get("review_reason", "Low confidence score")

        badge_action = status_badge("ACTION REQUIRED", status_type="danger", icon="🚨")

        with st.container():
            st.markdown(f"""
            <div class="kpi-card" style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF;">{vendor} &bull; {format_currency(amount)}</div>
                    <div>{badge_action}</div>
                </div>
                <div style="display: flex; gap: 24px; font-size: 0.85rem; color: #94A3B8; margin-bottom: 8px;">
                    <div>📅 <b>Date:</b> <span style="color: #F8FAFC;">{date}</span></div>
                    <div>🏷️ <b>Predicted:</b> <code style="color: #38BDF8;">{curr_cat}</code></div>
                    <div>🤖 <b>CLF Conf:</b> <span style="color: {'#F87171' if clf_conf < 0.65 else '#34D399'}; font-weight: 700;">{clf_conf*100:.1f}%</span></div>
                    <div>🔍 <b>OCR Conf:</b> <span style="color: {'#F87171' if ocr_conf < 0.60 else '#34D399'}; font-weight: 700;">{ocr_conf*100:.1f}%</span></div>
                </div>
                <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 6px; padding: 6px 12px; font-size: 0.82rem; color: #FBBF24; margin-bottom: 8px;">
                    ⚠️ <b>Review Reason:</b> {reason}
                </div>
                <div style="font-size: 0.82rem; color: #CBD5E1; margin-bottom: 4px;">
                    📝 <b>Extracted Description:</b> {desc_text}
                </div>
            </div>
            """, unsafe_allow_html=True)

            with st.expander(f"✍️ Review & Correct Record: {vendor} ({format_currency(amount, decimals=0)})", expanded=True):
                with st.form(key=f"correction_form_{exp_id}"):
                    c_col1, c_col2 = st.columns(2)
                    with c_col1:
                        cat_index = STANDARD_CATEGORIES.index(curr_cat) if curr_cat in STANDARD_CATEGORIES else 0
                        new_cat = st.selectbox(
                            "Correct Expense Category",
                            STANDARD_CATEGORIES,
                            index=cat_index,
                            key=f"cat_{exp_id}",
                        )
                        new_vendor = st.text_input(
                            "Vendor Name",
                            value=vendor,
                            key=f"vend_{exp_id}",
                        )
                    with c_col2:
                        new_desc = st.text_input(
                            "Item Description",
                            value=desc_text,
                            key=f"desc_{exp_id}",
                        )
                        notes = st.text_input(
                            "Reviewer Notes / Correction Reason",
                            value="Human verified category",
                            key=f"notes_{exp_id}",
                        )

                    if raw_text:
                        st.caption(f"Raw OCR text: `{raw_text[:120]}...`" if len(raw_text) > 120 else f"Raw OCR text: `{raw_text}`")

                    submit_correction = st.form_submit_button("💾 Save Correction & Approve Record", type="primary", disabled=(not is_online))

                    if submit_correction:
                        with st.spinner("Submitting correction and writing audit log..."):
                            payload = {
                                "corrected_category": new_cat,
                                "corrected_vendor": new_vendor,
                                "corrected_description": new_desc,
                                "notes": notes,
                            }
                            try:
                                resp = api_post_correct_expense(backend_url, exp_id, payload)
                                st.success(f"✅ Record approved! Category updated to '{new_cat}'. Appended to feedback audit log.")
                                time.sleep(0.5)
                                st.rerun()
                            except Exception as ex:
                                st.error(f"Failed to submit correction: {ex}")

st.markdown("---")

# Human Feedback Audit Trail Table
section_header("Human Feedback Corrections Audit Trail", "Historical record of manual verifications used in retraining", icon="📜")
if not feedback_df.empty:
    st.dataframe(feedback_df, hide_index=True, use_container_width=True)
    csv_bytes = feedback_df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "⬇️ Download Feedback Corrections CSV",
        data=csv_bytes,
        file_name="human_feedback_corrections.csv",
        mime="text/csv",
    )
else:
    empty_state(
        title="No Feedback Logged Yet",
        message="When you verify and correct receipts above, they will appear here and be stored in data/human_feedback_corrections.csv.",
        icon="📝",
    )
