RANKING_WEIGHTS = {
    "text_score": 1.0,         # Base BM25 weight
    "popularity_score": 1.5,   # Weight for sales & reviews
    "rating_score": 1.2,       # Weight for average rating
    "freshness_score": 1.1,    # Weight for newly added products
    "availability_score": 2.0  # High penalty for out of stock
}

# Freshness Configuration (Decay function params)
FRESHNESS_ORIGIN = "now"
FRESHNESS_SCALE = "30d"
FRESHNESS_OFFSET = "7d"
FRESHNESS_DECAY = 0.5
