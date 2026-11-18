"""
ReceiptRadar - Page 1: 3-Step Ingest, Review & Audit Flow
==========================================================
Step 1: Upload (file uploader + sample selector)
Step 2: Review Extraction (side-by-side: original image on the left, editable fields & line items table on the right)
Step 3: Audit Result (category, symmetric OCR/CLF confidence cards, anomaly risk badge + gauge, and Save to Database button)
"""

import io
import time
from pathlib import Path
from typing import Dict, Any, List
import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image

from src.config import SAMPLE_RECEIPTS_DIR
from src.ocr.extract import preprocess_receipt
from app.components.api_client import api_post_upload_receipt, check_backend_health
from app.components.styles import (
    get_risk_badge_html,
    section_header,
    kpi_card,
    empty_state,
    status_badge,
    format_currency,
    render_offline_banner,
    render_confidence_card,
    render_risk_gauge_card,
)
from app.components.ui_helpers import render_review_alert_banner_html

# Page Header
st.markdown('<div class="app-title">🧾 Ingest & Audit Receipt</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="app-subtitle">A seamless 3-step pipeline: Upload receipt &rarr; '
    'Review extracted fields side-by-side with the original document &rarr; '
    'Audit forensic anomaly metrics and persist to database.</div>',
    unsafe_allow_html=True,
)

backend_url = st.session_state.get("backend_url", "http://127.0.0.1:8000")
is_online, _ = check_backend_health(backend_url)

if not is_online:
    render_offline_banner(backend_url)

# Initialize session state keys for 3-step persistence
if "upload_file_bytes" not in st.session_state:
    st.session_state.upload_file_bytes = None
if "upload_file_name" not in st.session_state:
    st.session_state.upload_file_name = None
if "original_image" not in st.session_state:
    st.session_state.original_image = None
if "preprocessed_image" not in st.session_state:
    st.session_state.preprocessed_image = None
if "preprocessing_meta" not in st.session_state:
    st.session_state.preprocessing_meta = {}
if "audit_result" not in st.session_state:
    st.session_state.audit_result = None
if "is_saved_to_db" not in st.session_state:
    st.session_state.is_saved_to_db = False

# Step completion status indicators
has_extraction = st.session_state.audit_result is not None
is_saved = st.session_state.is_saved_to_db

step1_status = "✅ Completed" if has_extraction else "🟡 Active"
step2_status = "✅ Reviewed" if has_extraction else "⚪ Pending"
step3_status = "✅ Saved" if is_saved else ("🟡 Ready" if has_extraction else "⚪ Pending")

