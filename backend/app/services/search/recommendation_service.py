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


async def get_suggestions_by_keywords(
    db: AsyncSession, keywords: List[str], limit: int = 48, page: int = 1
) -> Tuple[List[dict], int]:
    from ai.embeddings import generate_query_embedding
    import repositories.seller.seller_profile_repository as seller_profile_repo

    es = get_es_client()
    
    # 1. Allocation calculation
    num_kw = len(keywords)
    if num_kw == 0:
        hot_offset = (page - 1) * limit
        alloc_kw = []
    else:
        # Standard ratio for 48: 16 Hot, 32 Semantic
        ratio_hot = 16
        ratio_sem = limit - ratio_hot
        hot_offset = (page - 1) * ratio_hot
        
        base_alloc = ratio_sem // num_kw
        remainder = ratio_sem % num_kw
        alloc_kw = [base_alloc] * num_kw
        alloc_kw[0] += remainder # Give remainder to the most recent keyword

    # 2. Fetch Hot Products
    # Fetch top 50 hot shops
    featured_shops = await seller_profile_repo.get_featured_shops(db, limit=50)
    hot_shop_ids = [shop.id for shop in featured_shops]

    hot_body = {
        "query": {
            "function_score": {
                "query": {
                    "term": {"status": "ACTIVE"}
                },
                "functions": [
                    {
                        "field_value_factor": {
                            "field": "sold_count",
                            "modifier": "log1p",
                            "factor": 1.2
                        },
                        "weight": 3.0
                    },
                    {
                        "field_value_factor": {
                            "field": "average_rating",
                            "factor": 1.0
                        },
                        "weight": 1.5
                    }
                ],
                "score_mode": "sum",
                "boost_mode": "multiply"
            }
        },
        "from": hot_offset,
        "size": limit
    }
    
    # Add gauss decay for new products ONLY if seller_id is in hot_shop_ids
    if hot_shop_ids:
        hot_body["query"]["function_score"]["functions"].append({
            "filter": {
                "terms": {"seller_id": hot_shop_ids}
            },
            "gauss": {
                "created_at": {
                    "origin": "now",
                    "scale": "30d",
                    "offset": "7d",
                    "decay": 0.5
                }
            },
            "weight": 2.0
        })

    hot_hits = []
    try:
        res = await es.search(index=PRODUCT_INDEX_ALIAS, body=hot_body)
        hot_hits = [hit["_source"] for hit in res.get("hits", {}).get("hits", [])]
    except Exception as e:
        logger.error(f"Error fetching hot products for suggestions: {e}")

    # 3. Fetch Semantic Products
    sem_hits_list = []
    for i, kw in enumerate(keywords):
        kw_size = alloc_kw[i]
        kw_from = (page - 1) * kw_size
        
        try:
            kw_emb = await generate_query_embedding(kw)
            body = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "knn": {
                                    "field": "embedding",
                                    "query_vector": kw_emb,
                                    "num_candidates": 100
                                }
                            },
                            {"term": {"status": "ACTIVE"}}
                        ]
                    }
                },
                "from": kw_from,
                "size": kw_size,
                "_source": {"excludes": ["embedding"]}
            }
            res = await es.search(index=PRODUCT_INDEX_ALIAS, body=body)
            sem_hits_list.extend([hit["_source"] for hit in res.get("hits", {}).get("hits", [])])
        except Exception as e:
            logger.error(f"Error fetching semantic products for keyword {kw}: {e}")

    # 4. Mix and Deduplicate
    mixed_results = []
    seen_ids = set()
    
    sem_idx = 0
    hot_idx = 0
    
    while len(mixed_results) < limit and (sem_idx < len(sem_hits_list) or hot_idx < len(hot_hits)):
        target_sem = 6 if hot_idx >= len(hot_hits) else 4
        
        added_sem = 0
        while added_sem < target_sem and sem_idx < len(sem_hits_list) and len(mixed_results) < limit:
            item = sem_hits_list[sem_idx]
            sem_idx += 1
            if item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                mixed_results.append(item)
                added_sem += 1
                
        target_hot = 6 - added_sem
        added_hot = 0
        while added_hot < target_hot and hot_idx < len(hot_hits) and len(mixed_results) < limit:
            item = hot_hits[hot_idx]
            hot_idx += 1
            if item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                mixed_results.append(item)
                added_hot += 1
    
    return mixed_results, limit * 5 # arbitrary total for pagination to work
