"""
ReceiptRadar - Receipt Parser Pytest Suite
==========================================
Tests structured receipt extraction, Pydantic schema validation,
date normalization, itemization, and mathematical consistency.
"""

import pytest
from src.parsing.parser import LLMParser
from src.parsing.parse_receipt import parse_receipt, ParsedReceiptSchema, LineItem


def test_llm_parser_heuristic():
    """Verify legacy LLMParser extracts standard receipt data."""
    parser = LLMParser()
    sample_text = (
        "*** STAPLES OFFICE STORE ***\n"
        "DATE: 2026-11-04\n"
        "Printer Paper 10pk    $45.00\n"
        "TOTAL PAID: $45.00\n"
    )
    receipt = parser.parse(sample_text)
    assert receipt.merchant_name == "STAPLES OFFICE STORE"
    assert receipt.total_amount == 45.00
    assert receipt.date == "2026-11-04"
    assert len(receipt.items) >= 1


def test_parse_receipt_schema_validation():
    """Verify strict Pydantic parsing of Indian grocery receipt with GST."""
    text = (
        "*** SHARMA KIRANA STORE ***\n"
        "DATE: 14/11/2024\n"
        "Chai Patti 500g    280.00\n"
        "Sugar 5kg pack     240.00\n"
        "SUBTOTAL:          520.00\n"
        "GST (5%):           26.00\n"
        "TOTAL PAID:        546.00\n"
    )
    parsed: ParsedReceiptSchema = parse_receipt(text)
    assert parsed.vendor == "SHARMA KIRANA STORE"
    assert parsed.date == "2024-11-14"
    assert parsed.total == 546.00
    assert parsed.subtotal == 520.00
    assert parsed.tax == 26.00
    assert len(parsed.line_items) == 2


def test_parse_receipt_fuel_invoice():
    """Verify regex/LLM handling of Indian petrol/diesel pump receipts."""
    fuel_receipt_text = (
        "INDIAN OIL CORPORATION LTD\n"
        "AUTO CARE STATION, CONNAUGHT PLACE\n"
        "DATE: 2024-06-20  TIME: 14:32\n"
        "PRODUCT: DIESEL REGULAR\n"
        "VOLUME: 45.00 LTRS\n"
        "RATE/LTR: 88.50\n"
        "VAT / CGST: 199.12\n"
        "SGST: 199.13\n"
        "NET AMOUNT: 3982.50\n"
        "GRAND TOTAL: 3982.50\n"
        "PAYMENT: UPI\n"
    )
    parsed = parse_receipt(fuel_receipt_text)
    assert "INDIAN OIL" in parsed.vendor.upper()
    assert parsed.date == "2024-06-20"
    assert parsed.total == 3982.50
    assert parsed.tax > 0.0
    assert len(parsed.line_items) >= 1
    assert "DIESEL" in parsed.line_items[0].name.upper()


def test_parse_receipt_subtotal_inference():
    """Verify validator infers subtotal when omitted by the receipt."""
    text_no_subtotal = (
        "DELHI METRO RAIL CORP\n"
        "TRAVEL CARD RECHARGE\n"
        "DATE: 2024-08-01\n"
        "TAX: 0.00\n"
        "TOTAL AMOUNT: 800.00\n"
    )
    parsed = parse_receipt(text_no_subtotal)
    assert parsed.total == 800.00
    assert parsed.subtotal == 800.00


def test_date_format_normalization():
    """Ensure various date formats normalize to standard ISO YYYY-MM-DD."""
    for raw_date, expected_iso in [
        ("15/03/2024", "2024-03-15"),
        ("15-03-2024", "2024-03-15"),
        ("2024/03/15", "2024-03-15"),
        ("2024-03-15", "2024-03-15"),
    ]:
        sample = f"RETAIL STORE\nDATE: {raw_date}\nTOTAL: 150.00\n"
        parsed = parse_receipt(sample)
        assert parsed.date == expected_iso
