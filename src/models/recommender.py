"""
AI Savings & Optimization Recommender
"""

from typing import List
import pandas as pd

from src.config import EXPENSES_DB_PATH
from src.parsing.schemas import SavingsRecommendation


class SavingsRecommender:
    def generate_recommendations(self) -> List[SavingsRecommendation]:
        if not EXPENSES_DB_PATH.exists():
            from src.utils.sample_data import ensure_sample_database
            ensure_sample_database()

        df = pd.read_csv(EXPENSES_DB_PATH)
        recommendations: List[SavingsRecommendation] = []

        # 1. Duplicates
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
                description=f"Flagged {len(duplicates_df)} duplicate charges totaling ${dup_total:,.2f}.",
                action_steps=[
                    "Issue immediate refund requests for duplicate invoice IDs.",
                    "Enforce strict 3-way matching on Purchase Orders.",
                ],
            ))

        # 2. SaaS optimization
        software_df = df[df["category"] == "Office Supplies & Software"]
        recurring_vendors = software_df.groupby("merchant").filter(lambda g: len(g) >= 3)
        if not recurring_vendors.empty:
            monthly_saas = float(recurring_vendors["amount"].sum() / 6.0)
            cut = round(monthly_saas * 0.18, 2)
            recommendations.append(SavingsRecommendation(
                id="SAV-SAAS-02",
                title="Consolidate SaaS Licenses & Prune Inactive Seats",
                category="Office Supplies & Software",
                priority="High",
                potential_monthly_savings=cut,
                potential_annual_savings=round(cut * 12.0, 2),
                description=f"Recurring software licenses total ~${monthly_saas:,.2f}/month. Routine pruning frees 15-20%.",
                action_steps=[
                    "Perform 30-day seat utilization audit.",
                    "Switch to annual enterprise billing for 15-20% discounts.",
                ],
            ))

        # 3. Discretionary Dining
        meals_df = df[df["category"] == "Meals & Entertainment"]
        high_meals = meals_df[meals_df["amount"] > 250.0]
        if len(high_meals) > 2:
            meal_total = float(high_meals["amount"].sum())
            meal_sav = round((meal_total * 0.30) / 6.0, 2)
            recommendations.append(SavingsRecommendation(
                id="SAV-MEAL-03",
                title="Implement Per-Diem Cap on Client Entertainment",
                category="Meals & Entertainment",
                priority="Medium",
                potential_monthly_savings=meal_sav,
                potential_annual_savings=round(meal_sav * 12.0, 2),
                description=f"Detected {len(high_meals)} client dinners exceeding $250 each (${meal_total:,.2f} total).",
                action_steps=[
                    "Mandate $85/person dinner limit.",
                    "Require pre-approval for meals over $250.",
                ],
            ))

        return recommendations
