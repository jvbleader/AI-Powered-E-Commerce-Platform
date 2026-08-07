from .normalize import normalize_query
from .rewrite import rewrite_query
from .validate import validate_query

class SearchPipeline:
    def process_query(self, query: str) -> str:
        """
        Execute the query processing pipeline.
        Returns the finalized query string to be used by Strategy and Builder.
        """
        if not query:
            return ""
            
        q = normalize_query(query)
        q = rewrite_query(q)
        
        if not validate_query(q):
            return ""
            
        return q
