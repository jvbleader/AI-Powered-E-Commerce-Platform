# Product Search Boosts
PRODUCT_SEARCH_FIELDS = [
    "name^5",
    "category_names^3",
    "shop_name^2",
    "short_description^1"
]

# Shop Search Boosts
SHOP_SEARCH_FIELDS = [
    "shop_name^5",
    "shop_description^2"
]

MINIMUM_SHOULD_MATCH = "2<75%"
MULTI_MATCH_TYPE = "best_fields"
