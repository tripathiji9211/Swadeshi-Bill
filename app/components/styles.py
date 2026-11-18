"""
ReceiptRadar - Modern Fintech Design System & Styles
=====================================================
Centralized CSS Design System & Reusable UI Helpers:
- Dark theme optimized for high-contrast visibility.
- Centralized currency formatting: format_currency() (default INR, symbol ₹).
- Reusable components: kpi_card(), status_badge(), section_header(), empty_state().
- Risk Gauge & Symmetric Confidence Cards: fixes truncation and visual parity.
- Graceful offline status banner.
"""

from typing import Optional, Tuple
import streamlit as st
import numpy as np
import plotly.graph_objects as go

PRIMARY_ACCENT = "#3B82F6"  # Electric Cobalt / Fintech Accent
BG_DARK = "#0B0F19"
SURFACE_DARK = "#131B2E"
SURFACE_BORDER = "rgba(255, 255, 255, 0.08)"
TEXT_PRIMARY = "#F8FAFC"
TEXT_MUTED = "#94A3B8"

CURRENCY_MAP = {
    "INR (₹)": {"symbol": "₹", "code": "INR"},
    "USD ($)": {"symbol": "$", "code": "USD"},
    "EUR (€)": {"symbol": "€", "code": "EUR"},
    "GBP (£)": {"symbol": "£", "code": "GBP"},
}


def get_current_currency_symbol() -> str:
    """Returns the active currency symbol from session state (default ₹)."""
    chosen = st.session_state.get("currency_setting", "INR (₹)")
    return CURRENCY_MAP.get(chosen, {}).get("symbol", "₹")


def format_currency(amount: Optional[float], decimals: int = 2) -> str:
    """
    Consistently formats financial amounts with active currency symbol (default ₹).
    Example: 12500.5 -> "₹12,500.50" or "₹12,500" if decimals=0.
    """
    if amount is None or (isinstance(amount, float) and np.isnan(amount)):
        amount = 0.0
    symbol = get_current_currency_symbol()
    try:
        val = float(amount)
        if decimals == 0:
            return f"{symbol}{val:,.0f}"
        return f"{symbol}{val:,.{decimals}f}"
    except (ValueError, TypeError):
        return f"{symbol}0.00"


