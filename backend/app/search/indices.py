import logging
from elasticsearch import AsyncElasticsearch
from search.config.analyzer import ANALYZER_CONFIG

logger = logging.getLogger(__name__)

PRODUCT_INDEX_ALIAS = "products_current"
PRODUCT_INDEX_V1 = "products_v1"

SHOP_INDEX_ALIAS = "shops_current"
SHOP_INDEX_V1 = "shops_v1"

COMMON_INDEX_SETTINGS = ANALYZER_CONFIG

PRODUCT_INDEX_MAPPING = {
    "dynamic": "strict",
    "properties": {
        "id": {"type": "keyword"},
        "public_id": {"type": "keyword"},
        "slug": {"type": "keyword"},
        "name": {
            "type": "text",
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 256},
                "suggest": {"type": "search_as_you_type"}
            }
        },
        "short_description": {
            "type": "text", 
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer"
        },
        "description": {
            "type": "text", 
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer"
        },
        "brand_name": {
            "type": "text",
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 256}
            }
        },
        "category_ids": {"type": "keyword"},
        "category_names": {
            "type": "text", 
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 256}
            }
        },
        "category_slugs": {"type": "keyword"},
        "seller_id": {"type": "keyword"},
        "shop_name": {
            "type": "text", 
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 256}
            }
        },
        "shop_slug": {"type": "keyword"},
        "pickup_address": {
            "type": "text",
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 256}
            }
        },
        "price": {"type": "double"}, # Make sure price is there for price_ranges. (Previously min_price/max_price, let's keep price or use min_price for aggregation. I will add min_price and max_price back).
        "min_price": {"type": "double"},
        "max_price": {"type": "double"},
        "total_stock": {"type": "integer"},
        "in_stock": {"type": "boolean"},
        "average_rating": {"type": "double"},
        "review_count": {"type": "integer"},
        "sold_count": {"type": "integer"},
        "status": {"type": "keyword"},
        "created_at": {"type": "date"},
        "thumbnail": {"type": "keyword", "index": False}
    }
}

SHOP_INDEX_MAPPING = {
    "dynamic": "strict",
    "properties": {
        "id": {"type": "keyword"},
        "public_id": {"type": "keyword"},
        "shop_name": {
            "type": "text",
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer",
            "fields": {
                "keyword": {"type": "keyword", "ignore_above": 256},
                "suggest": {"type": "search_as_you_type"}
            }
        },
        "shop_slug": {"type": "keyword"},
        "shop_description": {
            "type": "text", 
            "analyzer": "vi_index_analyzer",
            "search_analyzer": "vi_search_analyzer"
        },
        "total_sold": {"type": "integer"},
        "average_rating": {"type": "double"},
        "review_count": {"type": "integer"},
        "product_count": {"type": "integer"},
        "status": {"type": "keyword"},
        "created_at": {"type": "date"},
        "shop_logo_url": {"type": "keyword", "index": False}
    }
}

async def _setup_index_with_alias(es: AsyncElasticsearch, index_name: str, alias_name: str, settings: dict, mapping: dict) -> None:
    # Check if alias exists
    alias_exists = await es.indices.exists_alias(name=alias_name)
    if alias_exists:
        logger.info(f"Alias '{alias_name}' already exists.")
        return
        
    # Check if index exists
    index_exists = await es.indices.exists(index=index_name)
    if not index_exists:
        logger.info(f"Creating index '{index_name}'...")
        await es.indices.create(
            index=index_name,
            settings=settings,
            mappings=mapping,
        )
        logger.info(f"Index '{index_name}' created successfully.")
    
    # Assign alias
    logger.info(f"Putting alias '{alias_name}' to '{index_name}'...")
    await es.indices.put_alias(index=index_name, name=alias_name)

async def setup_indices(es: AsyncElasticsearch) -> None:
    """Create Elasticsearch indices with versioning and aliases."""
    await _setup_index_with_alias(es, PRODUCT_INDEX_V1, PRODUCT_INDEX_ALIAS, COMMON_INDEX_SETTINGS, PRODUCT_INDEX_MAPPING)
    await _setup_index_with_alias(es, SHOP_INDEX_V1, SHOP_INDEX_ALIAS, COMMON_INDEX_SETTINGS, SHOP_INDEX_MAPPING)
