def validate_query(query: str) -> bool:
    """
    Validate if a query is safe to be sent to Elasticsearch.
    - Too long?
    - Empty?
    """
    if not query:
        return False
    if len(query) > 256: # Limit maximum query length to prevent abusive long queries
        return False
    return True
