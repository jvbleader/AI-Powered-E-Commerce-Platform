import re

def normalize_query(query: str) -> str:
    """
    Standardize the query before any rewrite rules.
    - Lowercase
    - Remove redundant spaces
    - Remove special characters that are not useful
    """
    if not query:
        return ""
    
    q = query.lower()
    # Keep alphanumeric, spaces, and some basic punctuation
    q = re.sub(r'[^\w\s]', ' ', q)
    # Remove extra spaces
    q = re.sub(r'\s+', ' ', q).strip()
    return q
