"""
ReceiptRadar - Hinglish & Hindi Text Normalizer
================================================
Provides bilingual normalization for Indian small-business expense records:
1. Devanagari to Roman Script Transliteration (zero-dependency rule-based mapper)
2. Common Hinglish Abbreviation & Phonetic Expansion (e.g., 'sbzi' -> 'sabzi', 'bijli' -> 'bijli electricity')
3. Canonical Category-Anchor Enrichment for Downstream TF-IDF Vectorization
"""

import re
import sys
import unicodedata
from typing import Dict, List, Optional

# Windows console encoding safeguard
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# =============================================================================
# 1. DEVANAGARI TO ROMAN SCRIPT TRANSLITERATION TABLE
# =============================================================================

# Independent Vowels
DEV_VOWELS = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'अं': 'an', 'अः': 'ah',
}

# Dependent Vowel Signs (Matras)
DEV_MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'n', 'ँ': 'n', 'ः': 'h',
}

# Consonants (inherent 'a' vowel unless virama/halant is applied)
DEV_CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f',
}

# Digits
DEV_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
}

HALANT = '्'
NUKTA = '़'


def transliterate_devanagari(text: str) -> str:
    """
    Transliterates Hindi Devanagari script to phonetic Romanized text.
    Handles matras, halants, and schwa (inherent 'a') deletion at word endings.
    """
    if not any('\u0900' <= ch <= '\u097f' for ch in text):
        return text  # Already Latin / Roman script

    chars = list(text)
    n = len(chars)
    output = []
    i = 0

    while i < n:
        ch = chars[i]

        # Handle Nukta combinations (e.g., क + ़ = क़)
        if i + 1 < n and chars[i + 1] == NUKTA:
            combined = ch + NUKTA
            if combined in DEV_CONSONANTS:
                ch = combined
                i += 1

        # 1. Independent Vowels
        if ch in DEV_VOWELS:
            output.append(DEV_VOWELS[ch])
            i += 1

        # 2. Consonants
        elif ch in DEV_CONSONANTS:
            base_cons = DEV_CONSONANTS[ch]

            # Check next character for matra, halant, or inherent vowel
            if i + 1 < n:
                next_ch = chars[i + 1]
                if next_ch == HALANT:
                    output.append(base_cons)
                    i += 2  # Skip halant
                elif next_ch in DEV_MATRAS:
                    output.append(base_cons + DEV_MATRAS[next_ch])
                    i += 2  # Skip matra
                elif next_ch == ' ' or next_ch in '.,!?-/()':
                    output.append(base_cons)  # Word-final schwa deletion
                    i += 1
                else:
                    output.append(base_cons + 'a')  # Inherent vowel
                    i += 1
            else:
                output.append(base_cons)  # Word-final consonant
                i += 1

        # 3. Floating Matra (if encountered alone)
        elif ch in DEV_MATRAS:
            output.append(DEV_MATRAS[ch])
            i += 1

        # 4. Digits
        elif ch in DEV_DIGITS:
            output.append(DEV_DIGITS[ch])
            i += 1

        # 5. Non-Devanagari characters (spaces, punctuation, English letters)
        else:
            output.append(ch)
            i += 1

    return "".join(output)


# =============================================================================
# 2. HINGLISH ABBREVIATION & PHONETIC EXPANSION DICTIONARY
# =============================================================================

