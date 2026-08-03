from __future__ import annotations

import logging
from typing import Any
from elasticsearch.helpers import async_bulk

from core.elasticsearch import get_es_client

logger = logging.getLogger(__name__)

INDEX_NAME = "products"

INDEX_SETTINGS: dict[str, Any] = {
    "settings": {
        "analysis": {
            "analyzer": {
                "vi_standard": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase"],
                },
            },
        },
    },
    "mappings": {
        "properties": {
            "id": {"type": "integer"},
            "public_id": {"type": "keyword"},
            "name": {
                "type": "text",
                "analyzer": "vi_standard",
                "fields": {"raw": {"type": "keyword"}},
            },
            "slug": {"type": "keyword"},
            "shop_name": {
                "type": "text",
                "analyzer": "vi_standard",
                "fields": {"raw": {"type": "keyword"}},
            },
            "shop_slug": {"type": "keyword"},
            "shop_logo_url": {"type": "keyword", "index": False},
            "short_description": {
                "type": "text",
                "analyzer": "vi_standard",
            },
            "min_price": {"type": "float"},
            "thumbnail_url": {"type": "keyword", "index": False},
            "category_slugs": {"type": "keyword"},
            "status": {"type": "keyword"},
            "sold_count": {"type": "integer"},
            "average_rating": {"type": "float"},
            "review_count": {"type": "integer"},
            "created_at": {"type": "date"},
        },
    },
}

async def create_products_index() -> None:
    """Create the products index if it doesn't exist."""
    es = get_es_client()
    try:
        exists = await es.indices.exists(index=INDEX_NAME)
        if not exists:
            await es.indices.create(index=INDEX_NAME, body=INDEX_SETTINGS)
            logger.info("Created Elasticsearch index: %s", INDEX_NAME)
        else:
            logger.info("Elasticsearch index already exists: %s", INDEX_NAME)
    except Exception:
        logger.exception("Failed to create Elasticsearch index: %s", INDEX_NAME)

async def recreate_products_index() -> None:
    """Drop and recreate the products index (use when mappings change)."""
    es = get_es_client()
    try:
        exists = await es.indices.exists(index=INDEX_NAME)
        if exists:
            await es.indices.delete(index=INDEX_NAME)
            logger.info("Deleted old Elasticsearch index: %s", INDEX_NAME)
        await es.indices.create(index=INDEX_NAME, body=INDEX_SETTINGS)
        logger.info("Recreated Elasticsearch index: %s", INDEX_NAME)
    except Exception:
        logger.exception("Failed to recreate Elasticsearch index: %s", INDEX_NAME)

async def index_product(product_data: dict) -> None:
    """Index or update a single product document in Elasticsearch."""
    es = get_es_client()
    try:
        await es.index(
            index=INDEX_NAME,
            id=str(product_data["id"]),
            document=product_data,
        )
    except Exception:
        logger.exception("Failed to index product %s", product_data.get("id"))

async def delete_product_from_index(product_id: int) -> None:
    """Delete a product document from the Elasticsearch index."""
    es = get_es_client()
    try:
        await es.delete(index=INDEX_NAME, id=str(product_id), ignore=[404])
    except Exception:
        logger.exception("Failed to delete product %s from index", product_id)

async def bulk_index_products(products: list[dict]) -> None:
    """Bulk index a list of product documents."""
    if not products:
        return
    es = get_es_client()
    actions = [
        {
            "_index": INDEX_NAME,
            "_id": str(p["id"]),
            "_source": p,
        }
        for p in products
    ]
    try:
        success, errors = await async_bulk(es, actions, raise_on_error=False)
        logger.info("Bulk indexed %d products, %d errors", success, len(errors))
    except Exception:
        logger.exception("Failed to bulk index products")

