AGGREGATIONS_CONFIG = {
    "categories": {
        "terms": {
            "field": "category_slugs",
            "size": 20
        }
    },
    "brands": {
        "terms": {
            "field": "brand_name.keyword",
            "size": 20
        }
    },
    "price_ranges": {
        "range": {
            "field": "min_price",
            "ranges": [
                { "to": 100000 },
                { "from": 100000, "to": 500000 },
                { "from": 500000, "to": 2000000 },
                { "from": 2000000, "to": 10000000 },
                { "from": 10000000 }
            ]
        }
    },
    "shops": {
        "terms": {
            "field": "shop_slug",
            "size": 20
        }
    },
    "ratings": {
        "range": {
            "field": "average_rating",
            "ranges": [
                { "from": 4.0 },
                { "from": 3.0, "to": 4.0 },
                { "to": 3.0 }
            ]
        }
    },
    "stock_status": {
        "terms": {
            "field": "status",
            "size": 5
        }
    }
}
