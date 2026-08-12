import logging
from typing import List, Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.elasticsearch import get_es_client
from search.indices import PRODUCT_INDEX_ALIAS
from models.catalog import Product

logger = logging.getLogger(__name__)

async def get_similar_products(
    db: AsyncSession,
    product: Product,
    limit: int = 10,
    page: int = 1
) -> Tuple[List[dict], int]:
    """
    Get similar products using kNN semantic search on the embedding of the current product.
    This acts as 'You may also like' recommendation.
    We prioritize products from the same category as a secondary boost, but mainly rely on semantic similarity.
    """
    es = get_es_client()
    
    # 1. Fetch the source product document from ES to get its embedding
    try:
        source_doc = await es.get(index=PRODUCT_INDEX_ALIAS, id=str(product.id))
        source_embedding = source_doc["_source"].get("embedding")
    except Exception as e:
        logger.error(f"Failed to get source document {product.id} from ES: {e}")
        return [], 0
        
    if not source_embedding:
        logger.warning(f"Product {product.id} has no embedding. Falling back to category search.")
        return await fallback_category_search(product, limit)

    # 2. kNN query against other products
    body = {
        "knn": {
            "field": "embedding",
            "query_vector": source_embedding,
            "k": 200, # Fixed number to support stable deep pagination up to 152 items
            "num_candidates": 300,
            "filter": {
                "bool": {
                    "must_not": [
                        {"term": {"id": product.id}} # exclude self
                    ],
                    "must": [
                        {"term": {"status": "ACTIVE"}}
                    ]
                }
            }
        },
        "_source": {
            "excludes": ["embedding"] # exclude embedding from response to save bandwidth
        },
        "from": (page - 1) * limit,
        "size": limit
    }
    
    try:
        res = await es.search(index=PRODUCT_INDEX_ALIAS, body=body)
        hits = res.get("hits", {}).get("hits", [])
        total = res.get("hits", {}).get("total", {}).get("value", 0)
        
        products = []
        for hit in hits:
            # We add a dummy score field if frontend needs it, though it's optional
            src = hit["_source"]
            src["_score"] = hit["_score"]
            products.append(src)
            
        return products, total
    except Exception as e:
        logger.error(f"kNN search failed: {e}")
        return [], 0


async def get_shop_similar_products(
    db: AsyncSession,
    product: Product,
    limit: int = 6,
    page: int = 1
) -> Tuple[List[dict], int]:
    """
    Get similar products from the SAME SHOP using kNN semantic search.
    This acts as 'Other products from this shop'.
    """
    es = get_es_client()
    
    # Fetch source product embedding
    try:
        source_doc = await es.get(index=PRODUCT_INDEX_ALIAS, id=str(product.id))
        source_embedding = source_doc["_source"].get("embedding")
    except Exception:
        source_embedding = None
        
    # If no embedding, fallback to simple bool query by seller_id
    if not source_embedding:
        body = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"seller_id": product.seller_id}},
                        {"term": {"status": "ACTIVE"}}
                    ],
                    "must_not": [
                        {"term": {"id": product.id}}
                    ]
                }
            },
            "from": (page - 1) * limit,
            "size": limit,
            "sort": [{"created_at": {"order": "desc"}}]
        }
    else:
        # Use kNN restricted to this shop
        body = {
            "knn": {
                "field": "embedding",
                "query_vector": source_embedding,
                "k": limit * 2 if limit < 50 else limit,
                "num_candidates": 100,
                "filter": {
                    "bool": {
                        "must": [
                            {"term": {"seller_id": product.seller_id}},
                            {"term": {"status": "ACTIVE"}}
                        ],
                        "must_not": [
                            {"term": {"id": product.id}}
                        ]
                    }
                }
            },
            "_source": {
                "excludes": ["embedding"]
            },
            "from": (page - 1) * limit,
            "size": limit
        }
        
    try:
        res = await es.search(index=PRODUCT_INDEX_ALIAS, body=body)
        hits = res.get("hits", {}).get("hits", [])
        total = res.get("hits", {}).get("total", {}).get("value", 0)
        
        products = [hit["_source"] for hit in hits]
        return products, total
    except Exception as e:
        logger.error(f"Shop kNN search failed: {e}")
        return [], 0


async def fallback_category_search(product: Product, limit: int) -> Tuple[List[dict], int]:
    es = get_es_client()
    
    # Simple fallback: get products from same categories
    category_ids = [cat.id for cat in product.categories]
    if not category_ids:
        return [], 0
        
    body = {
        "query": {
            "bool": {
                "must": [
                    {"terms": {"categories.id": category_ids}},
                    {"term": {"status": "ACTIVE"}}
                ],
                "must_not": [
                    {"term": {"id": product.id}}
                ]
            }
        },
        "size": limit,
        "sort": [{"sold_count": {"order": "desc"}}] # Recommend popular items
    }
    try:
        res = await es.search(index=PRODUCT_INDEX_ALIAS, body=body)
        hits = res.get("hits", {}).get("hits", [])
        return [hit["_source"] for hit in hits], len(hits)
    except Exception:
        return [], 0
