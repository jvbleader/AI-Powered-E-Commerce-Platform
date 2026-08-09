import re

# Simple Alias Rules for Rewrite Engine (common VN / e-com abbreviations)
REWRITE_RULES = {
    r'\bip(\d+)\b': r'iphone \1',
    r'\bip\s+(\d+)\b': r'iphone \1',
    r'\b(\d+)\s*prm\b': r'\1 pro max',
    r'\b(\d+)\s*pro\s*max\b': r'\1 pro max',
    r'\bss\b': r'samsung',
    r'\bssung\b': r'samsung',
    r'\bdt\b': r'điện thoại',
    r'\blap\b': r'laptop',
    r'\btai nghe\s+bl(uetooth)?\b': r'tai nghe bluetooth',
    r'\bko day\b': r'không dây',
    r'\bko\b': r'không',
    r'\bmk\b': r'máy lạnh',
    r'\btl\b': r'tủ lạnh',
}


def rewrite_query(query: str) -> str:
    """
    Rewrite the query to expand abbreviations and typos BEFORE going to Elasticsearch.
    """
    if not query:
        return ""

    q = query.lower()
    for pattern, replacement in REWRITE_RULES.items():
        q = re.sub(pattern, replacement, q, flags=re.IGNORECASE)

    # Remove redundant spaces if any after regex replacement
    q = re.sub(r'\s+', ' ', q).strip()
    return q