async def search_autocomplete(query: str, limit: int = 8) -> dict:
    """
    Search for keyword suggestions (Shopee-style).
    Uses match_phrase_prefix for precise Vietnamese matching.
    Returns {"suggestions": [{"keyword": str, "type": "keyword"|"shop", "shop_slug": str|None}]}
    """
    es = get_es_client()
    result: dict = {"suggestions": []}

    try:
        # 1. Search for matching shop names (phrase prefix match)
        shop_resp = await es.search(
            index=INDEX_NAME,
            body={
                "size": 1,
                "query": {
                    "match_phrase_prefix": {
                        "shop_name": {
                            "query": query,
                            "max_expansions": 10,
                        },
                    },
                },
                "_source": ["shop_name", "shop_slug"],
            },
        )
        shop_hits = shop_resp.get("hits", {}).get("hits", [])
        if shop_hits:
            shop = shop_hits[0]["_source"]
            result["suggestions"].append({
                "keyword": f'Tìm Shop "{query}"',
                "type": "shop",
                "shop_slug": shop["shop_slug"],
            })

        # 2. Search for matching product names
        product_resp = await es.search(
            index=INDEX_NAME,
            body={
                "size": limit * 3,  # fetch extra to deduplicate
                "query": {
                    "function_score": {
                        "query": {
                            "bool": {
                                "should": [
                                    # Exact phrase prefix (highest priority)
                                    {
                                        "match_phrase_prefix": {
                                            "name": {
                                                "query": query,
                                                "boost": 10,
                                                "max_expansions": 10,
                                            },
                                        },
                                    },
                                    # Individual word match (broader, across fields)
                                    {
                                        "combined_fields": {
                                            "query": query,
                                            "fields": ["name^3", "shop_name^2", "short_description"],
                                            "operator": "and",
                                        },
                                    },
                                    # Any word match (broadest fallback)
                                    {
                                        "combined_fields": {
                                            "query": query,
                                            "fields": ["name^3", "shop_name^2", "short_description"],
                                            "operator": "or",
                                        },
                                    },
                                    # Typo tolerance (fuzziness)
                                    {
                                        "multi_match": {
                                            "query": query,
                                            "fields": ["name^2", "short_description"],
                                            "fuzziness": "AUTO",
                                        },
                                    },
                                ],
                                "minimum_should_match": 1,
                            },
                        },
                        "functions": [
                            {
                                "field_value_factor": {
                                    "field": "sold_count",
                                    "modifier": "log1p",
                                    "missing": 0,
                                },
                            },
                        ],
                        "score_mode": "sum",
                        "boost_mode": "multiply",
                    },
                },
                "_source": ["name"],
            },
        )

        # Extract unique keyword suggestions from product names
        seen: set[str] = set()
        product_hits = product_resp.get("hits", {}).get("hits", [])
        for hit in product_hits:
            name = hit["_source"].get("name", "").strip()
            name_lower = name.lower()
            if name_lower and name_lower not in seen:
                seen.add(name_lower)
                result["suggestions"].append({
                    "keyword": name,
                    "type": "keyword",
                    "shop_slug": None,
                })
            if len(result["suggestions"]) >= limit + 1:  # +1 for shop
                break

    except Exception:
        logger.exception("Autocomplete search failed for query: %s", query)

    return result

async def search_product_ids(query: str, limit: int = 20) -> list[int]:
    """
    Full search query with popularity boosting.
    Uses bool/should with phrase-prefix priority for Vietnamese accuracy.
    Returns a list of product IDs sorted by relevance.
    """
    es = get_es_client()
    try:
        resp = await es.search(
            index=INDEX_NAME,
            body={
                "size": limit,
                "query": {
                    "function_score": {
                        "query": {
                            "bool": {
                                "should": [
                                    {
                                        "match_phrase_prefix": {
                                            "name": {
                                                "query": query,
                                                "boost": 10,
                                                "max_expansions": 10,
                                            },
                                        },
                                    },
                                    {
                                        "combined_fields": {
                                            "query": query,
                                            "fields": ["name^3", "shop_name^2", "short_description"],
                                            "operator": "and",
                                        },
                                    },
                                    {
                                        "combined_fields": {
                                            "query": query,
                                            "fields": ["name^3", "shop_name^2", "short_description"],
                                            "operator": "or",
                                        },
                                    },
                                    {
                                        "multi_match": {
                                            "query": query,
                                            "fields": ["name^2", "short_description"],
                                            "fuzziness": "AUTO",
                                        },
                                    },
                                ],
                                "minimum_should_match": 1,
                            },
                        },
                        "functions": [
                            {
                                "field_value_factor": {
                                    "field": "sold_count",
                                    "modifier": "log1p",
                                    "missing": 0,
                                },
                            },
                            {
                                "field_value_factor": {
                                    "field": "average_rating",
                                    "modifier": "none",
                                    "factor": 0.5,
                                    "missing": 0,
                                },
                            },
                        ],
                        "score_mode": "sum",
                        "boost_mode": "multiply",
                    },
                },
                "_source": ["id"],
            },
        )
        hits = resp.get("hits", {}).get("hits", [])
        return [hit["_source"]["id"] for hit in hits]
    except Exception:
        logger.exception("Product search failed for query: %s", query)
        return []

