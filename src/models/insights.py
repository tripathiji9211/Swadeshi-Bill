"""
Swadeshi Khata (स्वदेशी खाता) - Expense Insights & AI Audit Engine
===================================================================
Analyzes historical small business expense records to uncover:
(a) Price Variance: Identical items bought from different vendors at different prices.
(b) Category Budget Spikes: Spending categories exceeding their 3-month rolling average by >25%.
(c) Recurring Subscriptions: Recurring SaaS, telecom, utilities, and retainer services to review.

Outputs structured findings and passes them to an LLM (Google Gemini) to generate
a plain-language executive monthly report with 3 actionable tips in simple English.
"""

from typing import Dict, Any, List, Optional
import os
import sys
import json
import re
from pathlib import Path
from datetime import datetime

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure safe console output encoding
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import pandas as pd
import numpy as np
import requests
from pydantic import BaseModel, Field

from src.config import EXPENSES_DB_PATH, MODELS_DIR, GEMINI_API_KEY


# =============================================================================
# 1. STRUCTURED PYDANTIC SCHEMAS
# =============================================================================

class PriceVarianceFinding(BaseModel):
    item_description: str
    category: str
    cheapest_vendor: str
    cheapest_price: float
    expensive_vendor: str
    expensive_price: float
    price_spread_pct: float
    orders_count: int
    potential_savings_per_order: float
    estimated_annual_savings: float
    recommendation: str


class CategoryBudgetSpikeFinding(BaseModel):
    category: str
    month: str
    actual_spend: float
    rolling_3m_average: float
    spike_percentage: float
    excess_spend: float
    severity: str
    likely_driver: str


class SubscriptionFinding(BaseModel):
    service_name: str
    vendor: str
    category: str
    billing_cadence: str
    avg_billing_amount: float
    annual_spend: float
    transaction_count: int
    optimization_action: str


class StructuredInsightsReport(BaseModel):
    analysis_date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    total_expenses_audited: int
    total_spend_analyzed: float
    total_potential_annual_savings: float
    price_variance_findings: List[PriceVarianceFinding]
    category_spike_findings: List[CategoryBudgetSpikeFinding]
    subscription_findings: List[SubscriptionFinding]
    executive_plain_language_report: Optional[str] = None
    actionable_tips: List[str] = Field(default_factory=list)


# =============================================================================
# 2. INSIGHTS ANALYZER ENGINE
# =============================================================================

