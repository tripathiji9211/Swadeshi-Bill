"""
ReceiptRadar - Plotly Chart Components (Dark Fintech Theme)
============================================================
Visualizations matching the dark mode design system:
- Transparent plot backgrounds with crisp text contrast.
- Primary electric blue accent (#3B82F6) and consistent fintech palette.
"""

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

FINTECH_PRIMARY = "#3B82F6"
CHART_BG = "rgba(19, 27, 46, 0.4)"
GRID_COLOR = "rgba(255, 255, 255, 0.08)"
TEXT_COLOR = "#94A3B8"
TITLE_COLOR = "#F8FAFC"


def render_monthly_spend_trend(monthly_df: pd.DataFrame) -> go.Figure:
    """Renders monthly spend area trend chart in dark fintech styling."""
    fig = px.area(
        monthly_df,
        x="month_year",
        y="amount",
        labels={"month_year": "Month", "amount": "Spend (INR)"},
        color_discrete_sequence=[FINTECH_PRIMARY],
    )
    fig.update_layout(
        margin=dict(l=20, r=20, t=15, b=20),
        height=340,
        xaxis_title="",
        yaxis_title="Total Spend (₹)",
        hovermode="x unified",
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor=CHART_BG,
        font=dict(color=TEXT_COLOR, family="Plus Jakarta Sans, Inter, sans-serif"),
    )
    fig.update_xaxes(showgrid=True, gridcolor=GRID_COLOR, zeroline=False)
    fig.update_yaxes(showgrid=True, gridcolor=GRID_COLOR, zeroline=False)
    fig.update_traces(
        fillcolor="rgba(59, 130, 246, 0.18)",
        line=dict(width=2.5, color=FINTECH_PRIMARY),
    )
    return fig


def render_category_pie_chart(cat_totals_df: pd.DataFrame) -> go.Figure:
    """Renders category allocation donut/pie chart with glowing fintech accents."""
    fig = px.pie(
        cat_totals_df,
        names="category",
        values="amount",
        hole=0.48,
        color_discrete_sequence=[
            "#3B82F6",
            "#10B981",
            "#F59E0B",
            "#EC4899",
            "#8B5CF6",
            "#06B6D4",
            "#64748B",
            "#F97316",
        ],
    )
    fig.update_layout(
        margin=dict(l=10, r=10, t=10, b=10),
        height=340,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.25,
            font=dict(color=TEXT_COLOR, size=11),
        ),
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TEXT_COLOR, family="Plus Jakarta Sans, Inter, sans-serif"),
    )
    fig.update_traces(
        textposition="inside",
        textinfo="percent",
        marker=dict(line=dict(color="#0B0F19", width=2)),
    )
    return fig


def render_category_bar_chart(cat_df: pd.DataFrame) -> go.Figure:
    """Renders vertical bar chart comparing total spend across expense categories."""
    fig = px.bar(
        cat_df,
        x="category",
        y="amount",
        text_auto=".2s",
        color="amount",
        color_continuous_scale=[[0.0, "#1E3A8A"], [0.5, "#2563EB"], [1.0, "#38BDF8"]],
        labels={"category": "Expense Category", "amount": "Spend (INR)"},
    )
    fig.update_layout(
        template="plotly_dark",
        height=340,
        margin=dict(l=20, r=20, t=15, b=20),
        yaxis_title="Total Spend (₹)",
        xaxis_title="",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor=CHART_BG,
        font=dict(color=TEXT_COLOR, family="Plus Jakarta Sans, Inter, sans-serif"),
        coloraxis_showscale=False,
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor=GRID_COLOR)
    return fig


def render_top_vendors_bar_chart(vendor_df: pd.DataFrame) -> go.Figure:
    """Renders horizontal bar chart for top merchants/vendors sorted by total spend."""
    fig = px.bar(
        vendor_df,
        x="amount",
        y="vendor",
        orientation="h",
        text_auto=".2s",
        color="amount",
        color_continuous_scale=[[0.0, "#0F766E"], [0.5, "#0D9488"], [1.0, "#2DD4BF"]],
        labels={"vendor": "Merchant / Vendor", "amount": "Total Spend (INR)"},
    )
    fig.update_layout(
        template="plotly_dark",
        height=360,
        margin=dict(l=20, r=20, t=15, b=20),
        xaxis_title="Total Spend (₹)",
        yaxis_title="",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor=CHART_BG,
        font=dict(color=TEXT_COLOR, family="Plus Jakarta Sans, Inter, sans-serif"),
        coloraxis_showscale=False,
        yaxis=dict(autorange="reversed"),
    )
    fig.update_xaxes(showgrid=True, gridcolor=GRID_COLOR)
    fig.update_yaxes(showgrid=False)
    return fig


def render_anomaly_severity_pie_chart(severity_df: pd.DataFrame) -> go.Figure:
    """Renders donut chart displaying breakdown of HIGH vs MEDIUM risk anomalies."""
    fig = px.pie(
        severity_df,
        names="severity",
        values="count",
        hole=0.52,
        color="severity",
        color_discrete_map={
            "HIGH": "#EF4444",
            "MEDIUM": "#F59E0B",
            "LOW": "#10B981",
        },
    )
    fig.update_layout(
        margin=dict(l=10, r=10, t=10, b=10),
        height=320,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.2,
            font=dict(color=TEXT_COLOR, size=11),
        ),
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color=TEXT_COLOR, family="Plus Jakarta Sans, Inter, sans-serif"),
    )
    fig.update_traces(
        textposition="inside",
        textinfo="percent+label",
        marker=dict(line=dict(color="#0B0F19", width=2)),
    )
    return fig


def render_forecast_bar_chart(forecast_df: pd.DataFrame) -> go.Figure:
    """Renders next month category forecast bar chart."""
    fig = px.bar(
        forecast_df,
        x="Category",
        y="Projected Spend (INR)",
        text_auto=".2s",
        color="Projected Spend (INR)",
        color_continuous_scale=[[0.0, "#1E3A8A"], [0.5, "#2563EB"], [1.0, "#38BDF8"]],
    )
    fig.update_layout(
        template="plotly_dark",
        height=380,
        margin=dict(l=20, r=20, t=20, b=20),
        yaxis_title="Projected Outlay (₹)",
        xaxis_title="",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor=CHART_BG,
        font=dict(color=TEXT_COLOR, family="Plus Jakarta Sans, Inter, sans-serif"),
        coloraxis_showscale=False,
    )
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor=GRID_COLOR)
    return fig
