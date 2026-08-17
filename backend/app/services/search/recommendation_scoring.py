"""
Recommendation scoring module.
Provides Bayesian average rating calculations, quality gate logic,
and Elasticsearch scoring scripts for recommendation and search services.
"""
from typing import Any, Dict


def calculate_bayesian_rating(
    avg_rating: float,
    review_count: int,
    m: float = 3.0,
    c: float = 3.5,
) -> float:
    """
    Calculate weighted rating using Bayesian average formula:
    WR = (v * R + m * C) / (v + m)

    where:
    - R: product average rating (avg_rating)
    - v: number of reviews (review_count)
    - m: minimum reviews weight (default 3.0)
    - C: prior mean rating (default 3.5)

    If review_count <= 0, returns the prior constant C.
    """
    v = float(review_count or 0)
    r = float(avg_rating or 0.0)
    if v <= 0:
        return float(c)
    return float((v * r + m * c) / (v + m))


def is_quality_gate_passed(
    avg_rating: float,
    review_count: int,
    min_rating: float = 3.0,
) -> bool:
    """
    Check if a product passes the recommendation quality gate.
    If a product has at least 1 review and an average rating strictly less than min_rating,
    it fails the quality gate (returns False).
    Products with no reviews or rating >= min_rating pass (returns True).
    """
    v = review_count or 0
    r = float(avg_rating or 0.0)
    if v >= 1 and r < min_rating:
        return False
    return True


def get_quality_gate_es_filter(min_rating: float = 3.0) -> Dict[str, Any]:
    """
    Generate Elasticsearch exclusion filter query matching products
    that fail the quality gate (review_count >= 1 and average_rating < min_rating).
    """
    return {
        "bool": {
            "must": [
                {"range": {"review_count": {"gte": 1}}},
                {"range": {"average_rating": {"lt": min_rating}}},
            ]
        }
    }


def get_bayesian_script_score_function(
    m: float = 3.0,
    c: float = 3.5,
    weight: float = 2.0,
) -> Dict[str, Any]:
    """
    Generate Elasticsearch Painless script_score function for Bayesian rating ranking.
    Formula: Math.max(0.0, (wr - 2.5) * 1.5)
    """
    source = f"""
     double r = doc['average_rating'].size() > 0 ? doc['average_rating'].value : 0.0;
     double v = doc['review_count'].size() > 0 ? doc['review_count'].value : 0.0;
     double m = {m};
     double c = {c};
     double wr = (v > 0.0) ? ((v * r + m * c) / (v + m)) : c;
     return Math.max(0.0, (wr - 2.5) * 1.5);
     """
    return {
        "script_score": {
            "script": {
                "source": source
            }
        },
        "weight": weight,
    }
