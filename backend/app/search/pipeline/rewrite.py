import re

# Simple Alias Rules for Rewrite Engine
REWRITE_RULES = {
    r'\bip(\d+)\b': r'iphone \1',
    r'\bip\s+(\d+)\b': r'iphone \1',
    r'\b(\d+)\s*prm\b': r'\1 pro max',
    r'\bko day\b': r'không dây'
}

def rewrite_query(query: str) -> str:
    """
    Rewrite the query to expand abbreviations and typos BEFORE going to Elasticsearch.
    """
    if not query:
        return ""
    
    q = query
    for pattern, replacement in REWRITE_RULES.items():
        q = re.sub(pattern, replacement, q)
    
    # Remove redundant spaces if any after regex replacement
    q = re.sub(r'\s+', ' ', q).strip()
    return q
