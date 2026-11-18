"""
ReceiptRadar - LLM JSON Parser
Parses unstructured raw OCR receipt text into strongly-typed structured JSON schema.
Supports Google Gemini, OpenAI, and a reliable regex/heuristic fallback parser.
"""

import json
import re
from datetime import datetime
from typing import Dict, Any, List
import os

from backend.app.models.schemas import ParsedReceipt, ReceiptItem
from backend.app.config import GEMINI_API_KEY, OPENAI_API_KEY


class LLMParser:
    """
    Intelligent receipt parser extracting:
    - Merchant Name
    - Transaction Date (normalized to YYYY-MM-DD)
    - Total Amount & Tax
    - Itemized Line Items
    - Payment Method & Receipt Reference Number
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
Rules:
1. Normalize date to YYYY-MM-DD. If year is missing, assume current year.
2. total_amount and tax_amount must be floating point numbers without currency symbols.
3. If tax is not specified, default to 0.00.
4. Output valid JSON only, without markdown fences or additional explanation.
"""

    def __init__(self):
        self.gemini_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        self.openai_key = OPENAI_API_KEY or os.getenv("OPENAI_API_KEY", "")
        self.client_type = "heuristic"

        if self.gemini_key:
            self.client_type = "gemini"
        elif self.openai_key:
            self.client_type = "openai"

    def parse(self, raw_text: str) -> ParsedReceipt:
        """
        Parses OCR text using available LLM API or fallback parser.
        """
        # Try Gemini API if key is available
        if self.client_type == "gemini":
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                response = model.generate_content(
                    f"{self.SYSTEM_PROMPT}\n\nRECEIPT TEXT:\n{raw_text}"
                )
                clean_json = self._clean_llm_json(response.text)
                data = json.loads(clean_json)
                data["raw_text"] = raw_text
                return ParsedReceipt(**data)
            except Exception as e:
                print(f"Gemini API parse notice: {e}, using heuristic fallback.")

        # Try OpenAI API if key is available
        if self.client_type == "openai":
            try:
                from openai import OpenAI
                client = OpenAI(api_key=self.openai_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": f"RECEIPT TEXT:\n{raw_text}"}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )
                data = json.loads(response.choices[0].message.content)
                data["raw_text"] = raw_text
                return ParsedReceipt(**data)
            except Exception as e:
                print(f"OpenAI API parse notice: {e}, using heuristic fallback.")

        # Robust Heuristic / Regex Fallback Parser
        return self._heuristic_parse(raw_text)

    def _clean_llm_json(self, response_text: str) -> str:
        """Removes markdown code fences from LLM responses."""
        cleaned = re.sub(r"^```(?:json)?", "", response_text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"```$", "", cleaned.strip(), flags=re.MULTILINE)
        return cleaned.strip()

    def _heuristic_parse(self, text: str) -> ParsedReceipt:
        """
        Robust rule-based parser that handles standard receipt layouts:
        merchant detection, date extraction, dollar totals, and item listings.
        """
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        
        # 1. Extract Merchant Name (usually first 1-3 lines, cleaning asterisks)
        merchant = "Unknown Merchant"
        for line in lines[:4]:
            cleaned_line = re.sub(r"[*#-]", "", line).strip()
            # Skip metadata lines (e.g. "STORE #49102", "DATE:", "TEL:")
            if len(cleaned_line) > 3 and not re.search(r"^\s*store\s*#|date|invoice|receipt|tel:|tax|^\s*#|^\d+\s+[A-Za-z]+", cleaned_line, re.I):
                merchant = cleaned_line
                break

        # 2. Extract Date (support YYYY-MM-DD, MM/DD/YYYY, etc.)
        date_str = datetime.now().strftime("%Y-%m-%d")
        date_match = re.search(r"\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b", text)
        if date_match:
            try:
                parsed_d = datetime.strptime(date_match.group(1).replace("/", "-").replace(".", "-"), "%Y-%m-%d")
                date_str = parsed_d.strftime("%Y-%m-%d")
            except ValueError:
                pass
        else:
            date_match2 = re.search(r"\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b", text)
            if date_match2:
                for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%d/%m/%Y"):
                    try:
                        parsed_d = datetime.strptime(date_match2.group(1), fmt)
                        date_str = parsed_d.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue

        # 3. Extract Total Amount
        total_amount = 0.0
        # Priority patterns: "TOTAL PAID: $xx.xx" or "TOTAL: $xx.xx"
        total_matches = re.findall(r"(?:TOTAL|TOTAL PAID|AMOUNT DUE|BALANCE DUE|GRAND TOTAL)[\s:]*\$?([0-9,]+\.[0-9]{2})", text, re.I)
        if total_matches:
            total_amount = float(total_matches[-1].replace(",", ""))
        else:
            # Fallback: largest dollar amount in the receipt
            all_amounts = re.findall(r"\$?([0-9,]+\.[0-9]{2})", text)
            if all_amounts:
                floats = [float(a.replace(",", "")) for a in all_amounts]
                total_amount = max(floats)

        # 4. Extract Tax Amount
        tax_amount = 0.0
        tax_matches = re.findall(r"(?:TAX|SALES TAX|VAT)[\s\(\)%0-9.:]*\$?([0-9,]+\.[0-9]{2})", text, re.I)
        if tax_matches:
            tax_amount = float(tax_matches[-1].replace(",", ""))

        # 5. Extract Payment Method
        payment_method = "Credit Card"
        if re.search(r"cash", text, re.I):
            payment_method = "Cash"
        elif re.search(r"debit", text, re.I):
            payment_method = "Debit Card"
        elif re.search(r"visa", text, re.I):
            payment_method = "Visa Card"
        elif re.search(r"master|mastercard", text, re.I):
            payment_method = "Mastercard"
        elif re.search(r"amex|american express", text, re.I):
            payment_method = "Amex Card"

        # 6. Extract Line Items
        items: List[ReceiptItem] = []
        for line in lines:
            # Line format: Description followed by price at end
            item_match = re.search(r"^(.*?)(?:\s+|\.{2,})\$?([0-9,]+\.[0-9]{2})$", line)
            if item_match:
                desc = item_match.group(1).strip()
                price = float(item_match.group(2).replace(",", ""))
                # Skip subtotal, tax, total, or payment lines
                if not re.search(r"total|subtotal|tax|auth|card|bal|due|change", desc, re.I) and price > 0:
                    items.append(ReceiptItem(
                        description=desc,
                        quantity=1.0,
                        unit_price=price,
                        total_price=price,
                    ))

        # Default item if none parsed
        if not items and total_amount > 0:
            items.append(ReceiptItem(
                description=f"Expense at {merchant}",
                quantity=1.0,
                unit_price=total_amount - tax_amount,
                total_price=total_amount - tax_amount,
            ))

        # Receipt reference number
        receipt_num = None
        r_match = re.search(r"(?:RECEIPT|INVOICE|ORDER|RCT)[\s#:]*([A-Za-z0-9-]+)", text, re.I)
        if r_match:
            receipt_num = r_match.group(1)

        return ParsedReceipt(
            merchant_name=merchant,
            date=date_str,
            total_amount=round(total_amount, 2),
            tax_amount=round(tax_amount, 2),
            items=items,
            payment_method=payment_method,
            receipt_number=receipt_num,
            raw_text=text,
        )
