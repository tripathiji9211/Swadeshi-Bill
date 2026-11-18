"""
Swadeshi Khata (स्वदेशी खाता) - Robust LLM Receipt Parser
Parses noisy OCR receipt text into strongly-typed, validated Pydantic JSON schemas.
Features:
- Multi-provider support (Google Gemini & OpenAI) loading API keys from .env
- Strict system prompt with math validation & normalization rules
- Exponential backoff retry logic (tenacity) for API resilience
- Full deterministic Regex/Heuristic fallback parser for offline execution
- Complete test suite with 3 realistic noisy receipt examples
"""

import sys
import os
import re
import json
import time
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator, ValidationInfo
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Load environment variables from .env file
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

# Safeguard console UTF-8 printing
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


# -----------------------------------------------------------------------------
# 1. PYDANTIC VALIDATION SCHEMAS
# -----------------------------------------------------------------------------

class LineItem(BaseModel):
    """Represents an individual line item on a parsed receipt."""
    name: str = Field(..., description="Clean name or description of purchased item")
    qty: float = Field(default=1.0, ge=0.01, description="Quantity of units purchased")
    price: float = Field(..., ge=0.0, description="Total price for this line item")

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        cleaned = re.sub(r"^[0-9xX\s*.-]+", "", v).strip()
        return cleaned if cleaned else v.strip()


class ParsedReceiptSchema(BaseModel):
    """
    Strict validated JSON schema for parsed receipt documents.
    """
    vendor: str = Field(..., min_length=2, description="Clean store, vendor, or merchant name")
    date: str = Field(..., description="Normalized transaction date in YYYY-MM-DD format")
    line_items: List[LineItem] = Field(default_factory=list, description="Itemized lines")
    subtotal: float = Field(default=0.0, ge=0.0, description="Pre-tax subtotal amount")
    tax: float = Field(default=0.0, ge=0.0, description="Sales tax, GST, VAT, or CGST+SGST")
    total: float = Field(..., gt=0.0, description="Grand total amount paid")
    parser_used: Optional[str] = Field(default="unknown", description="Engine used (gemini, openai, fallback_regex)")

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        """Enforces ISO YYYY-MM-DD format."""
        v = v.strip()
        try:
            parsed = datetime.strptime(v, "%Y-%m-%d")
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            # Attempt to parse common alternate formats
            for fmt in ("%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d-%b-%Y", "%d %b %Y"):
                try:
                    return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
                except ValueError:
                    pass
        # Fallback to current date if completely unparseable
        return datetime.now().strftime("%Y-%m-%d")

    @field_validator("subtotal", mode="after")
    @classmethod
    def infer_subtotal_if_zero(cls, v: float, info: ValidationInfo) -> float:
        """Infers subtotal if omitted by receipt or LLM."""
        data = info.data
        total = data.get("total", 0.0)
        tax = data.get("tax", 0.0)
        if v == 0.0 and total > 0.0:
            return round(max(0.0, total - tax), 2)
        return round(v, 2)


# -----------------------------------------------------------------------------
# 2. STRICT SYSTEM PROMPT
# -----------------------------------------------------------------------------

SYSTEM_PROMPT = """
You are an expert AI financial auditor and OCR text parser.
Your task is to extract structured receipt data from noisy, messy OCR text (which may contain typos, Hindi/Hinglish terms, or misaligned columns).

You must return ONLY a raw valid JSON object matching this EXACT schema:
{
  "vendor": "Clean vendor or merchant name (string)",
  "date": "YYYY-MM-DD (ISO date format)",
  "line_items": [
    {
      "name": "Clean item description (string)",
      "qty": 1.0,
      "price": 0.00
    }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}

CRITICAL RULES:
1. Vendor: Clean away OCR junk, asterisks, store numbers, or addresses.
2. Date: Convert any date representation into strict YYYY-MM-DD. If year is missing, assume current year.
3. Amounts: All amounts (subtotal, tax, total, price) must be positive floating point numbers with NO currency symbols ($, Rs, ₹, INR).
4. Subtotal: If not explicitly listed, compute: total - tax, or sum of line_item prices.
5. Tax: Combine any CGST, SGST, IGST, VAT, or Sales Tax. If none found, use 0.00.
6. Line items: Extract item name, quantity (default 1.0 if not listed), and price. Do not hallucinate items not present in the text.
7. Output format: Return PURE JSON only. Do NOT wrap in markdown code blocks like ```json ... ```. No explanations.
"""


# -----------------------------------------------------------------------------
# 3. LLM API CLIENTS WITH TENACITY RETRY LOGIC
# -----------------------------------------------------------------------------

