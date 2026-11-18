"""
ReceiptRadar - AI Savings & Expense Optimization Recommender
Analyzes historical spend patterns to uncover vendor consolidation opportunities,
subscription creep, duplicate billing recoupment, and budget optimization targets.
"""

from typing import List
import pandas as pd
import numpy as np

from backend.app.config import EXPENSES_DB_PATH
from backend.app.models.schemas import SavingsRecommendation


class SavingsRecommender:
    """
    Financial Optimization and Savings Advisory Engine.
    Translates raw transaction data into prioritized cost-reduction recommendations.
    """

    def __init__(self):
        pass

    def generate_recommendations(self) -> List[SavingsRecommendation]:
        """
        Scans transaction history and generates high-impact, prioritized
        cost-savings recommendations.
        """
        if not EXPENSES_DB_PATH.exists():
            from backend.app.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        df = pd.read_csv(EXPENSES_DB_PATH)
        recommendations: List[SavingsRecommendation] = []

        # -------------------------------------------------------------
        # 1. Duplicate Billing Recovery
        # -------------------------------------------------------------
        duplicates_df = df[df["is_anomaly"] & df["risk_reasons"].str.contains("Duplicate", na=False, case=False)]
        if not duplicates_df.empty:
            dup_total = float(duplicates_df["amount"].sum())
            recommendations.append(SavingsRecommendation(
                id="SAV-DUP-01",
                title="Immediate Recovery of Duplicate Vendor Charges",
                category="Audit & Compliance",
                priority="High",
                potential_monthly_savings=round(dup_total / 6.0, 2),
                potential_annual_savings=round(dup_total, 2),
                description=(
                    f"Our audit engine flagged {len(duplicates_df)} potential duplicate charges totaling "
                    f"${dup_total:,.2f} over the past 6 months from vendors like {', '.join(duplicates_df['merchant'].unique()[:3])}."
                ),
                action_steps=[
                    "Issue immediate chargeback inquiries or vendor refund requests for flagged duplicate invoice IDs.",
                    "Enforce strict 3-way matching between Purchase Orders, Receiving Slips, and Vendor Invoices.",
                    "Activate automated receipt deduplication pre-payment.",
                ],
            ))

        # -------------------------------------------------------------
        # 2. SaaS & Software Subscription Optimization
        # -------------------------------------------------------------
        software_df = df[df["category"] == "Office Supplies & Software"]
        recurring_vendors = software_df.groupby("merchant").filter(lambda g: len(g) >= 3)
        if not recurring_vendors.empty:
            monthly_saas_spend = float(recurring_vendors["amount"].sum() / 6.0)
            potential_cut = round(monthly_saas_spend * 0.18, 2)  # ~18% typical SaaS seat waste
            recommendations.append(SavingsRecommendation(
                id="SAV-SAAS-02",
                title="Consolidate SaaS Licenses & Prune Inactive Seats",
                category="Office Supplies & Software",
                priority="High",
                potential_monthly_savings=potential_cut,
                potential_annual_savings=round(potential_cut * 12.0, 2),
                description=(
                    f"Recurring software licenses account for ~${monthly_saas_spend:,.2f}/month. "
                    "Auditing user activity typically reveals 15-25% unassigned or idle seats across tools."
                ),
                action_steps=[
                    "Conduct a 30-day seat utilization review across Slack, Google Workspace, and Adobe.",
                    "Downgrade inactive former employee accounts to free or archived status.",
                    "Switch from monthly billing to annual plans to lock in standard 15-20% vendor discounts.",
                ],
            ))

        # -------------------------------------------------------------
        # 3. Discretionary Dining & Entertainment Cap
        # -------------------------------------------------------------
        meals_df = df[df["category"] == "Meals & Entertainment"]
        if not meals_df.empty:
            high_meals = meals_df[meals_df["amount"] > 250.0]
            if len(high_meals) > 2:
                total_high_meals = float(high_meals["amount"].sum())
                potential_meal_savings = round((total_high_meals * 0.30) / 6.0, 2)
                recommendations.append(SavingsRecommendation(
                    id="SAV-MEAL-03",
                    title="Implement Per-Diem Cap on Client Entertainment",
                    category="Meals & Entertainment",
                    priority="Medium",
                    potential_monthly_savings=potential_meal_savings,
                    potential_annual_savings=round(potential_meal_savings * 12.0, 2),
                    description=(
                        f"Detected {len(high_meals)} client dinners exceeding $250 each (totaling ${total_high_meals:,.2f}). "
                        "A clear travel & entertainment per-diem policy curbs unbudgeted lifestyle creep."
                    ),
                    action_steps=[
                        "Institute a mandatory $85/person dinner limit for non-executive client entertainment.",
                        "Require prior managerial written pre-approval for client meals projected over $250.",
                        "Enforce itemized receipts specifying client attendee names to safeguard IRS tax deductions.",
                    ],
                ))

        # -------------------------------------------------------------
        # 4. Vendor Consolidation (Travel & Logistics)
        # -------------------------------------------------------------
        travel_df = df[df["category"] == "Travel & Fuel"]
        fuel_vendors = travel_df[travel_df["merchant"].str.contains("Shell|Chevron|Exxon|Mobil", na=False, case=False)]
        if len(fuel_vendors) >= 10:
            fuel_annual = float(fuel_vendors["amount"].sum() * 2.0)
            fuel_savings = round((fuel_annual * 0.05) / 12.0, 2)
            recommendations.append(SavingsRecommendation(
                id="SAV-FUEL-04",
                title="Consolidate Fleet Fuel Purchases with Corporate Rebate Card",
                category="Travel & Fuel",
                priority="Medium",
                potential_monthly_savings=fuel_savings,
                potential_annual_savings=round(fuel_savings * 12.0, 2),
                description=(
                    f"Team members logged {len(fuel_vendors)} individual fuel stops across competing fuel brands. "
                    "Consolidating with a commercial fleet card unlocks volume tier rebates (3-5¢/gal)."
                ),
                action_steps=[
                    "Issue dedicated corporate fleet fuel cards (e.g. WEX or Shell Commercial).",
                    "Restrict card usage strictly to fuel pumps to prevent unauthorized convenience store add-ons.",
                    "Capture automatic odometer and vehicle ID tracking for tax depreciation schedules.",
                ],
            ))

        # -------------------------------------------------------------
        # 5. Marketing Channel ROI Reallocation
        # -------------------------------------------------------------
        mktg_df = df[df["category"] == "Marketing & Advertising"]
        if not mktg_df.empty:
            monthly_mktg = float(mktg_df["amount"].sum() / 6.0)
            mktg_savings = round(monthly_mktg * 0.12, 2)
            recommendations.append(SavingsRecommendation(
                id="SAV-MKTG-05",
                title="Eliminate Low-Converting Ad Campaigns & Keyword Bleed",
                category="Marketing & Advertising",
                priority="Low",
                potential_monthly_savings=mktg_savings,
                potential_annual_savings=round(mktg_savings * 12.0, 2),
                description=(
                    f"Digital ad spend averages ${monthly_mktg:,.2f}/month. Routine negative keyword audits "
                    "typically eliminate 10-15% of wasted ad spend from irrelevant query clicks."
                ),
                action_steps=[
                    "Add negative keyword lists to Google Ads campaigns to prevent non-buyer search traffic.",
                    "Pause retargeting frequency caps to prevent ad fatigue and wasted impressions.",
                    "Audit B2B LinkedIn sponsored content bids against cost-per-qualified-lead metrics.",
                ],
            ))

        return recommendations