GLOBAL_CSS = f"""
<style>
    /* Global Typography & Font Family */
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {{
        font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: {TEXT_PRIMARY};
    }}
    
    /* High-Contrast Page Titles & Headers (Fixes Dark-on-Dark Contrast) */
    .app-title {{
        font-size: 2.15rem;
        font-weight: 800;
        color: #FFFFFF !important;
        letter-spacing: -0.03em;
        margin-bottom: 0.25rem;
        display: flex;
        align-items: center;
        gap: 10px;
    }}
    .app-subtitle {{
        font-size: 0.98rem;
        color: #94A3B8 !important;
        margin-bottom: 1.4rem;
        line-height: 1.55;
        font-weight: 400;
    }}
    
    /* Section Headers */
    .section-header-wrap {{
        margin-top: 1.1rem;
        margin-bottom: 0.75rem;
    }}
    .section-header-title {{
        font-size: 1.20rem;
        font-weight: 700;
        color: #F8FAFC !important;
        letter-spacing: -0.02em;
        display: flex;
        align-items: center;
        gap: 8px;
    }}
    .section-header-sub {{
        font-size: 0.84rem;
        color: #94A3B8 !important;
        margin-top: 2px;
    }}
    
    /* Modern Fintech KPI Metric Cards */
    .kpi-card {{
        background: {SURFACE_DARK};
        border: 1px solid {SURFACE_BORDER};
        border-radius: 12px;
        padding: 18px 20px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.2);
        transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        margin-bottom: 10px;
        position: relative;
        overflow: hidden;
    }}
    .kpi-card::before {{
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, {PRIMARY_ACCENT}, transparent);
        opacity: 0.7;
    }}
    .kpi-card:hover {{
        transform: translateY(-2px);
        border-color: rgba(59, 130, 246, 0.4);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 0 15px rgba(59, 130, 246, 0.15);
    }}
    .kpi-label {{
        font-size: 0.76rem;
        font-weight: 700;
        color: #94A3B8 !important;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        display: flex;
        align-items: center;
        gap: 6px;
    }}
    .kpi-value {{
        font-size: 1.85rem;
        font-weight: 800;
        color: #FFFFFF !important;
        margin-top: 6px;
        margin-bottom: 3px;
        letter-spacing: -0.02em;
    }}
    .kpi-sub {{
        font-size: 0.78rem;
        color: #64748B !important;
        font-weight: 500;
    }}

    /* Modern Dark Theme Status Badges */
    .status-badge {{
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.78rem;
        letter-spacing: 0.02em;
        line-height: 1.2;
    }}
    .badge-safe {{
        background-color: rgba(16, 185, 129, 0.15);
        color: #34D399 !important;
        border: 1px solid rgba(52, 211, 153, 0.35);
    }}
    .badge-warning {{
        background-color: rgba(245, 158, 11, 0.15);
        color: #FBBF24 !important;
        border: 1px solid rgba(251, 191, 36, 0.35);
    }}
    .badge-danger {{
        background-color: rgba(239, 68, 68, 0.15);
        color: #F87171 !important;
        border: 1px solid rgba(248, 113, 113, 0.35);
    }}
    .badge-info {{
        background-color: rgba(59, 130, 246, 0.15);
        color: #60A5FA !important;
        border: 1px solid rgba(96, 165, 250, 0.35);
    }}

    /* Actionable Tip Card */
    .tip-card {{
        background: #131B2E;
        border-left: 4px solid {PRIMARY_ACCENT};
        border-top: 1px solid {SURFACE_BORDER};
        border-right: 1px solid {SURFACE_BORDER};
        border-bottom: 1px solid {SURFACE_BORDER};
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }}
    .tip-title {{
        font-size: 0.94rem;
        font-weight: 700;
        color: #F8FAFC !important;
        margin-bottom: 4px;
    }}
    .tip-text {{
        font-size: 0.88rem;
        color: #CBD5E1 !important;
        line-height: 1.5;
    }}

    /* Empty State Box */
    .empty-state-box {{
        background: {SURFACE_DARK};
        border: 1px dashed rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 36px 24px;
        text-align: center;
        margin-bottom: 20px;
    }}
    .empty-state-icon {{
        font-size: 2.4rem;
        margin-bottom: 8px;
    }}
    .empty-state-title {{
        font-size: 1.15rem;
        font-weight: 700;
        color: #F8FAFC !important;
    }}
    .empty-state-desc {{
        font-size: 0.88rem;
        color: #94A3B8 !important;
        margin-top: 4px;
        max-width: 480px;
        margin-left: auto;
        margin-right: auto;
    }}

    /* Form Fields & Inputs in Dark Theme */
    div[data-baseweb="input"] input, div[data-baseweb="select"] {{
        color: #F8FAFC !important;
    }}
    
    /* Streamlit Expander styling */
    .streamlit-expanderHeader {{
        background-color: {SURFACE_DARK} !important;
        color: #F8FAFC !important;
        border-radius: 8px;
    }}

    /* Tooltip styling on KPI Cards */
    .kpi-tooltip {{
        cursor: help;
        font-size: 0.72rem;
        color: #64748B;
        margin-left: 6px;
        display: inline-flex;
        align-items: center;
        transition: color 0.15s ease, transform 0.15s ease;
        vertical-align: middle;
    }}
    .kpi-tooltip:hover {{
        color: #38BDF8 !important;
        transform: scale(1.15);
    }}

    /* Accessible Button & Form Focus Styles (Keyboard friendly) */
    .stButton > button, div[data-testid="stFormSubmitButton"] > button {{
        border-radius: 8px !important;
        font-weight: 600 !important;
        transition: all 0.18s ease-in-out !important;
    }}
    .stButton > button:focus-visible, div[data-testid="stFormSubmitButton"] > button:focus-visible {{
        outline: 2px solid #38BDF8 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 12px rgba(56, 189, 248, 0.45) !important;
    }}
    input:focus-visible, textarea:focus-visible, select:focus-visible {{
        outline: 2px solid #3B82F6 !important;
        border-color: #3B82F6 !important;
    }}

    /* Mobile Responsive Optimizations (< 768px) */
    @media (max-width: 768px) {{
        .app-title {{
            font-size: 1.50rem !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
        }}
        .app-subtitle {{
            font-size: 0.88rem !important;
            margin-bottom: 1.0rem !important;
        }}
        .kpi-card {{
            padding: 12px 14px !important;
            margin-bottom: 10px !important;
        }}
        .kpi-value {{
            font-size: 1.45rem !important;
        }}
        .kpi-label {{
            font-size: 0.70rem !important;
        }}
        .status-badge {{
            font-size: 0.70rem !important;
            padding: 3px 8px !important;
        }}
    }}
</style>
"""


def apply_global_styles():
    """Injects ReceiptRadar dark fintech design system styles into Streamlit."""
    st.markdown(GLOBAL_CSS, unsafe_allow_html=True)


def kpi_card(
    label: str,
    value: str,
    sub: str = "",
    value_color: str = "#FFFFFF",
    icon: str = "",
    tooltip: str = "",
) -> None:
    """Renders a modern fintech KPI metric tile with subtle top-accent glow and optional tooltip."""
    icon_html = f"<span>{icon}</span> " if icon else ""
    tooltip_html = f'<span class="kpi-tooltip" title="{tooltip}">ℹ️</span>' if tooltip else ""
    card_html = f"""
    <div class="kpi-card">
        <div class="kpi-label">{icon_html}{label}{tooltip_html}</div>
        <div class="kpi-value" style="color: {value_color} !important;">{value}</div>
        <div class="kpi-sub">{sub}</div>
    </div>
    """
    st.markdown(card_html, unsafe_allow_html=True)