# Visual Stepper Bar
st.markdown(f"""
<div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; background: #131B2E; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px 20px;">
    <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: {'#10B981' if has_extraction else '#3B82F6'}; color: #FFFFFF; border-radius: 50%; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">1</span>
        <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: #FFFFFF;">1. Upload</div>
            <div style="font-size: 0.74rem; color: {'#34D399' if has_extraction else '#94A3B8'};">{step1_status}</div>
        </div>
    </div>
    <div style="color: rgba(255, 255, 255, 0.2); font-size: 1.2rem;">&rarr;</div>
    <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: {'#10B981' if has_extraction else '#64748B'}; color: #FFFFFF; border-radius: 50%; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">2</span>
        <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: #FFFFFF;">2. Review Extraction</div>
            <div style="font-size: 0.74rem; color: {'#34D399' if has_extraction else '#64748B'};">{step2_status}</div>
        </div>
    </div>
    <div style="color: rgba(255, 255, 255, 0.2); font-size: 1.2rem;">&rarr;</div>
    <div style="display: flex; align-items: center; gap: 8px;">
        <span style="background: {'#10B981' if is_saved else ('#F59E0B' if has_extraction else '#64748B')}; color: #FFFFFF; border-radius: 50%; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem;">3</span>
        <div>
            <div style="font-weight: 700; font-size: 0.88rem; color: #FFFFFF;">3. Audit Result</div>
            <div style="font-size: 0.74rem; color: {'#34D399' if is_saved else ('#FBBF24' if has_extraction else '#64748B')};">{step3_status}</div>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# 3-Step Navigation Tabs
tab_upload, tab_review, tab_audit = st.tabs([
    "📤 1. Upload Document",
    "🔍 2. Review Extraction",
    "🛡️ 3. Audit Result",
])


# =============================================================================
# TAB 1: UPLOAD (File Uploader + Sample Selector + Staged Progress Spinner)
# =============================================================================
with tab_upload:
    col_u1, col_u2 = st.columns([1.1, 1.2], gap="large")

    with col_u1:
        section_header("Choose Document or Sample", "Select an image file or choose a pre-loaded Indian SMB invoice", icon="📁")

        # 1. User Upload
        user_upload = st.file_uploader(
            "Upload Receipt Document",
            type=["png", "jpg", "jpeg", "pdf", "txt"],
            help="Accepts smartphone photos, scans, and invoices in English, Hindi, and Hinglish.",
            key="tab1_user_upload",
        )

        st.markdown("<div style='text-align: center; color: #64748B; font-weight: 600; margin: 8px 0;'>&mdash; OR &mdash;</div>", unsafe_allow_html=True)

        # 2. Sample Selector
        sample_images = sorted([p.name for p in SAMPLE_RECEIPTS_DIR.glob("*.png") if not p.name.startswith("debug_")]) if SAMPLE_RECEIPTS_DIR.exists() else []
        sample_options = ["None"] + sample_images
        chosen_sample = st.selectbox(
            "Select Demo Indian SMB Receipt",
            sample_options,
            index=0,
            key="tab1_sample_select",
        )

        # Determine target file to process
        selected_bytes = None
        selected_filename = None
        selected_pil = None

        if user_upload is not None:
            user_upload.seek(0)
            selected_bytes = user_upload.read()
            selected_filename = user_upload.name
            try:
                user_upload.seek(0)
                selected_pil = Image.open(user_upload).convert("RGB")
            except Exception:
                selected_pil = None
        elif chosen_sample != "None":
            sample_path = SAMPLE_RECEIPTS_DIR / chosen_sample
            if sample_path.exists():
                with open(sample_path, "rb") as f:
                    selected_bytes = f.read()
                selected_filename = chosen_sample
                try:
                    selected_pil = Image.open(sample_path).convert("RGB")
                except Exception:
                    selected_pil = None

        st.markdown("<br>", unsafe_allow_html=True)
        process_btn = st.button(
            "⚡ Process Document (OCR + Extract)",
            type="primary",
            use_container_width=True,
            disabled=(selected_bytes is None or not is_online),
        )

    with col_u2:
        section_header("Selected Document Preview", "Always shows the original, unprocessed image", icon="🖼️")

        if selected_pil is not None:
            st.image(selected_pil, caption=f"Original Document: {selected_filename}", use_container_width=True)
        elif selected_bytes is not None:
            st.info(f"📄 Text Document Selected: `{selected_filename}` ({len(selected_bytes):,} bytes)")
        else:
            empty_state("No Document Selected", "Choose an image file on the left or select a sample invoice to preview.", icon="📄")

    # Processing Pipeline with Staged Progress Spinner
    if process_btn and selected_bytes is not None:
        st.session_state.upload_file_bytes = selected_bytes
        st.session_state.upload_file_name = selected_filename
        st.session_state.original_image = selected_pil
        st.session_state.is_saved_to_db = False

        # Generate preprocessed image in the background (OpenCV deskew + denoising + binarization)
        if selected_pil is not None:
            try:
                proc_arr, meta = preprocess_receipt(selected_pil)
                st.session_state.preprocessed_image = proc_arr
                st.session_state.preprocessing_meta = meta
            except Exception as pe:
                st.session_state.preprocessed_image = None
                st.session_state.preprocessing_meta = {"error": str(pe)}

        # Progressive Stage Status
        with st.status("⚡ Running Receipt Processing Pipeline...", expanded=True) as status_box:
            st.write("🔍 **Stage 1/4:** Executing Optical Character Recognition (EasyOCR en + hi)...")
            time.sleep(0.3)
            st.write("🧠 **Stage 2/4:** Structuring vendor, dates, amounts & line items (LLM Parser)...")
            time.sleep(0.3)
            st.write("🏷️ **Stage 3/4:** Classifying expense category with calibrated confidence...")
            time.sleep(0.3)
            st.write("🚨 **Stage 4/4:** Auditing fraud & anomaly risk (Isolation Forest + Z-score)...")

            try:
                result = api_post_upload_receipt(backend_url, selected_bytes, selected_filename)
                st.session_state.audit_result = result
                st.session_state.last_uploaded_result = result

                # Initialize editable fields in session state
                parsed = result.get("parsed_receipt", {})
                st.session_state.edit_vendor = parsed.get("vendor", "Unknown Vendor")
                st.session_state.edit_date = parsed.get("date", "2026-03-25")
                st.session_state.edit_amount = float(parsed.get("total", 0.0))
                st.session_state.edit_tax = float(parsed.get("tax", 0.0))
                st.session_state.edit_payment_mode = "UPI"

                # Items table
                items_raw = parsed.get("line_items", [])
                if items_raw:
                    st.session_state.edit_items_df = pd.DataFrame(items_raw)
                    if "name" in st.session_state.edit_items_df.columns:
                        st.session_state.edit_items_df = st.session_state.edit_items_df.rename(
                            columns={"name": "description", "qty": "quantity", "price": "unit_price"}
                        )
                else:
                    st.session_state.edit_items_df = pd.DataFrame([
                        {"description": f"Expense at {st.session_state.edit_vendor}", "quantity": 1.0, "unit_price": st.session_state.edit_amount, "total_price": st.session_state.edit_amount}
                    ])

                status_box.update(
                    label="✅ Pipeline Completed Successfully! Proceed to Step 2 to review extracted fields.",
                    state="complete",
                    expanded=False,
                )
                st.success("🎉 Receipt extracted! Click the **'2. Review Extraction'** tab above to inspect fields.")
                time.sleep(0.8)
                st.rerun()

            except Exception as err:
                status_box.update(label=f"❌ Processing Failed: {err}", state="error")
                st.error(f"Error executing pipeline: {err}")


# =============================================================================
# TAB 2: REVIEW EXTRACTION (Side-by-Side: Original Image vs Editable Fields)
# =============================================================================
with tab_review:
    if not has_extraction:
        empty_state(
            title="No Extraction Available Yet",
            message="Please upload or select a receipt in Step 1 and click 'Process Document' to review extracted fields.",
            icon="🔍",
        )
    else:
        col_img, col_fields = st.columns([1.1, 1.3], gap="large")

        # LEFT COLUMN: Original Uploaded Image (Always original, never preprocessed)
        with col_img:
            section_header("Original Uploaded Document", "Inspect image quality and verify extracted data", icon="📄")

            if st.session_state.original_image is not None:
                st.image(
                    st.session_state.original_image,
                    caption=f"Original Document: {st.session_state.upload_file_name}",
                    use_container_width=True,
                )
            elif st.session_state.upload_file_bytes is not None:
                st.info(f"📄 Text Document Loaded: `{st.session_state.upload_file_name}`")

            # OPTIONAL EXPANDER: Preprocessed image (OpenCV Denoised & Deskewed)
            with st.expander("🖼️ View preprocessed image (OpenCV Denoised & Deskewed)", expanded=False):
                if st.session_state.preprocessed_image is not None:
                    st.image(
                        st.session_state.preprocessed_image,
                        caption="OpenCV Binarized & Deskewed Input",
                        use_container_width=True,
                    )
                    meta = st.session_state.preprocessing_meta
                    st.caption(
                        f"**Deskew Angle:** {meta.get('skew_angle_deg', 0.0)}° | "
                        f"**Threshold Method:** {meta.get('threshold_method', 'otsu')} | "
                        f"**Resolution:** {meta.get('preprocessed_shape', 'N/A')}"
                    )
                else:
                    st.caption("Preprocessed image is only available for visual image scans (PNG/JPG).")

            # Raw OCR Text Expander
            with st.expander("📄 View Raw OCR Text Output", expanded=False):
                raw_ocr_text = (
                    st.session_state.audit_result.get("expense", {}).get("raw_text")
                    or st.session_state.audit_result.get("raw_text", "No raw OCR text available.")
                )
                st.text(raw_ocr_text)

        # RIGHT COLUMN: Editable Extracted Fields & Line Items Table
        with col_fields:
            section_header("Editable Extracted Fields", "Verify and correct OCR values before final audit approval", icon="✍️")

            with st.container():
                c_f1, c_f2 = st.columns(2)
                with c_f1:
                    vendor_val = st.text_input(
                        "Merchant / Vendor Name",
                        value=st.session_state.get("edit_vendor", ""),
                        key="input_vendor_edit",
                    )
                    st.session_state.edit_vendor = vendor_val

                    date_val = st.text_input(
                        "Transaction Date (YYYY-MM-DD)",
                        value=st.session_state.get("edit_date", ""),
                        key="input_date_edit",
                    )
                    st.session_state.edit_date = date_val

                with c_f2:
                    amount_val = st.number_input(
                        "Total Amount",
                        min_value=0.0,
                        value=float(st.session_state.get("edit_amount", 0.0)),
                        step=50.0,
                        format="%.2f",
                        key="input_amount_edit",
                    )
                    st.session_state.edit_amount = amount_val

                    tax_val = st.number_input(
                        "GST / Tax Amount",
                        min_value=0.0,
                        value=float(st.session_state.get("edit_tax", 0.0)),
                        step=10.0,
                        format="%.2f",
                        key="input_tax_edit",
                    )
                    st.session_state.edit_tax = tax_val

                payment_mode_options = ["UPI", "Credit Card", "Debit Card", "Cash", "Net Banking", "Cheque"]
                current_mode = st.session_state.get("edit_payment_mode", "UPI")
                mode_index = payment_mode_options.index(current_mode) if current_mode in payment_mode_options else 0
                pay_val = st.selectbox(
                    "Payment Mode",
                    payment_mode_options,
                    index=mode_index,
                    key="input_pay_mode_edit",
                )
                st.session_state.edit_payment_mode = pay_val

            st.markdown("<br>", unsafe_allow_html=True)
            section_header("Extracted Line Items Table", "Add, edit, or remove line item descriptions and unit prices", icon="📋")

            # Interactive Line Items Data Editor
            items_df = st.session_state.get("edit_items_df", pd.DataFrame())
            if not items_df.empty:
                edited_df = st.data_editor(
                    items_df,
                    num_rows="dynamic",
                    use_container_width=True,
                    key="interactive_line_items_editor",
                )
                st.session_state.edit_items_df = edited_df
            else:
                st.info("No line items extracted. You can add items in the table below.")

            st.markdown("<br>", unsafe_allow_html=True)
            col_b1, col_b2 = st.columns([1, 1])
            with col_b1:
                st.success("✅ Changes in this tab are automatically synchronized.")
            with col_b2:
                st.info("👉 Switch to **'3. Audit Result'** tab to inspect anomaly scores and save to database.")


# =============================================================================
# TAB 3: AUDIT RESULT (Category, Symmetric Confidence Cards, Risk Badge + Gauge)
# =============================================================================
with tab_audit:
    if not has_extraction:
        empty_state(
            title="No Audit Results Available",
            message="Please complete Step 1 (Upload) to execute category classification and anomaly detection.",
            icon="🛡️",
        )
    else:
        audit_res = st.session_state.audit_result
        exp = audit_res.get("expense", {})
        pred_cat = audit_res.get("predicted_category", "misc")
        conf = float(audit_res.get("category_confidence", 0.0))
        clf_conf = float(audit_res.get("classifier_confidence", conf))
        ocr_conf = float(audit_res.get("ocr_confidence", 0.85))
        risk = audit_res.get("audit_risk", {})
        severity = risk.get("risk_severity", "LOW")
        is_anom = risk.get("is_anomaly", False)
        score = float(risk.get("anomaly_score", 0.0))
        expense_id = audit_res.get("expense_id", exp.get("id", "N/A"))

        # High-Level Summary Card reflecting edits made in Tab 2 with unified format_currency
        active_vendor = st.session_state.get("edit_vendor", exp.get("vendor", "Unknown Merchant"))
        active_amount = float(st.session_state.get("edit_amount", exp.get("amount", 0.0)))
        active_date = st.session_state.get("edit_date", exp.get("date", "N/A"))
        active_tax = float(st.session_state.get("edit_tax", exp.get("tax", 0.0)))

        badge_html = get_risk_badge_html(severity)

        st.markdown(f"""
        <div class="kpi-card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="font-size: 1.25rem; font-weight: 800; color: #FFFFFF;">{active_vendor}</div>
                <div>{badge_html}</div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.90rem; color: #94A3B8;">
                <div>📅 <b>Date:</b> <span style="color: #F8FAFC;">{active_date}</span></div>
                <div>💰 <b>Verified Total:</b> <span style="color: #38BDF8; font-weight: 700;">{format_currency(active_amount)}</span></div>
                <div>🏛️ <b>GST / Tax:</b> <span style="color: #F8FAFC;">{format_currency(active_tax)}</span></div>
                <div>💳 <b>Mode:</b> <span style="color: #F8FAFC;">{st.session_state.get('edit_payment_mode', 'UPI')}</span></div>
            </div>
            <div style="margin-top: 10px; font-size: 0.78rem; color: #64748B;">
                🆔 <b>Database ID:</b> <code style="color: #38BDF8;">{expense_id}</code>
            </div>
        </div>
        """, unsafe_allow_html=True)

        # Review Queue Notification Banner
        needs_rev = audit_res.get("needs_review", False)
        rev_reason = audit_res.get("review_reason", "")
        if needs_rev:
            st.markdown(render_review_alert_banner_html(rev_reason), unsafe_allow_html=True)

        # Confidence & Forensic Metric Tiles (SYMMETRIC STYLE + RISK BADGE + GAUGE)
        section_header("Forensic Confidence & Anomaly Metrics", "Symmetric confidence gating and risk gauge assessment", icon="📊")

        m1, m2, m3 = st.columns(3)

        # Metric 1: Classifier Confidence (Symmetric Card Style)
        with m1:
            render_confidence_card(
                label=f"CLASSIFIER: {pred_cat.upper()}",
                confidence=clf_conf,
                threshold=0.65,
                flag_message="Low Conf Flag",
                icon="🏷️",
            )

        # Metric 2: OCR Confidence (Symmetric Card Style)
        with m2:
            render_confidence_card(
                label="OCR EXTRACTION QUALITY",
                confidence=ocr_conf,
                threshold=0.60,
                flag_message="Low OCR Flag",
                icon="🔍",
            )

        # Metric 3: Anomaly Risk Score (BADGE PLUS GAUGE - NO TRUNCATION!)
        with m3:
            render_risk_gauge_card(score=score, severity=severity)

        # Audit Findings List
        reasons = risk.get("reasons", [])
        if reasons:
            st.markdown("<br>", unsafe_allow_html=True)
            section_header("Audit Rules & Findings Triggered", icon="🔍")
            for r in reasons:
                if severity == "HIGH":
                    st.markdown(f"- <span style='color: #F87171;'>🔴 <b>{r}</b></span>", unsafe_allow_html=True)
                elif severity == "MEDIUM":
                    st.markdown(f"- <span style='color: #FBBF24;'>🟡 <b>{r}</b></span>", unsafe_allow_html=True)
                else:
                    st.markdown(f"- <span style='color: #34D399;'>🟢 <b>{r}</b></span>", unsafe_allow_html=True)

        # Verified Line Items Table
        items_df = st.session_state.get("edit_items_df", pd.DataFrame())
        if not items_df.empty:
            st.markdown("<br>", unsafe_allow_html=True)
            section_header("Final Itemized Lines for Record", icon="📋")
            st.dataframe(items_df, hide_index=True, use_container_width=True)

        st.markdown("---")

        # "SAVE TO DATABASE" BUTTON
        save_col1, save_col2 = st.columns([1.2, 1.0])
        with save_col1:
            save_btn = st.button(
                "💾 Save Verified Record to Database",
                type="primary",
                use_container_width=True,
            )

            if save_btn:
                with st.spinner("Persisting verified record to SQLite database..."):
                    try:
                        from src.api.database import SessionLocal, ExpenseModel
                        db = SessionLocal()
                        target_row = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()

                        # Compile item description summary from edited line items
                        if not items_df.empty and "description" in items_df.columns:
                            items_summary = " ".join([str(d) for d in items_df["description"].dropna()])
                        else:
                            items_summary = f"Expense at {active_vendor}"

                        if target_row:
                            target_row.vendor = active_vendor
                            target_row.date = active_date
                            target_row.amount = active_amount
                            target_row.tax = active_tax
                            target_row.payment_mode = st.session_state.get("edit_payment_mode", "UPI")
                            target_row.item_description = items_summary
                            db.commit()
                        else:
                            # Insert if not already stored
                            new_row = ExpenseModel(
                                id=expense_id,
                                date=active_date,
                                vendor=active_vendor,
                                item_description=items_summary,
                                amount=active_amount,
                                category=pred_cat,
                                payment_mode=st.session_state.get("edit_payment_mode", "UPI"),
                                tax=active_tax,
                                is_anomaly=is_anom,
                                anomaly_score=score,
                                risk_severity=severity,
                                risk_reasons="; ".join(reasons) if reasons else "Clean audit pass.",
                                raw_text=exp.get("raw_text", ""),
                                ocr_confidence=ocr_conf,
                                classifier_confidence=clf_conf,
                                needs_review=needs_rev,
                                review_reason=rev_reason,
                            )
                            db.add(new_row)
                            db.commit()

                        db.close()
                        st.session_state.is_saved_to_db = True
                        st.success(f"🎉 Successfully verified & updated in SQLite database! Expense ID: `{expense_id}`")

                    except Exception as ex:
                        st.error(f"Failed to save to database: {ex}")

        with save_col2:
            if st.session_state.is_saved_to_db:
                st.markdown("""
                <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 8px; padding: 10px 14px; text-align: center;">
                    <span style="color: #34D399; font-weight: 700; font-size: 0.88rem;">✅ Record Persisted in SQLite</span>
                    <div style="color: #A7F3D0; font-size: 0.74rem; margin-top: 2px;">Visible in Dashboard and Forensic Analytics</div>
                </div>
                """, unsafe_allow_html=True)
