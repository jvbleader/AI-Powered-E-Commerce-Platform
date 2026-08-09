from .config.ranking import (
    RANKING_WEIGHTS,
    FRESHNESS_DECAY,
    FRESHNESS_OFFSET,
    FRESHNESS_ORIGIN,
    FRESHNESS_SCALE,
)


class RankingEngine:
    """
    Applies business ranking logic via Elasticsearch function_score.
    Separates the scoring logic from the base query construction.
    """

    def __init__(self, base_query: dict):
        self.base_query = base_query
        self.functions = []

    def apply_popularity_score(self) -> "RankingEngine":
        """Boost score based on sold_count."""
        # `weight` must be a sibling of field_value_factor (not nested inside it)
        self.functions.append({
            "field_value_factor": {
                "field": "sold_count",
                "modifier": "log1p",
                "missing": 0,
                "factor": 1,
            },
            "weight": RANKING_WEIGHTS.get("popularity_score", 1.0),
        })
        return self

    def apply_rating_score(self) -> "RankingEngine":
        """Boost score based on average rating."""
        self.functions.append({
            "field_value_factor": {
                "field": "average_rating",
                "modifier": "none",
                "missing": 0,
                "factor": 1,
            },
            "weight": RANKING_WEIGHTS.get("rating_score", 1.0),
        })
        return self

    def apply_freshness_score(self) -> "RankingEngine":
        """Boost newly created items using exponential decay."""
        self.functions.append({
            "exp": {
                "created_at": {
                    "origin": FRESHNESS_ORIGIN,
                    "scale": FRESHNESS_SCALE,
                    "offset": FRESHNESS_OFFSET,
                    "decay": FRESHNESS_DECAY,
                }
            },
            "weight": RANKING_WEIGHTS.get("freshness_score", 1.0),
        })
        return self

    def apply_availability_score(self) -> "RankingEngine":
        """Boost in-stock items."""
        self.functions.append({
            "filter": {"term": {"in_stock": True}},
            "weight": RANKING_WEIGHTS.get("availability_score", 1.0),
        })
        return self

    def apply_field_value_factor(
        self,
        field: str,
        *,
        modifier: str = "log1p",
        missing: float = 0,
        weight: float = 1.0,
    ) -> "RankingEngine":
        self.functions.append({
            "field_value_factor": {
                "field": field,
                "modifier": modifier,
                "missing": missing,
                "factor": 1,
            },
            "weight": weight,
        })
        return self

    def build(self) -> dict:
        if not self.functions:
            return self.base_query

        return {
            "function_score": {
                "query": self.base_query,
                "functions": self.functions,
                "score_mode": "sum",
                "boost_mode": "multiply",
            }
        }