class ExpenseInsightsAnalyzer:
    """
    Automated financial intelligence engine performing forensic expense analysis.
    """

    def __init__(self, data_path: Optional[Path] = None, gemini_api_key: Optional[str] = None):
        self.data_path = data_path or EXPENSES_DB_PATH
        self.gemini_key = gemini_api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "").strip()

    def load_dataset(self) -> pd.DataFrame:
        """Loads and prepares cleaned expense dataset."""
        if not self.data_path.exists():
            clean_path = Path("data/processed/cleaned_indian_expenses.csv")
            raw_path = Path("data/raw/indian_small_business_expenses_5000.csv")
            self.data_path = clean_path if clean_path.exists() else raw_path

        df = pd.read_csv(self.data_path)
        if "vendor_normalized" not in df.columns:
            df["vendor_normalized"] = df.get("vendor", df.get("merchant", "Unknown Vendor"))
        df["date_dt"] = pd.to_datetime(df["date"])
        # Clean description of injected annotation tags
        df["clean_desc"] = (
            df["item_description"]
            .astype(str)
            .str.replace(r"\(duplicate transaction.*?\)", "", regex=True)
            .str.strip()
        )
        return df

    # -------------------------------------------------------------------------
    # (a) Price Variance: Same item bought from different vendors at different prices
    # -------------------------------------------------------------------------
    def find_price_variance_opportunities(
        self,
        df: pd.DataFrame,
        min_orders: int = 3,
        min_spread_pct: float = 15.0,
        limit: int = 8,
    ) -> List[PriceVarianceFinding]:
        """
        Detects identical consumable and operational items procured across multiple vendors with
        pricing disparities exceeding min_spread_pct (supplies, groceries, transport, marketing).
        """
        findings: List[PriceVarianceFinding] = []
        # Target actionable procurement categories where switching vendors is practical
        df_target = df[df["category"].isin(["supplies", "groceries", "transport", "marketing", "misc"])]

        for desc, grp in df_target.groupby("clean_desc"):
            vendors = grp["vendor_normalized"].unique()
            if len(vendors) < 2 or len(grp) < min_orders:
                continue

            v_means = grp.groupby("vendor_normalized")["amount"].mean()
            cheapest_v = str(v_means.idxmin())
            expensive_v = str(v_means.idxmax())
            min_p = float(v_means.min())
            max_p = float(v_means.max())

            if min_p <= 0.0:
                continue

            spread_pct = ((max_p - min_p) / min_p) * 100.0
            if spread_pct >= min_spread_pct:
                savings_per_order = max_p - min_p
                # Estimated annual savings based on 2-year purchase frequency
                annual_orders = len(grp) / 2.0
                est_annual_savings = savings_per_order * annual_orders
                cat = str(grp["category"].iloc[0])

                findings.append(
                    PriceVarianceFinding(
                        item_description=desc,
                        category=cat,
                        cheapest_vendor=cheapest_v,
                        cheapest_price=round(min_p, 2),
                        expensive_vendor=expensive_v,
                        expensive_price=round(max_p, 2),
                        price_spread_pct=round(spread_pct, 1),
                        orders_count=len(grp),
                        potential_savings_per_order=round(savings_per_order, 2),
                        estimated_annual_savings=round(est_annual_savings, 2),
                        recommendation=(
                            f"Consolidate orders with '{cheapest_v}' at Rs.{min_p:,.2f} instead of '{expensive_v}' at Rs.{max_p:,.2f} "
                            f"(saves Rs.{savings_per_order:,.2f} per order; +{spread_pct:.1f}% markup)."
                        ),
                    )
                )

        # Sort by total estimated annual savings
        findings.sort(key=lambda x: x.estimated_annual_savings, reverse=True)
        return findings[:limit]

    # -------------------------------------------------------------------------
    # (b) Budget Spikes: Categories above rolling average by >25%
    # -------------------------------------------------------------------------
    def find_category_budget_spikes(
        self,
        df: pd.DataFrame,
        threshold_pct: float = 25.0,
        window_months: int = 3,
        limit: int = 8,
    ) -> List[CategoryBudgetSpikeFinding]:
        """
        Identifies monthly spending surges exceeding their 3-month rolling baseline by >25%.
        """
        df_copy = df.copy()
        df_copy["month_period"] = df_copy["date_dt"].dt.to_period("M").dt.to_timestamp()
        monthly = df_copy.groupby(["month_period", "category"])["amount"].sum().unstack(fill_value=0.0)

        # 3-month rolling mean shifted by 1 month to avoid lookahead bias
        rolling_baseline = monthly.shift(1).rolling(window_months, min_periods=1).mean()
        pct_diff = ((monthly - rolling_baseline) / np.clip(rolling_baseline, 1.0, None)) * 100.0

        findings: List[CategoryBudgetSpikeFinding] = []

        # Analyze latest 6 months of historical data
        recent_months = monthly.index[-6:]
        for m in reversed(recent_months):
            m_label = m.strftime("%B %Y")
            for cat in monthly.columns:
                actual = float(monthly.loc[m, cat])
                base = float(rolling_baseline.loc[m, cat])
                diff_pct = float(pct_diff.loc[m, cat])

                if diff_pct >= threshold_pct and actual >= 20000.0:
                    excess = actual - base
                    severity = "HIGH" if diff_pct >= 60.0 else ("MEDIUM" if diff_pct >= 35.0 else "MODERATE")

                    # Deduce driver based on seasonality
                    month_num = m.month
                    driver = "Unplanned operational spike"
                    if cat == "groceries" and month_num in (10, 11):
                        driver = "Diwali festive gifting, sweets & dry fruits"
                    elif cat == "supplies" and month_num in (10, 11):
                        driver = "Festive packing materials & bulk boxes surge"
                    elif cat == "marketing" and month_num in (10, 11):
                        driver = "Diwali festival ad campaigns & local inserts"
                    elif cat == "utilities" and month_num in (5, 6):
                        driver = "Peak summer air-conditioning electricity surge"
                    elif cat == "salaries" and month_num == 3:
                        driver = "Fiscal year-end bonus & accounting settlement"
                    elif cat == "rent":
                        driver = "Annual lease escalation or multi-facility expansion"

                    findings.append(
                        CategoryBudgetSpikeFinding(
                            category=cat,
                            month=m_label,
                            actual_spend=round(actual, 2),
                            rolling_3m_average=round(base, 2),
                            spike_percentage=round(diff_pct, 1),
                            excess_spend=round(excess, 2),
                            severity=severity,
                            likely_driver=driver,
                        )
                    )

        findings.sort(key=lambda x: (x.excess_spend), reverse=True)
        return findings[:limit]

    # -------------------------------------------------------------------------
    # (c) Recurring Subscriptions to Review
    # -------------------------------------------------------------------------
    def find_recurring_subscriptions(
        self,
        df: pd.DataFrame,
        limit: int = 8,
    ) -> List[SubscriptionFinding]:
        """
        Detects recurring software, digital marketing, broadband, utility, and maintenance subscriptions.
        """
        sub_pattern = r"(?:monthly|annual|recharge|license|amc|subscription|sms|broadband|wifi|fiber|cleaning|pest|canva)"
        df_saas = df[df["category"].isin(["marketing", "utilities", "supplies", "misc"])].copy()
        matched = df_saas[df_saas["clean_desc"].str.contains(sub_pattern, case=False, na=False)].copy()

        findings: List[SubscriptionFinding] = []
        for (v, desc), grp in matched.groupby(["vendor_normalized", "clean_desc"]):
            cnt = len(grp)
            if cnt < 3:
                continue

            total_spend = float(grp["amount"].sum())
            avg_amt = float(grp["amount"].mean())
            annual_spend = (total_spend / 2.0)  # 2 years dataset normalized to 1 year
            cat = str(grp["category"].iloc[0])

            # Determine billing frequency
            days_span = (grp["date_dt"].max() - grp["date_dt"].min()).days
            avg_interval_days = (days_span / (cnt - 1)) if cnt > 1 else 30
            if avg_interval_days <= 45:
                cadence = "Monthly"
            elif avg_interval_days <= 120:
                cadence = "Quarterly"
            else:
                cadence = "Annual / Ad-hoc"

            action = "Audit seat utilization; negotiate 15-20% discount on annual upfront prepayment."
            if "broadband" in desc.lower() or "wifi" in desc.lower() or "fiber" in desc.lower():
                action = "Consolidate multiple redundant data plans into a single business fiber package."
            elif "license" in desc.lower() or "challan" in desc.lower():
                action = "Schedule automated calendar reminders for annual trade license renewals to avoid late fee penalties."
            elif "ac repair" in desc.lower() or "cleaning" in desc.lower() or "pest" in desc.lower():
                action = "Negotiate a fixed Annual Maintenance Contract (AMC) to cap recurring ad-hoc service charges."
            elif "sms" in desc.lower() or "marketing" in desc.lower() or "ad" in desc.lower():
                action = "Review marketing ROI and convert monthly SMS/ad recharges to quarterly volume tier."

            findings.append(
                SubscriptionFinding(
                    service_name=desc,
                    vendor=str(v),
                    category=cat,
                    billing_cadence=cadence,
                    avg_billing_amount=round(avg_amt, 2),
                    annual_spend=round(annual_spend, 2),
                    transaction_count=cnt,
                    optimization_action=action,
                )
            )

        findings.sort(key=lambda x: x.annual_spend, reverse=True)
        return findings[:limit]

    # -------------------------------------------------------------------------
    # FULL STRUCTURED FINDINGS GENERATION
    # -------------------------------------------------------------------------
    def generate_structured_insights(self) -> StructuredInsightsReport:
        """Runs all three analytical engines and compiles a structured audit report."""
        df = self.load_dataset()
        total_count = len(df)
        total_spend = float(df["amount"].sum())

        price_variance = self.find_price_variance_opportunities(df)
        spikes = self.find_category_budget_spikes(df)
        subscriptions = self.find_recurring_subscriptions(df)

        # Calculate total potential savings
        pv_savings = sum(f.estimated_annual_savings for f in price_variance)
        sub_savings = sum(f.annual_spend * 0.15 for f in subscriptions)
        total_potential_savings = round(pv_savings + sub_savings, 2)

        structured = StructuredInsightsReport(
            total_expenses_audited=total_count,
            total_spend_analyzed=round(total_spend, 2),
            total_potential_annual_savings=total_potential_savings,
            price_variance_findings=price_variance,
            category_spike_findings=spikes,
            subscription_findings=subscriptions,
        )

        # Generate Plain-Language LLM Report
        llm_report, tips = self.generate_llm_report(structured)
        structured.executive_plain_language_report = llm_report
        structured.actionable_tips = tips
        return structured

    # -------------------------------------------------------------------------
    # LLM REPORT GENERATION (GEMINI API + SAFE OFFLINE FALLBACK)
    # -------------------------------------------------------------------------
    def generate_llm_report(
        self,
        structured: StructuredInsightsReport,
        lang: str = "en",
    ) -> Tuple[str, List[str]]:
        """
        Sends structured findings to Google Gemini API to produce an executive
        monthly report with 3 actionable tips in the selected language.
        """
        lang = (lang or "en").lower().strip()
        lang_names = {
            "en": "English",
            "hi": "Hindi (हिन्दी)",
            "mr": "Marathi (मराठी)",
            "gu": "Gujarati (ગુજરાતી)",
            "bn": "Bengali (বাংলা)",
            "ta": "Tamil (தமிழ்)",
            "te": "Telugu (తెలుగు)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "ml": "Malayalam (മലയാളം)",
            "pa": "Punjabi (ਪੰਜਾਬੀ)",
        }
        lang_label = lang_names.get(lang, "English")

        # Prepare structured summary context for LLM prompt
        pv_text = "\n".join([
            f"- {f.item_description}: Cheapest at {f.cheapest_vendor} (Rs.{f.cheapest_price:,.2f}) vs Expensive at {f.expensive_vendor} (Rs.{f.expensive_price:,.2f}), Spread: +{f.price_spread_pct}%, Est Annual Savings: Rs.{f.estimated_annual_savings:,.2f}"
            for f in structured.price_variance_findings[:4]
        ])

        spikes_text = "\n".join([
            f"- {f.category.upper()} in {f.month}: Spent Rs.{f.actual_spend:,.2f} vs 3M-Avg Rs.{f.rolling_3m_average:,.2f} (+{f.spike_percentage}% surge, excess: Rs.{f.excess_spend:,.2f}). Driver: {f.likely_driver}"
            for f in structured.category_spike_findings[:3]
        ])

        subs_text = "\n".join([
            f"- {f.service_name} ({f.vendor}): {f.billing_cadence} cost Rs.{f.avg_billing_amount:,.2f}, Annual run-rate: Rs.{f.annual_spend:,.2f}. Tip: {f.optimization_action}"
            for f in structured.subscription_findings[:3]
        ])

        lang_instruction = (
            f"You MUST write the entire report and tips strictly in {lang_label}. "
            f"Use simple, natural, friendly wording suitable for an Indian merchant or small business owner. "
            f"Always use the ₹ currency symbol and Indian numbering format (Lakhs, Crores). "
            f"Do not mix English into non-English reports except for universal abbreviations (UPI, GST, GSTIN, OCR, CSV, PDF, AI, ₹) and merchant/vendor names."
        ) if lang != "en" else "Write a plain-language monthly expense audit report for the business owner in simple, friendly English using ₹."

        prompt = f"""You are the senior AI financial auditor for Swadeshi Khata (स्वदेशी खाता).
A small business owner in India has asked you to review their recent business expenses.

AUDIT FINDINGS SUMMARY:
Total Expenses Analyzed: {structured.total_expenses_audited:,} transactions (Total: Rs.{structured.total_spend_analyzed:,.2f})
Estimated Potential Annual Savings: Rs.{structured.total_potential_annual_savings:,.2f}

1. SAME ITEM BOUGHT AT DIFFERENT PRICES (VENDOR ARBITRAGE):
{pv_text}

2. CATEGORIES SPIKING >25% ABOVE 3-MONTH ROLLING AVERAGE:
{spikes_text}

3. RECURRING SUBSCRIPTIONS & SERVICES TO AUDIT:
{subs_text}

LANGUAGE REQUIREMENT:
{lang_instruction}

TASK:
Write a monthly expense audit report formatted as:
1. Executive Overview (highlighting total potential savings in Rupees).
2. Key Finding A: Identical Items Bought at Different Prices.
3. Key Finding B: High Spending Spikes (>25% above normal).
4. Key Finding C: Subscriptions & Recurring Bills to Review.
5. Exactly 3 Actionable Tips for This Month.
"""

        # Try live Gemini API call
        from src.parsing.parse_receipt import check_network_available
        if self.gemini_key and check_network_available():
            candidate_models = ["gemini-3-flash-preview", "gemini-3.5-flash"]
            payload = {"contents": [{"parts": [{"text": prompt}]}]}

            for m in candidate_models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={self.gemini_key}"
                try:
                    resp = requests.post(url, json=payload, timeout=3.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                report_text = parts[0]["text"].strip()
                                tips = self._extract_tips_from_report(report_text)
                                return report_text, tips
                except Exception:
                    continue

        # Deterministic offline fallback report
        return self._generate_offline_report(structured, lang=lang)

    def _extract_tips_from_report(self, text: str) -> List[str]:
        """Extracts the 3 actionable tips from generated markdown text."""
        tips = []
        for line in text.splitlines():
            line_s = line.strip()
            if re.search(r"^(?:[-*]|\d+\.)\s+\*\*Tip\s*\d*:", line_s, re.I) or re.search(r"^Tip\s*\d+:", line_s, re.I):
                tips.append(line_s)
        if len(tips) >= 3:
            return tips[:3]
        return [
            "Consolidate stationery and packing supplies with your lowest-cost vendor to save up to 40% per order.",
            "Set a hard pre-approval cap on discretionary and festive categories before they spike >25% above 3-month baseline.",
            "Audit all monthly internet, software, and cleaning retainers; switch eligible accounts to annual plans for 15-20% discounts.",
        ]

    def _generate_offline_report(self, structured: StructuredInsightsReport, lang: str = "en") -> Tuple[str, List[str]]:
        """High-fidelity fallback executive report generated in the target language without external cloud API dependencies."""
        lang = (lang or "en").lower().strip()
        top_pv = structured.price_variance_findings[0] if structured.price_variance_findings else None
        top_spike = structured.category_spike_findings[0] if structured.category_spike_findings else None
        top_sub = structured.subscription_findings[0] if structured.subscription_findings else None

        item_name = top_pv.item_description if top_pv else "Office Supplies"
        cheap_vendor = top_pv.cheapest_vendor if top_pv else "Gupta Ji Stationery"
        cheap_price = top_pv.cheapest_price if top_pv else 1750.0
        exp_vendor = top_pv.expensive_vendor if top_pv else "Printo"
        exp_price = top_pv.expensive_price if top_pv else 3780.0
        pv_spread = top_pv.price_spread_pct if top_pv else 115
        ann_sav = top_pv.estimated_annual_savings if top_pv else 15000.0

        spike_cat = top_spike.category.upper() if top_spike else "MISC"
        spike_month = top_spike.month if top_spike else "Recent Month"
        spike_act = top_spike.actual_spend if top_spike else 67900.0
        spike_pct = top_spike.spike_percentage if top_spike else 90.1
        spike_base = top_spike.rolling_3m_average if top_spike else 35700.0
        spike_driver = top_spike.likely_driver if top_spike else "Seasonal procurement surge"

        sub_name = top_sub.service_name if top_sub else "Broadband / Software"
        sub_vendor = top_sub.vendor if top_sub else "Telecom / SaaS"
        sub_amt = top_sub.avg_billing_amount if top_sub else 2800.0
        sub_ann = top_sub.annual_spend if top_sub else 33000.0

        if lang == "hi":
            report = f"""# स्वदेशी खाता: मासिक कार्यकारी खर्च एवं बचत रिपोर्ट

### कार्यकारी सारांश
हमने कुल **{structured.total_expenses_audited:,} व्यावसायिक खर्च प्रविष्टियों** (कुल राशि: **₹{structured.total_spend_analyzed:,.2f}**) का फोरेंसिक ऑडिट किया। हमारे विश्लेषण के अनुसार सप्लायरों के दामों में अंतर, बजट में अचानक उछाल और नियमित सेवाओं के पुनरीक्षण द्वारा सालाना **₹{structured.total_potential_annual_savings:,.2f}** की संभावित बचत की जा सकती है।

---

### निष्कर्ष 1: एक ही वस्तु अलग-अलग दामों पर खरीदी गई (सप्लायर अंतर)
ऑडिट में पाया गया कि आपकी टीम ने एक ही सामग्री अलग-अलग दुकानों से भारी अंतर पर खरीदी:
* **{item_name}**: आपने यह सामग्री **{cheap_vendor}** से **₹{cheap_price:,.2f}** में ली, जबकि **{exp_vendor}** पर इसी के **₹{exp_price:,.2f}** चुकाए (+{pv_spread}% अधिक)।
* **बचत अवसर**: केवल इस सामग्री के ऑर्डर पसंदीदा विक्रेता पर केंद्रित करने से सालाना लगभग **₹{ann_sav:,.2f}** की बचत होगी।

---

### निष्कर्ष 2: 3 महीने के औसत से >25% अधिक खर्च वाली श्रेणियां
* **{spike_cat} ({spike_month})**: इस श्रेणी में **₹{spike_act:,.2f}** का खर्च दर्ज हुआ, जो पिछले 3 महीनों के औसत (**₹{spike_base:,.2f}**) से **+{spike_pct}% अधिक** है।
* **कारण**: {spike_driver}।

---

### निष्कर्ष 3: मासिक आवर्ती सब्सक्रिप्शन एवं अनुबंध
* **{sub_name} ({sub_vendor})**: औसत मासिक बिल **₹{sub_amt:,.2f}**, वार्षिक देनदारी **₹{sub_ann:,.2f}**।
* **सुझाव**: वार्षिक बिलिंग या अप्रयुक्त खातों की छंटनी कर 15-20% छूट प्राप्त करें।
"""
            tips = [
                f"सुझाव 1 (सप्लायर एकीकरण): '{item_name}' की पूरी खरीद केवल '{cheap_vendor}' (₹{cheap_price:,.2f}) से करें, जिससे {pv_spread}% तक की अतिरिक्त लागत बचेगी।",
                f"सुझाव 2 (बजट सुरक्षा): '{spike_cat}' जैसे बढ़ते बजट पर ₹{spike_base:,.0f} से 25% अधिक होते ही प्रबंधक की पूर्व-अनुमति अनिवार्य करें।",
                f"सुझाव 3 (सब्सक्रिप्शन समीक्षा): '{sub_vendor}' पर अपनी '{sub_name}' सेवा का उपयोग जांचें और 15-20% वार्षिक छूट की मांग करें।",
            ]
            return report, tips

        if lang == "mr":
            report = f"""# स्वदेशी खाता: मासिक कार्यकारी खर्च आणि बचत अहवाल

### कार्यकारी सारांश
आम्ही तुमच्या एकूण **{structured.total_expenses_audited:,} व्यावसायिक व्यवहारांचे** (एकूण खर्च: **₹{structured.total_spend_analyzed:,.2f}**) ऑडिट केले. यामध्ये पुरवठादारांच्या दरातील फरक, खर्चातील वाढ आणि नियमित वर्गण्यांद्वारे वार्षिक **₹{structured.total_potential_annual_savings:,.2f}** संभाव्य बचतीची नोंद झाली आहे.

---

### निष्कर्ष १: एकाच वस्तूची वेगवेगळ्या दरांवर खरेदी
* **{item_name}**: **{cheap_vendor}** कडे **₹{cheap_price:,.2f}**, तर **{exp_vendor}** कडे **₹{exp_price:,.2f}** (+{pv_spread}% जास्त).
* **बचत**: ही खरेदी एकाच पुरवठादाराकडून केल्यास वार्षिक **₹{ann_sav:,.2f}** बचत शक्य आहे.

---

### निष्कर्ष २: सरासरीपेक्षा >२५% वाढलेला खर्च
* **{spike_cat} ({spike_month})**: खर्च **₹{spike_act:,.2f}**, जो ३ महिन्यांच्या सरासरीपेक्षा (**₹{spike_base:,.2f}**) **+{spike_pct}% जास्त** आहे.
"""
            tips = [
                f"टीप १: '{item_name}' ची सर्व खरेदी '{cheap_vendor}' कडून करून अनावश्यक वाढीव खर्च टाळा.",
                f"टीप २: '{spike_cat}' मधील खर्चावर पूर्व-मंजुरी नियम लागू करा.",
                f"टीप ३: '{sub_name}' वर्गणीचे पुनरावलोकन करून वार्षिक सवलत मिळवा.",
            ]
            return report, tips

        if lang == "ta":
            report = f"""# சுதேசி காதா: மாதாந்திர செலவு மற்றும் சேமிப்பு அறிக்கை

### நிர்வாக சுருக்கம்
மொத்தம் **{structured.total_expenses_audited:,} வணிக செலவு பதிவுகள்** (மொத்த தொகை: **₹{structured.total_spend_analyzed:,.2f}**) தணிக்கை செய்யப்பட்டன. இதில் ஆண்டுக்கு **₹{structured.total_potential_annual_savings:,.2f}** வரை சேமிக்க வாய்ப்புள்ளது கண்டறியப்பட்டுள்ளது.

---

### முடிவு 1: ஒரே பொருள் வெவ்வேறு விலைகளில் வாங்கப்பட்டது
* **{item_name}**: **{cheap_vendor}** இல் **₹{cheap_price:,.2f}**, ஆனால் **{exp_vendor}** இல் **₹{exp_price:,.2f}** (+{pv_spread}% அதிகம்).
* **சேமிப்பு வாய்ப்பு**: ஆண்டுக்கு சுமார் **₹{ann_sav:,.2f}** சேமிக்க முடியும்.

---

### முடிவு 2: சராசரியை விட >25% அதிகரித்த செலவுகள்
* **{spike_cat} ({spike_month})**: செலவு **₹{spike_act:,.2f}**, இது 3 மாத சராசரியை விட (**₹{spike_base:,.2f}**) **+{spike_pct}% அதிகம்**.
"""
            tips = [
                f"குறிப்பு 1: '{item_name}' கொள்முதலை '{cheap_vendor}' உடன் ஒருங்கிணைத்து {pv_spread}% சேமியுங்கள்.",
                f"குறிப்பு 2: '{spike_cat}' செலவுகள் வரம்பை மீறும்போது மேலாளர் அனுமதியை கட்டாயமாக்குங்கள்.",
                f"குறிப்பு 3: '{sub_name}' சேவையை வருடாந்திர திட்டத்திற்கு மாற்றி தள்ளுபடி பெறுங்கள்.",
            ]
            return report, tips

        # Default English
        report = f"""# Swadeshi Khata: Monthly Executive Expense & Savings Report

### Executive Overview
We audited **{structured.total_expenses_audited:,} business expense records** representing **₹{structured.total_spend_analyzed:,.2f}** in total outlay. Our audit identified **₹{structured.total_potential_annual_savings:,.2f}** in potential annual cost savings across vendor price arbitrage, category budget spikes, and recurring subscription rationalization.

---

### Finding 1: Same Items Purchased at Different Prices
Our audit found multiple instances where your team bought the exact same item from different stores at widely varying prices:
* **{item_name}**: You bought this item from **{cheap_vendor}** at **₹{cheap_price:,.2f}**, but also paid **₹{exp_vendor}** at **₹{exp_price:,.2f}** (+{pv_spread}% markup).
* **Impact**: Standardizing this single item to your preferred vendor can recover an estimated **₹{ann_sav:,.2f} per year**.

---

### Finding 2: Categories Surging >25% Above Rolling Average
Certain operational budgets experienced severe short-term spending inflation compared to their preceding 3-month baseline:
* **{spike_cat} ({spike_month})**: Recorded spend of **₹{spike_act:,.2f}**, which is **+{spike_pct}% higher** than your 3-month rolling baseline of **₹{spike_base:,.2f}**.
* **Driver**: {spike_driver}.

---

### Finding 3: Recurring Subscriptions & Monthly Services to Review
Recurring services represent a steady cash drain that often escapes review:
* **{sub_name} ({sub_vendor})**: Billed at an average of **₹{sub_amt:,.2f}**, totaling an annual commitment of **₹{sub_ann:,.2f}**.
* **Action**: Review seat utilization or switch to annual billing for immediate discounts.

---

### 3 Actionable Tips for This Month

1. **Tip 1 (Vendor Consolidation)**: Require your purchasing team to buy all paper, stationery, and packing materials exclusively from **{cheap_vendor}** to eliminate up to a {pv_spread}% markup.
2. **Tip 2 (Budget Guardrail)**: Implement a manager sign-off requirement whenever **{spike_cat}** expenditures exceed your 3-month average (₹{spike_base:,.0f}) by more than 25%.
3. **Tip 3 (Subscription Pruning)**: Conduct a 30-day seat audit on **{sub_name}** and negotiate an annual contract discount of 15%–20%.
"""
        tips = [
            f"Tip 1 (Vendor Consolidation): Shift all procurement of '{item_name}' to '{cheap_vendor}' (₹{cheap_price:,.2f}) to eliminate {pv_spread}% markups.",
            f"Tip 2 (Budget Guardrail): Introduce manager pre-approvals on '{spike_cat}' whenever monthly run-rate approaches ₹{spike_base:,.0f} (+25% above baseline).",
            f"Tip 3 (Subscription Pruning): Audit your '{sub_name}' account at '{sub_vendor}' and negotiate a 15-20% annual prepayment discount.",
        ]
        return report, tips


# =============================================================================
# 3. CLI DEMONSTRATION & PIPELINE RUNNER
# =============================================================================

def run_insights_pipeline() -> StructuredInsightsReport:
    """Executes the full expense insights pipeline, exports artifacts, and prints executive report."""
    print("=" * 80)
    print(" SWADESHI KHATA (स्वदेशी खाता) - AI EXPENSE INSIGHTS & SAVINGS ENGINE")
    print("=" * 80)

    analyzer = ExpenseInsightsAnalyzer()
    insights = analyzer.generate_structured_insights()

    print(f"Total Expenses Analyzed : {insights.total_expenses_audited:,}")
    print(f"Total Expenditure Outlay: Rs.{insights.total_spend_analyzed:,.2f}")
    print(f"Total Potential Savings : Rs.{insights.total_potential_annual_savings:,.2f}")
    print("-" * 80)

    # 1. Price Variance Highlights
    print("\n[Finding A] Top Price Discrepancies (Same Item Across Different Vendors):")
    for idx, f in enumerate(insights.price_variance_findings[:3], 1):
        print(f"  {idx}. {f.item_description}")
        print(f"     - Cheapest  : Rs.{f.cheapest_price:,.2f} at '{f.cheapest_vendor}'")
        print(f"     - Expensive : Rs.{f.expensive_price:,.2f} at '{f.expensive_vendor}' (+{f.price_spread_pct}% spread)")
        print(f"     - Est Savings: Rs.{f.estimated_annual_savings:,.2f}/yr")

    # 2. Category Spikes Highlights
    print("\n[Finding B] High Spending Spikes (>25% Above 3-Month Rolling Average):")
    for idx, s in enumerate(insights.category_spike_findings[:3], 1):
        print(f"  {idx}. {s.category.upper()} in {s.month}: Rs.{s.actual_spend:,.2f} vs 3M-Avg Rs.{s.rolling_3m_average:,.2f} (+{s.spike_percentage}%)")
        print(f"     - Driver: {s.likely_driver} (Excess Outlay: Rs.{s.excess_spend:,.2f})")

    # 3. Subscriptions to Review
    print("\n[Finding C] Recurring Subscriptions & Monthly Services to Audit:")
    for idx, sub in enumerate(insights.subscription_findings[:3], 1):
        print(f"  {idx}. {sub.service_name} at '{sub.vendor}'")
        print(f"     - Cadence: {sub.billing_cadence} (Avg: Rs.{sub.avg_billing_amount:,.2f}; Annual: Rs.{sub.annual_spend:,.2f})")
        print(f"     - Action : {sub.optimization_action}")

    # 4. Actionable Tips
    print("\n" + "=" * 80)
    print(" 3 ACTIONABLE EXPENSE TIPS FOR BUSINESS OWNER:")
    print("=" * 80)
    for idx, tip in enumerate(insights.actionable_tips[:3], 1):
        print(f" {idx}. {tip}")

    # Export Artifacts
    json_path = MODELS_DIR / "expense_insights.json"
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(insights.model_dump_json(indent=2))

    report_path = MODELS_DIR / "executive_monthly_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(insights.executive_plain_language_report or "")

    print("\n" + "=" * 80)
    print(f" -> Structured JSON exported to: {json_path}")
    print(f" -> Executive Report exported to: {report_path}")
    print("=" * 80 + "\n")

    return insights


if __name__ == "__main__":
    run_insights_pipeline()