def status_badge(text: str, status_type: str = "safe", icon: str = "") -> str:
    """
    Returns high-contrast HTML pill badge for dark mode.
    Types: 'safe' (emerald), 'warning' (amber), 'danger' (crimson), 'info' (electric blue).
    """
    type_clean = status_type.lower().strip()
    badge_class = f"status-badge badge-{type_clean}"
    if type_clean not in ["safe", "warning", "danger", "info"]:
        badge_class = "status-badge badge-info"

    icon_str = f"<span>{icon}</span> " if icon else ""
    return f'<span class="{badge_class}">{icon_str}{text}</span>'


def get_risk_badge_html(severity: str) -> str:
    """Returns dark-mode audit risk badge based on anomaly severity level."""
    sev = str(severity).upper()
    if sev == "HIGH":
        return status_badge("HIGH RISK ANOMALY", status_type="danger", icon="🚨")
    elif sev == "MEDIUM":
        return status_badge("MEDIUM RISK FLAG", status_type="warning", icon="⚠️")
    return status_badge("AUDIT PASSED (SAFE)", status_type="safe", icon="✅")


def section_header(title: str, subtitle: str = "", icon: str = "") -> None:
    """Renders a high-contrast section heading with optional icon and subtitle."""
    icon_str = f"<span>{icon}</span> " if icon else ""
    sub_html = f'<div class="section-header-sub">{subtitle}</div>' if subtitle else ""
    header_html = f"""
    <div class="section-header-wrap">
        <div class="section-header-title">{icon_str}{title}</div>
        {sub_html}
    </div>
    """
    st.markdown(header_html, unsafe_allow_html=True)


def empty_state(title: str, message: str, icon: str = "📂") -> None:
    """Renders a modern empty-state card container."""
    html = f"""
    <div class="empty-state-box">
        <div class="empty-state-icon">{icon}</div>
        <div class="empty-state-title">{title}</div>
        <div class="empty-state-desc">{message}</div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)


def render_offline_banner(backend_url: str) -> None:
    """Displays a standardized offline error notification when FastAPI backend is disconnected."""
    st.markdown(f"""
    <div style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid rgba(248, 113, 113, 0.4); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="color: #F87171; font-size: 0.96rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span> FastAPI Backend Offline
        </div>
        <div style="color: #FECACA; font-size: 0.85rem; margin-top: 4px;">
            Cannot reach backend service at <code>{backend_url}</code>. Features requiring live inference or database queries are restricted.
        </div>
        <div style="color: #FCA5A5; font-size: 0.78rem; margin-top: 6px;">
            <b>To resolve:</b> In your terminal, run <code>python -m uvicorn src.api.main:app --port 8000</code>
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_confidence_card(
    label: str,
    confidence: float,
    threshold: float,
    flag_message: str = "Below Threshold",
    icon: str = "🔍",
) -> None:
    """
    Renders OCR confidence and classifier confidence in the EXACT same symmetric design:
    - Label and icon header
    - High contrast percentage
    - Progress bar
    - Standardized threshold badge pill
    """
    conf_pct = float(confidence * 100.0)
    thresh_pct = int(threshold * 100.0)
    is_passing = confidence >= threshold

    st.markdown(f"""
    <div class="kpi-card" style="padding: 16px 18px; margin-bottom: 8px;">
        <div class="kpi-label">{icon} {label}</div>
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; margin-bottom: 6px;">
            <div style="font-size: 1.85rem; font-weight: 800; color: #FFFFFF;">{conf_pct:.1f}%</div>
            <div>
                {status_badge(f"≥{thresh_pct}% Optimal", status_type="safe", icon="✅") if is_passing else status_badge(f"<{thresh_pct}% {flag_message}", status_type="danger", icon="⚠️")}
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.progress(float(confidence))


def render_risk_gauge_card(score: float, severity: str) -> None:
    """
    Renders the risk assessment metric as a status badge PLUS a gauge without text truncation.
    """
    badge_html = get_risk_badge_html(severity)
    score_pct = float(score * 100.0)

    # Color mapping for gauge
    sev_upper = str(severity).upper()
    if sev_upper == "HIGH":
        gauge_color = "#EF4444"
    elif sev_upper == "MEDIUM":
        gauge_color = "#F59E0B"
    else:
        gauge_color = "#10B981"

    st.markdown(f"""
    <div class="kpi-card" style="padding: 16px 18px; margin-bottom: 8px;">
        <div class="kpi-label">🛡️ ANOMALY RISK GAUGE</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; margin-bottom: 8px;">
            <div style="font-size: 1.85rem; font-weight: 800; color: {gauge_color};">{score_pct:.1f}<span style="font-size: 1.0rem; color: #94A3B8;">/100</span></div>
            <div>{badge_html}</div>
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.progress(float(score))
