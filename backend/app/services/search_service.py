from __future__ import annotations

import logging
from elasticsearch.helpers import async_bulk
import time

from core.elasticsearch import get_es_client
from search.indices import PRODUCT_INDEX_ALIAS, SHOP_INDEX_ALIAS, setup_indices
from schemas.search import SearchRequest, SearchResponse, ProductSearchDocument, ShopSearchRequest, ShopSearchResponse, ShopSearchDocument
from search.pipeline.pipeline import SearchPipeline
from search.strategies import ProductSearchStrategy, ShopSearchStrategy

logger = logging.getLogger(__name__)

async def create_products_index() -> None:
    es = get_es_client()
    try:
        await setup_indices(es)
    except Exception:
        logger.exception("Failed to setup Elasticsearch indices")

async def recreate_products_index() -> None:
    es = get_es_client()
    try:
        from search.indices import PRODUCT_INDEX_V1, SHOP_INDEX_V1
        exists_p = await es.indices.exists(index=PRODUCT_INDEX_V1)
        if exists_p:
            await es.indices.delete(index=PRODUCT_INDEX_V1)
            logger.info(f"Deleted old Elasticsearch index: {PRODUCT_INDEX_V1}")
            
        exists_s = await es.indices.exists(index=SHOP_INDEX_V1)
        if exists_s:
            await es.indices.delete(index=SHOP_INDEX_V1)
            logger.info(f"Deleted old Elasticsearch index: {SHOP_INDEX_V1}")
            
        await setup_indices(es)
    except Exception:
        logger.exception("Failed to recreate Elasticsearch indices")

async def index_product(product_data: dict) -> None:
    es = get_es_client()
    try:
        await es.index(
            index=PRODUCT_INDEX_ALIAS,
            id=str(product_data["id"]),
            document=product_data,
        )
    except Exception:
        logger.exception("Failed to index product %s", product_data.get("id"))

async def delete_product_from_index(product_id: int) -> None:
    es = get_es_client()
    try:
        await es.delete(index=PRODUCT_INDEX_ALIAS, id=str(product_id), ignore=[404])
    except Exception:
        logger.exception("Failed to delete product %s from index", product_id)

async def bulk_index_products(products: list[dict]) -> None:
    if not products:
        return
    es = get_es_client()
    actions = [
        {
            "_index": PRODUCT_INDEX_ALIAS,
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
    es = get_es_client()
    result: dict = {"suggestions": []}

    try:
        pipeline = SearchPipeline()
        processed_query = pipeline.process_query(query)
        if not processed_query:
            return result

        shop_resp = await es.search(
            index=SHOP_INDEX_ALIAS,
            body={
                "size": 1,
                "query": {
                    "match_phrase_prefix": {
                        "shop_name": {
                            "query": processed_query,
                            "max_expansions": 10,
                        },
                    },
                },
                "_source": ["shop_name", "shop_slug"],
            },
            request_timeout=2.0
        )
        shop_hits = shop_resp.get("hits", {}).get("hits", [])
        if shop_hits:
            shop = shop_hits[0]["_source"]
            result["suggestions"].append({
                "keyword": f'Tìm Shop "{query}"',
                "type": "shop",
                "shop_slug": shop.get("shop_slug"),
            })

        product_resp = await es.search(
            index=PRODUCT_INDEX_ALIAS,
            body={
                "size": limit * 3,
                "query": {
                    "bool": {
                        "should": [
                            {"match_phrase_prefix": {"name.suggest": {"query": processed_query, "boost": 10, "max_expansions": 10}}},
                            {"match": {"name": {"query": processed_query, "boost": 3}}},
                        ]
                    }
                },
                "_source": ["name"],
            },
            request_timeout=2.0
        )

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
            if len(result["suggestions"]) >= limit + 1:
                break

    except Exception:
        logger.exception("Autocomplete search failed for query: %s", query)

    return result

def _log_search_metrics(operation: str, req: Any, start_time: float, total_hits: int, error: Exception = None):
    execution_time = (time.time() - start_time) * 1000
    log_data = {
        "operation": operation,
        "latency_ms": round(execution_time, 2),
        "total_hits": total_hits,
        "filters": req.dict(exclude_none=True),
    }
    if error:
        log_data["error"] = str(error)
        logger.error(f"[SEARCH_LOG] {log_data}")
    else:
        logger.info(f"[SEARCH_LOG] {log_data}")

async def search_products(req: SearchRequest) -> SearchResponse:
    start_time = time.time()
    es = get_es_client()
    
    # 1. Pipeline
    pipeline = SearchPipeline()
    processed_query = pipeline.process_query(req.q) if req.q else ""
    
    # 2. Strategy
    strategy = ProductSearchStrategy()
    filters = req.dict(exclude_none=True)
    # Remove pagination/sort from filters dict
    filters.pop("q", None)
    filters.pop("page", None)
    filters.pop("limit", None)
    filters.pop("sort", None)
    
    final_query = strategy.build_query(
        processed_query=processed_query, 
        filters=filters, 
        page=req.page, 
        size=req.limit, 
        sort_by=req.sort
    )

    try:
        resp = await es.search(
            index=PRODUCT_INDEX_ALIAS,
            body=final_query,
            request_timeout=3.0
        )
        hits = resp.get("hits", {}).get("hits", [])
        total = resp.get("hits", {}).get("total", {}).get("value", 0)
        aggs = resp.get("aggregations", {})
        
        items = [ProductSearchDocument(**hit["_source"]) for hit in hits]
        
        _log_search_metrics("search_products", req, start_time, total)
        return SearchResponse(
            total=total,
            page=req.page,
            limit=req.limit,
            items=items,
            aggregations=aggs
        )
    except Exception as e:
        _log_search_metrics("search_products", req, start_time, 0, e)
        return SearchResponse(total=0, page=req.page, limit=req.limit, items=[], aggregations={})

async def search_shops(req: ShopSearchRequest) -> ShopSearchResponse:
    start_time = time.time()
    es = get_es_client()
    
    pipeline = SearchPipeline()
    processed_query = pipeline.process_query(req.q) if req.q else ""
    
    strategy = ShopSearchStrategy()
    filters = req.dict(exclude_none=True)
    filters.pop("q", None)
    filters.pop("page", None)
    filters.pop("limit", None)
    filters.pop("sort", None)
    
    final_query = strategy.build_query(
        processed_query=processed_query, 
        filters=filters, 
        page=req.page, 
        size=req.limit, 
        sort_by=req.sort
    )

    try:
        resp = await es.search(
            index=SHOP_INDEX_ALIAS,
            body=final_query,
            request_timeout=3.0
        )
        hits = resp.get("hits", {}).get("hits", [])
        total = resp.get("hits", {}).get("total", {}).get("value", 0)
        
        items = [ShopSearchDocument(**hit["_source"]) for hit in hits]
        
        _log_search_metrics("search_shops", req, start_time, total)
        return ShopSearchResponse(
            total=total,
            page=req.page,
            limit=req.limit,
            items=items
        )
    except Exception as e:
        _log_search_metrics("search_shops", req, start_time, 0, e)
        return ShopSearchResponse(total=0, page=req.page, limit=req.limit, items=[])