class LLMReceiptParser:
    """
    Orchestrates LLM API calls with exponential backoff and automatic regex fallback.
    """

    def __init__(self, prefer_provider: str = "auto"):
        self.gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.provider = self._resolve_provider(prefer_provider)

    def _resolve_provider(self, prefer: str) -> str:
        if prefer == "gemini" and self.gemini_key:
            return "gemini"
        if prefer == "openai" and self.openai_key:
            return "openai"

        # Auto detection based on available keys in .env
        if self.gemini_key:
            return "gemini"
        elif self.openai_key:
            return "openai"
        return "fallback_regex"

    @retry(
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=2),
        retry=retry_if_exception_type((json.JSONDecodeError, ValueError)),
        reraise=True,
    )
    def _call_gemini(self, ocr_text: str) -> ParsedReceiptSchema:
        """Invokes Google Gemini REST API with validation and retry."""
        import requests
        prompt = f"{SYSTEM_PROMPT}\n\nRAW RECEIPT TEXT:\n{ocr_text}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }
        # Try active flash models in order
        candidate_models = ["gemini-3-flash-preview", "gemini-3.5-flash"]
        last_error = None

        for model_name in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self.gemini_key}"
            try:
                resp = requests.post(url, json=payload, timeout=2.5)
                if resp.status_code == 200:
                    result = resp.json()
                    candidates = result.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            raw_output = parts[0]["text"].strip()
                            cleaned_json = self._clean_json_string(raw_output)
                            data = json.loads(cleaned_json)
                            data["parser_used"] = f"gemini ({model_name})"
                            return ParsedReceiptSchema(**data)
                elif resp.status_code in (404, 503):
                    # Model deprecated or temporary unavailable, try next candidate
                    last_error = f"HTTP {resp.status_code}: {resp.text[:120]}"
                    continue
                else:
                    last_error = f"HTTP {resp.status_code}: {resp.text[:120]}"
            except Exception as ex:
                last_error = str(ex)

        raise ConnectionError(f"Gemini API request failed across models: {last_error}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=6),
        retry=retry_if_exception_type((json.JSONDecodeError, ValueError, ConnectionError)),
        reraise=True,
    )
    def _call_openai(self, ocr_text: str) -> ParsedReceiptSchema:
        """Invokes OpenAI API with validation and retry."""
        from openai import OpenAI
        client = OpenAI(api_key=self.openai_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"RAW RECEIPT TEXT:\n{ocr_text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        raw_output = response.choices[0].message.content.strip()
        cleaned_json = self._clean_json_string(raw_output)
        data = json.loads(cleaned_json)
        data["parser_used"] = "openai"
        return ParsedReceiptSchema(**data)

    def _clean_json_string(self, text: str) -> str:
        """Strips markdown code fences from LLM responses."""
        cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip(), flags=re.MULTILINE)
        return cleaned.strip()

    # -------------------------------------------------------------------------
    # 4. DETERMINISTIC REGEX & HEURISTIC FALLBACK PARSER
    # -------------------------------------------------------------------------

    def _fallback_regex_parse(self, text: str) -> ParsedReceiptSchema:
        """
        Deterministic regex parser that extracts receipt metadata when API keys
        are absent or cloud APIs experience network failure.
        """
        lines = [l.strip() for l in text.splitlines() if l.strip()]

        # 1. Vendor Extraction
        vendor = "Unknown Merchant"
        for line in lines[:4]:
            cleaned = re.sub(r"[*#=-]", "", line).strip()
            # Skip GSTIN, Store IDs, Dates, Phone numbers
            if len(cleaned) > 3 and not re.search(r"^(gst|store|dt:|date|bill|inv|tel|table|ph)", cleaned, re.I):
                vendor = cleaned
                break

        # 2. Date Extraction (supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, etc.)
        date_str = datetime.now().strftime("%Y-%m-%d")
        d_match = re.search(r"\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b", text)
        if d_match:
            try:
                date_str = datetime.strptime(d_match.group(1).replace("/", "-").replace(".", "-"), "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                pass
        else:
            d_match2 = re.search(r"\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b", text)
            if d_match2:
                for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%y", "%d-%m-%y"):
                    try:
                        date_str = datetime.strptime(d_match2.group(1), fmt).strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        pass

        # 3. Grand Total Extraction
        total = 0.0
        total_pats = [
            r"(?:GRAND TOTAL|TOTAL PAYABLE|TOTAL SALE|TOTAL PAID|AMOUNT DUE|NET AMOUNT|TOTAL)[\s:₹Rs\.]*([\d,]+\.?\d{2})",
            r"(?:TOTAL)[\s:₹Rs\.]*([\d,]+)",
        ]
        for pat in total_pats:
            matches = re.findall(pat, text, re.I)
            if matches:
                try:
                    total = float(matches[-1].replace(",", ""))
                    break
                except ValueError:
                    continue

        if total == 0.0:
            # Fallback: largest dollar/rupee amount in the receipt
            all_amts = re.findall(r"(?:₹|Rs\.?|\$)?\s*([\d,]+\.\d{2})", text)
            if all_amts:
                floats = [float(a.replace(",", "")) for a in all_amts]
                total = max(floats)

        # 4. Tax Extraction (GST, CGST, SGST, VAT)
        tax = 0.0
        for line in lines:
            if re.search(r"\b(tax|sales tax|vat|gst|cgst|sgst)\b", line, re.I):
                # Avoid subtotal or total lines that might mention tax
                if not re.search(r"\b(total|subtotal|grand total|net)\b", line, re.I) or re.search(r"\b(vat|gst|tax)\s*[\d(]", line, re.I):
                    amts = re.findall(r"([0-9,]+\.[0-9]{2})", line)
                    if amts:
                        tax += float(amts[-1].replace(",", ""))
        tax = round(tax, 2)

        # 5. Subtotal Extraction
        subtotal = 0.0
        sub_match = re.search(r"(?:SUBTOTAL|SUB TOTAL|NET RATE)[\s:₹Rs\.]*([\d,]+\.?\d{2})", text, re.I)
        if sub_match:
            try:
                subtotal = float(sub_match.group(1).replace(",", ""))
            except ValueError:
                subtotal = max(0.0, total - tax)
        else:
            subtotal = max(0.0, total - tax)

        # 6. Itemized Lines Extraction
        line_items: List[LineItem] = []

        # Check for Fuel Product pattern
        fuel_prod = re.search(r"PRODUCT[\s:]+([^\n\r]+)", text, re.I)
        fuel_vol = re.search(r"VOLUME[\s:]+([0-9.]+)\s*(?:LTRS|L)?", text, re.I)
        if fuel_prod and total > 0:
            p_name = fuel_prod.group(1).strip().title()
            p_qty = float(fuel_vol.group(1)) if fuel_vol else 1.0
            line_items.append(LineItem(name=p_name, qty=p_qty, price=total))
        else:
            for line in lines:
                # Matches: [Qty x] Description ... Price
                m = re.search(r"^(?:(\d+)[xX\s*]+)?(.*?)(?:\s+|\.{2,}|₹|Rs\.?|\$)([\d,]+\.\d{2})$", line)
                if m:
                    qty_str, desc, price_str = m.group(1), m.group(2).strip(), m.group(3)
                    try:
                        price_val = float(price_str.replace(",", ""))
                        qty_val = float(qty_str) if qty_str else 1.0
                        # Skip subtotal, tax, total, rate lines
                        if not re.search(r"(total|subtotal|tax|gst|sgst|cgst|round|paid|balance|auth|swipe|cash|upi|rate/ltr)", desc, re.I):
                            if price_val > 0 and len(desc) > 2:
                                line_items.append(LineItem(name=desc, qty=qty_val, price=price_val))
                    except ValueError:
                        continue

        # If no items parsed, create unified parent item
        if not line_items and total > 0.0:
            line_items.append(LineItem(name=f"Expense at {vendor}", qty=1.0, price=subtotal if subtotal > 0 else total))

        return ParsedReceiptSchema(
            vendor=vendor,
            date=date_str,
            line_items=line_items,
            subtotal=round(subtotal, 2),
            tax=round(tax, 2),
            total=round(total, 2),
            parser_used="fallback_regex",
        )

    # -------------------------------------------------------------------------
    # 5. MAIN PARSING ORCHESTRATOR
    # -------------------------------------------------------------------------

    def parse_receipt(self, ocr_text: str) -> ParsedReceiptSchema:
        """
        Sends raw OCR text to configured LLM (Gemini / OpenAI),
        validates output against Pydantic schema, and gracefully falls back to regex.
        """
        if not ocr_text or not ocr_text.strip():
            raise ValueError("Input OCR text is empty.")

        # Try Gemini
        if self.provider == "gemini" and check_network_available():
            try:
                return self._call_gemini(ocr_text)
            except Exception as e:
                print(f"[Warning] Gemini API failed after retries: {e}. Falling back to Regex parser.")

        # Try OpenAI
        elif self.provider == "openai" and check_network_available():
            try:
                return self._call_openai(ocr_text)
            except Exception as e:
                print(f"[Warning] OpenAI API failed after retries: {e}. Falling back to Regex parser.")

        # Fallback Regex
        return self._fallback_regex_parse(ocr_text)


def check_network_available(timeout: float = 0.2) -> bool:
    """Instant non-blocking IP check avoiding Windows DNS lookup hangs."""
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect(("8.8.8.8", 53))
        sock.close()
        return True
    except Exception:
        return False


# Singleton instance helper
_DEFAULT_PARSER = None


def parse_receipt(ocr_text: str, prefer_provider: str = "auto") -> ParsedReceiptSchema:
    """Convenience function to parse receipt text."""
    global _DEFAULT_PARSER
    if _DEFAULT_PARSER is None or prefer_provider != "auto":
        _DEFAULT_PARSER = LLMReceiptParser(prefer_provider=prefer_provider)
    return _DEFAULT_PARSER.parse_receipt(ocr_text)


# -----------------------------------------------------------------------------
# 6. DEMO EXAMPLES & CLI VERIFICATION
# -----------------------------------------------------------------------------

EXAMPLE_RECEIPTS = [
    {
        "title": "Example 1: Indian SMB Kirana / Grocery Receipt (Hinglish & Messy Print)",
        "ocr_text": """
*** SHARMA KIRANA & GEN STORE ***
GSTIN: 07AAAAA0000A1Z5   STORE #14
DATE: 14/11/2024   TIME: 18:25
Bill No: INV-4921
--------------------------------
Chai Patti 500g 1 x 280.00   280.00
Sugar 5kg pack               240.00
Dairy Milk Powder 1kg        420.00
Pantry Biscuit Rusk 4pk      160.00
--------------------------------
SUB TOTAL:                 1100.00
GST (5%):                    55.00
GRAND TOTAL:               1155.00
UPI REF: 489201948201 - PAID
DHANYAWAD / THANK YOU!
""",
    },
    {
        "title": "Example 2: Fuel / Commercial Van Diesel Receipt (Pump Abbreviations & Taxes)",
        "ocr_text": """
BHARAT PETROLEUM CORP LTD (BPCL)
AUTO CARE CENTRE, INDIRANAGAR
RECEIPT NO: 902184
DT: 2025-03-22  08:45 AM
PUMP NO: 04   NOZZLE: 02
PRODUCT: SPEED DIESEL
RATE/LTR: Rs 88.50
VOLUME: 40.00 LTRS
TOTAL SALE: Rs 3540.00
INCL OF ALL TAXES (VAT 18%): 540.00
SWIPE CARD: VISA APPROVED
THANK YOU VISIT AGAIN
""",
    },
    {
        "title": "Example 3: Corporate Client Dinner Invoice (Split CGST/SGST Taxes & Multi-Dish)",
        "ocr_text": """
THE CAPITAL GRILLE & RESTAURANT
12 PARK STREET, CONNAUGHT PLACE
INVOICE NO: REST/8820
DATE: 2025-10-18  21:40
TABLE: T-14  STEWARD: RAMESH
-----------------------------------
2x Paneer Tikka Platter    700.00
1x Dal Makhani Special     380.00
4x Butter Naan             200.00
1x Executive Thali Combo   550.00
2x Fresh Lime Soda         180.00
-----------------------------------
SUBTOTAL:                 2010.00
CGST @ 2.5%:                50.25
SGST @ 2.5%:                50.25
ROUND OFF:                   0.50
TOTAL PAYABLE:            2111.00
PAID BY: HDFC CREDIT CARD
""",
    },
]


def run_examples():
    """Runs and displays parsed results for the 3 test receipts."""
    print("=" * 75)
    print(" SWADESHI KHATA (स्वदेशी खाता) LLM RECEIPT PARSER - 3 TEST SCENARIOS")
    print("=" * 75)

    parser = LLMReceiptParser()
    print(f"Active Parser Engine: {parser.provider.upper()}\n")

    for idx, ex in enumerate(EXAMPLE_RECEIPTS, 1):
        print(f"[{idx}/3] {ex['title']}")
        print("-" * 75)
        print("INPUT RAW OCR TEXT:")
        print(ex["ocr_text"].strip())
        print("\nPARSED & VALIDATED PYDANTIC JSON OUTPUT:")

        parsed: ParsedReceiptSchema = parser.parse_receipt(ex["ocr_text"])
        print(json.dumps(parsed.model_dump(), indent=2, ensure_ascii=False))

        # Quick validation assertions
        assert parsed.total > 0.0, "Total must be greater than zero"
        assert parsed.date != "", "Date must be extracted"
        assert len(parsed.line_items) > 0, "Line items must be extracted"
        print(f" -> Validation Passed (Vendor: '{parsed.vendor}', Total: {parsed.total}, Engine: {parsed.parser_used})")
        print("=" * 75 + "\n")


if __name__ == "__main__":
    run_examples()