# Maps informal spellings, abbreviations, and shopkeeper shorthand to normalized canonical tokens
HINGLISH_ABBREVIATIONS: Dict[str, str] = {
    # Groceries / Kirana / Food
    "sbzi": "sabzi",
    "sabji": "sabzi",
    "subzi": "sabzi",
    "subji": "sabzi",
    "kirna": "kirana",
    "kiran": "kirana",
    "karyana": "kirana",
    "rashan": "ration kirana",
    "raashan": "ration kirana",
    "dood": "doodh milk",
    "dudh": "doodh milk",
    "doodh": "doodh milk",
    "paneer": "paneer dairy",
    "panir": "paneer dairy",
    "makhan": "butter makhan",
    "makkhan": "butter makhan",
    "cheeni": "sugar cheeni",
    "chini": "sugar cheeni",
    "shakkar": "sugar cheeni",
    "chaipatti": "chai patti tea",
    "chai": "chai tea",
    "nashta": "breakfast nashta snacks",
    "namkn": "namkeen snacks",
    "namkin": "namkeen snacks",
    "mithai": "sweets mithai",
    "biscuit": "biscuits snacks",
    "biscut": "biscuits snacks",
    "biskut": "biscuits snacks",
    "atta": "aata flour",
    "aata": "aata flour",
    "chawal": "rice chawal",
    "tel": "oil cooking tel",

    # Utilities
    "bjli": "bijli electricity",
    "bijli": "bijli electricity",
    "bijlee": "bijli electricity",
    "paani": "water pani",
    "pani": "water pani",
    "jal": "water pani",
    "board": "board utility",
    "gas": "lpg gas cylinder",
    "cylndr": "cylinder gas",
    "cylinder": "cylinder gas",
    "bharwaya": "refill booking",
    "recharge": "recharge broadband internet",
    "rechrg": "recharge broadband internet",
    "wifi": "wifi internet broadband",
    "net": "internet broadband",

    # Rent / Lease
    "kiraya": "kiraya rent",
    "kraya": "kiraya rent",
    "kiraye": "kiraya rent",
    "bhada": "bhada rent fare",
    "bhadha": "bhada rent fare",
    "bhda": "bhada rent fare",
    "gudam": "godown warehouse rent",
    "godam": "godown warehouse rent",
    "godown": "godown warehouse rent",
    "dukan": "dukaan shop",
    "dokan": "dukaan shop",
    "dukaan": "dukaan shop",
    "dkn": "dukaan shop",

    # Transport / Logistics / Freight
    "transpot": "transport",
    "trasport": "transport",
    "gaadi": "vehicle gadi transport",
    "gadi": "vehicle gadi transport",
    "riksha": "auto rickshaw fare",
    "auto": "auto rickshaw transport fare",
    "tempo": "tempo freight transport",
    "chota hathi": "tempo freight transport",
    "maal": "goods material transport",
    "delivery": "delivery parcel transport",
    "delivry": "delivery parcel transport",
    "petrl": "petrol fuel",
    "ptrl": "petrol fuel",
    "disel": "diesel fuel",
    "deesel": "diesel fuel",
    "dzl": "diesel fuel",
    "toll": "toll tax fastag",
    "parchi": "receipt slip toll",

    # Salaries / Wages / Labor
    "tankha": "salary tankhwah",
    "tankhwah": "salary tankhwah",
    "tankhaah": "salary tankhwah",
    "tnkha": "salary tankhwah",
    "salry": "salary wages",
    "mazdoor": "mazdoor labor wages",
    "majdoor": "mazdoor labor wages",
    "dihadi": "dihadi daily wages",
    "dehadi": "dihadi daily wages",
    "palledar": "palledar loading wages",
    "hamal": "hamal porter wages",
    "safai": "safai cleaning staff",
    "babu": "accountant clerk salary",
    "munshi": "accountant clerk salary",
    "karigar": "worker artisan wages",
    "staff": "staff employee salary",

    # Supplies / Packaging / Printing
    "stationry": "stationery supplies",
    "stnry": "stationery supplies",
    "lifafa": "envelope packaging lifafa",
    "lifafe": "envelope packaging lifafa",
    "panni": "polybag packaging panni",
    "theli": "bags packaging",
    "carton": "carton box packing",
    "dabba": "box packaging dabba",
    "patti": "tape packing tape",
    "kagaz": "paper copier paper",
    "kaagaz": "paper copier paper",
    "register": "register notebook ledger",

    # Marketing / Promotion
    "chhapwaya": "printing marketing banner",
    "chhapayi": "printing marketing",
    "pamplet": "pamphlet marketing flyer",
    "pamflet": "pamphlet marketing flyer",
    "ishtehar": "advertising ishtehar ad",
    "istehar": "advertising ishtehar ad",
    "prachar": "promotion marketing prachar",
    "board": "flex banner board",
    "hoarding": "hoarding banner marketing",

    # Miscellaneous / Maintenance
    "mistri": "mistri plumbing repair",
    "mistry": "mistri repair",
    "taala": "lock hardware repair",
    "chabi": "key hardware repair",
    "plumber": "plumbing repair maintenance",
    "samagri": "pooja items misc",
    "kharcha": "kharcha miscellaneous",
    "khrcha": "kharcha miscellaneous",
}


# =============================================================================
# 3. MAIN NORMALIZATION PIPELINE
# =============================================================================

def normalize_hinglish_text(text: str) -> str:
    """
    Applies end-to-end normalization on noisy Hindi & Hinglish strings:
    1. Transliterates Devanagari script to standard Romanized text.
    2. Lowercases and removes redundant punctuation.
    3. Normalizes repeated characters (e.g., 'sabzziii' -> 'sabzi', 'bhaadaaa' -> 'bhada').
    4. Expands abbreviations and Hinglish colloquial tokens via dictionary mapping.
    """
    if not text or not str(text).strip():
        return ""

    raw = str(text)

    # 1. Transliterate Devanagari Hindi if present
    transliterated = transliterate_devanagari(raw)

    # 2. Lowercase and normalize unicode
    cleaned = unicodedata.normalize("NFKD", transliterated).lower()
    cleaned = re.sub(r"[₹$,#*@!^&()_=+\[\]{};:\"'<>?~`|\\]", " ", cleaned)
    cleaned = re.sub(r"[\s/-]+", " ", cleaned).strip()

    # 3. Collapse 3+ repeated characters (e.g. 'billllll' -> 'bill', 'bhhaadaaa' -> 'bhada')
    cleaned = re.sub(r"(.)\1{2,}", r"\1\1", cleaned)

    # 4. Token-by-token abbreviation expansion with whole-word boundaries
    words = cleaned.split()
    normalized_words = []

    for w in words:
        if w in HINGLISH_ABBREVIATIONS:
            normalized_words.append(HINGLISH_ABBREVIATIONS[w])
        else:
            # Check prefix/suffix stems (e.g., 'sbziyaan' -> 'sabzi')
            matched = False
            for abbr, expanded in HINGLISH_ABBREVIATIONS.items():
                if len(abbr) >= 4 and (w == abbr + "yaan" or w == abbr + "e" or w == abbr + "o"):
                    normalized_words.append(expanded)
                    matched = True
                    break
            if not matched:
                normalized_words.append(w)

    return " ".join(normalized_words)


if __name__ == "__main__":
    demo_samples = [
        "दुकान का किराया और गोदाम भाड़ा दिया",
        "sbzi mandi se aalu pyaaz tamatar khareeda",
        "bjli bill payment nagar nigam",
        "tempo bhda maal transport delivery",
        "palledar mazdoor dihadi roz ka kharcha",
        "pamplet chhapwaya dukan prachar flex board",
        "dukan packing panni lifafe carton",
        "mistri plumbing taala chabi kaam",
    ]
    print("=" * 80)
    print(" HINGLISH & HINDI TEXT NORMALIZATION TEST")
    print("=" * 80)
    for s in demo_samples:
        norm = normalize_hinglish_text(s)
        print(f"Raw Input : {s}")
        print(f"Normalized: {norm}\n")
