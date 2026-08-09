# Product Search Boosts
PRODUCT_SEARCH_FIELDS = [
    "name^5",
    "brand_name^4",
    "category_names^3",
    "shop_name^2",
    "short_description^1",
]

# Shop Search Boosts
SHOP_SEARCH_FIELDS = [
    "shop_name^5",
    "shop_description^2",
]

# Applied on multi_match (not outer bool should)
MINIMUM_SHOULD_MATCH = "2<75%"
MULTI_MATCH_TYPE = "best_fields"

# Optional phrase boosts for exact/near-exact name matches
NAME_PHRASE_BOOST = 10.0
NAME_PREFIX_BOOST = 3.0
