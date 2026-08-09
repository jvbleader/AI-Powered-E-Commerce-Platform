RANKING_WEIGHTS = {
    "text_score": 1.0,         # Base BM25 weight (via boost_mode multiply)
    "popularity_score": 1.1,   # Keep sales influence modest so text match wins
    "rating_score": 1.0,       # Weight for average rating
    "freshness_score": 0.9,    # Weight for newly added products
    "availability_score": 1.5  # Boost for in-stock items
}

# Freshness Configuration (Decay function params)
FRESHNESS_ORIGIN = "now"
FRESHNESS_SCALE = "30d"
FRESHNESS_OFFSET = "7d"
FRESHNESS_DECAY = 0.5
