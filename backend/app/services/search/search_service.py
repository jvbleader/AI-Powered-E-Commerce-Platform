from __future__ import annotations

import logging
from typing import Any
from elasticsearch.helpers import async_bulk
import time

from core.elasticsearch import get_es_client
from search.indices import PRODUCT_INDEX_ALIAS, SHOP_INDEX_ALIAS, setup_indices
from schemas.search.search_schema import (
    SearchRequest,
    SearchResponse,
    ProductSearchDocument,
    ShopSearchRequest,
    ShopSearchResponse,
    ShopSearchDocument,
)
from search.pipeline.pipeline import SearchPipeline
from search.strategies import ProductSearchStrategy, ShopSearchStrategy
from ai.embeddings import generate_product_embedding

logger = logging.getLogger(__name__)


class SearchBackendError(Exception):
    """Raised when Elasticsearch is unavailable or the search call fails."""

    def __init__(self, message: str, cause: Exception | None = None):
        super().__init__(message)
        self.cause = cause


async def create_products_index() -> None:
    es = get_es_client()
    try:
        await setup_indices(es)
    except Exception:
        logger.exception("Failed to setup Elasticsearch indices")
        raise


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
        raise


async def index_product(product_data: dict) -> None:
    es = get_es_client()
    try:
        if "embedding" not in product_data:
            product_data["embedding"] = await generate_product_embedding(product_data)
            
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
    
    products_missing_embeddings = [p for p in products if "embedding" not in p]
    if products_missing_embeddings:
        # Fetch existing embeddings from ES
        ids_to_fetch = [str(p["id"]) for p in products_missing_embeddings]
        try:
            res = await es.mget(index=PRODUCT_INDEX_ALIAS, body={"ids": ids_to_fetch}, _source=["embedding"], ignore=[404, 400])
            existing_embs = {}
            if "docs" in res:
                for doc in res["docs"]:
                    if doc.get("found") and "embedding" in doc.get("_source", {}):
                        existing_embs[doc["_id"]] = doc["_source"]["embedding"]
            
            for p in products_missing_embeddings:
                p_id = str(p["id"])
                if p_id in existing_embs:
                    p["embedding"] = existing_embs[p_id]
                else:
                    p["embedding"] = await generate_product_embedding(p)
        except Exception as e:
            logger.warning(f"Failed to fetch existing embeddings: {e}")
            for p in products_missing_embeddings:
                try:
                    p["embedding"] = await generate_product_embedding(p)
                except Exception:
                    pass

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


async def bulk_index_shops(shops: list[dict]) -> None:
    if not shops:
        return
    es = get_es_client()
    actions = [
        {
            "_index": SHOP_INDEX_ALIAS,
            "_id": str(s["id"]),
            "_source": s,
        }
        for s in shops
    ]
    try:
        success, errors = await async_bulk(es, actions, raise_on_error=False)
        logger.info("Bulk indexed %d shops, %d errors", success, len(errors))
    except Exception:
        logger.exception("Failed to bulk index shops")


async def search_autocomplete(query: str, limit: int = 8) -> dict:
    """
    Shopee-style autocomplete:
    - First row is always "Tìm Shop \"{query}\"" (shop search action)
    - Following rows are product/keyword suggestions
    """
    es = get_es_client()
    raw_query = (query or "").strip()
    result: dict = {"suggestions": []}

    if not raw_query:
        return result

    # Always surface shop-search action as the first row (like Shopee)
    result["suggestions"].append({
        "keyword": f'Tìm Shop "{raw_query}"',
        "type": "shop",
        "shop_slug": None,
    })

    try:
        pipeline = SearchPipeline()
        processed_query = pipeline.process_query(raw_query)
        if not processed_query:
            return result

        # Optional: attach best-matching shop slug for direct navigation
        try:
            shop_resp = await es.search(
                index=SHOP_INDEX_ALIAS,
                body={
                    "size": 1,
                    "query": {
                        "bool": {
                            "should": [
                                {
                                    "match_phrase_prefix": {
                                        "shop_name": {
                                            "query": processed_query,
                                            "max_expansions": 10,
                                            "boost": 5,
                                        },
                                    }
                                },
                                {
                                    "match": {
                                        "shop_name": {
                                            "query": processed_query,
                                            "boost": 2,
                                        }
                                    }
                                },
                            ],
                            "filter": [{"term": {"status": "APPROVED"}}],
                            "minimum_should_match": 1,
                        }
                    },
                    "_source": ["shop_name", "shop_slug"],
                },
                request_timeout=2.0,
            )
            shop_hits = shop_resp.get("hits", {}).get("hits", [])
            if shop_hits:
                result["suggestions"][0]["shop_slug"] = shop_hits[0]["_source"].get("shop_slug")
        except Exception:
            logger.exception("Autocomplete shop lookup failed for query: %s", raw_query)

        product_resp = await es.search(
            index=PRODUCT_INDEX_ALIAS,
            body={
                "size": limit * 3,
                "query": {
                    "bool": {
                        "should": [
                            {
                                "match_phrase_prefix": {
                                    "name.suggest": {
                                        "query": processed_query,
                                        "boost": 12,
                                        "max_expansions": 10,
                                    }
                                }
                            },
                            {
                                "match_phrase_prefix": {
                                    "name": {
                                        "query": processed_query,
                                        "boost": 8,
                                        "max_expansions": 10,
                                    }
                                }
                            },
                            {"match": {"name": {"query": processed_query, "boost": 3}}},
                            {"match": {"brand_name": {"query": processed_query, "boost": 2}}},
                        ],
                        "filter": [{"term": {"status": "ACTIVE"}}],
                        "minimum_should_match": 1,
                    }
                },
                "_source": ["name"],
            },
            request_timeout=2.0,
        )

        seen: set[str] = set()
        prefix = processed_query.lower()
        product_hits = product_resp.get("hits", {}).get("hits", [])

        def _rank_key(hit: dict) -> tuple:
            name = (hit.get("_source") or {}).get("name", "").strip().lower()
            starts = 0 if name.startswith(prefix) else 1
            return (starts, -float(hit.get("_score") or 0), name)

        for hit in sorted(product_hits, key=_rank_key):
            name = hit["_source"].get("name", "").strip()
            name_lower = name.lower()
            if name_lower and name_lower not in seen:
                seen.add(name_lower)
                result["suggestions"].append({
                    "keyword": name,
                    "type": "keyword",
                    "shop_slug": None,
                })
            # +1 accounts for the leading shop-search row
            if len(result["suggestions"]) >= limit + 1:
                break

    except Exception:
        logger.exception("Autocomplete search failed for query: %s", raw_query)

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

    pipeline = SearchPipeline()
    processed_query = pipeline.process_query(req.q) if req.q else ""

    strategy = ProductSearchStrategy()
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
        sort_by=req.sort or "relevance",
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
        raise SearchBackendError("Elasticsearch product search failed", cause=e) from e


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
        sort_by=req.sort or "relevance",
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
        raise SearchBackendError("Elasticsearch shop search failed", cause=e) from e
