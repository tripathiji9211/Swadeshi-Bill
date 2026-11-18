"""
LLM Information Extraction and Structured Schema Parsing
"""

import json
import re
from datetime import datetime
from typing import List
import os

from src.parsing.schemas import ParsedReceipt, ReceiptItem
from src.config import GEMINI_API_KEY, OPENAI_API_KEY


class LLMParser:
    """
    Receipt LLM Parser extracting structured data matching ParsedReceipt.
    """

    SYSTEM_PROMPT = """
You are an expert financial receipt auditing AI. Extract structured data from this receipt OCR text.
Return ONLY valid JSON matching this schema:
{
  "merchant_name": "string",
  "date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "tax_amount": 0.00,
  "payment_method": "Credit Card | Debit Card | Cash | ACH | Unknown",
  "receipt_number": "string or null",
  "items": [
    {
      "description": "string",
      "quantity": 1.0,
      "unit_price": 0.00,
      "total_price": 0.00
    }
  ]
}
"""

    def __init__(self):
        self.gemini_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        self.openai_key = OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        self.client_type = "gemini" if self.gemini_key else ("openai" if self.openai_key else "heuristic")

    def parse(self, raw_text: str) -> ParsedReceipt:
        # Gemini
        from src.parsing.parse_receipt import check_network_available
        if self.client_type == "gemini" and check_network_available():
            try:
                import requests
                prompt = f"{self.SYSTEM_PROMPT}\n\nRECEIPT TEXT:\n{raw_text}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
                }
                for model_name in ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-flash-latest"]:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.gemini_key}"
                    resp = requests.post(url, json=payload, timeout=6.0)
                    if resp.status_code == 200:
                        candidates = resp.json().get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                cleaned = re.sub(r"^```(?:json)?|```$", "", parts[0]["text"].strip(), flags=re.MULTILINE)
                                data = json.loads(cleaned)
                                data["raw_text"] = raw_text
                                return ParsedReceipt(**data)
            except Exception:
                pass

        # OpenAI
        if self.client_type == "openai":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=self.openai_key)
                res = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": self.SYSTEM_PROMPT}, {"role": "user", "content": raw_text}],
                    response_format={"type": "json_object"},
                )
                data = json.loads(res.choices[0].message.content)
                data["raw_text"] = raw_text
                return ParsedReceipt(**data)
            except Exception:
                pass

        # Offline heuristic fallback
        return self._heuristic_parse(raw_text)

    def _heuristic_parse(self, text: str) -> ParsedReceipt:
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        merchant = "Unknown Merchant"
        for line in lines[:4]:
            cleaned = re.sub(r"[*#-]", "", line).strip()
            if len(cleaned) > 3 and not re.search(r"^\s*store\s*#|date|invoice|receipt|tel:|tax|^\s*#|^\d+\s+[A-Za-z]+", cleaned, re.I):
                merchant = cleaned
                break

        # Date
        date_str = datetime.now().strftime("%Y-%m-%d")
        d_match = re.search(r"\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b", text)
        if d_match:
            try:
                date_str = datetime.strptime(d_match.group(1).replace("/", "-").replace(".", "-"), "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                pass

        # Total
        total_amount = 0.0
        totals = re.findall(r"(?:TOTAL|TOTAL PAID|AMOUNT DUE)[\s:]*\$?([0-9,]+\.[0-9]{2})", text, re.I)
        if totals:
            total_amount = float(totals[-1].replace(",", ""))
        else:
            all_floats = [float(a.replace(",", "")) for a in re.findall(r"\$?([0-9,]+\.[0-9]{2})", text)]
            if all_floats:
                total_amount = max(all_floats)

        # Tax
        tax_amount = 0.0
        taxes = re.findall(r"(?:TAX|SALES TAX)[\s\(\)%0-9.:]*\$?([0-9,]+\.[0-9]{2})", text, re.I)
        if taxes:
            tax_amount = float(taxes[-1].replace(",", ""))

        # Items
        items: List[ReceiptItem] = []
        for line in lines:
            m = re.search(r"^(.*?)(?:\s+|\.{2,})\$?([0-9,]+\.[0-9]{2})$", line)
            if m:
                desc = m.group(1).strip()
                price = float(m.group(2).replace(",", ""))
                if not re.search(r"total|subtotal|tax|auth|card|change", desc, re.I) and price > 0:
                    items.append(ReceiptItem(description=desc, quantity=1.0, unit_price=price, total_price=price))

        if not items and total_amount > 0:
            items.append(ReceiptItem(description=f"Expense at {merchant}", total_price=total_amount - tax_amount))

        return ParsedReceipt(
            merchant_name=merchant,
            date=date_str,
            total_amount=round(total_amount, 2),
            tax_amount=round(tax_amount, 2),
            items=items,
            payment_method="Credit Card",
            raw_text=text,
        )
