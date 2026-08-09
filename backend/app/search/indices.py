import logging
from elasticsearch import AsyncElasticsearch
from search.config.analyzer import ANALYZER_CONFIG

logger = logging.getLogger(__name__)

# Bump when mapping / analyzer / document contract changes so startup recreates indices
SEARCH_INDEX_VERSION = "2"

PRODUCT_INDEX_ALIAS = "products_current"
PRODUCT_INDEX_V1 = "products_v1"

SHOP_INDEX_ALIAS = "shops_current"
SHOP_INDEX_V1 = "shops_v1"

COMMON_INDEX_SETTINGS = ANALYZER_CONFIG

PRODUCT_INDEX_MAPPING = {
    "_meta": {"search_index_version": SEARCH_INDEX_VERSION},
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
        "price": {"type": "double"},
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
    "_meta": {"search_index_version": SEARCH_INDEX_VERSION},
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


async def _get_index_version(es: AsyncElasticsearch, index_name: str) -> str | None:
    try:
        mapping = await es.indices.get_mapping(index=index_name)
        # Mapping response keys are concrete index names (not aliases)
        for _name, body in mapping.items():
            meta = body.get("mappings", {}).get("_meta", {})
            version = meta.get("search_index_version")
            if version is not None:
                return version
        return None
    except Exception:
        logger.exception("Failed to read index version for %s", index_name)
        return None


async def _delete_index_if_exists(es: AsyncElasticsearch, index_name: str) -> None:
    exists = await es.indices.exists(index=index_name)
    if exists:
        await es.indices.delete(index=index_name)
        logger.info("Deleted Elasticsearch index '%s'", index_name)


async def _is_concrete_index(es: AsyncElasticsearch, name: str) -> bool:
    """True when `name` is a real index (not an alias)."""
    name_exists = await es.indices.exists(index=name)
    if not name_exists:
        return False
    alias_exists = await es.indices.exists_alias(name=name)
    return not alias_exists


async def _ensure_alias_name_free(es: AsyncElasticsearch, alias_name: str) -> None:
    """
    Ensure `alias_name` can be used as an alias.
    Legacy setups sometimes created a concrete index with the alias name
    (e.g. products_current), which blocks put_alias.
    """
    if await _is_concrete_index(es, alias_name):
        logger.warning(
            "Name '%s' is a concrete index (expected alias). Deleting so alias can be created.",
            alias_name,
        )
        await _delete_index_if_exists(es, alias_name)


async def _remove_alias_completely(es: AsyncElasticsearch, alias_name: str) -> None:
    """Remove alias from all indices it points to (if it exists as an alias)."""
    alias_exists = await es.indices.exists_alias(name=alias_name)
    if not alias_exists:
        return
    try:
        alias_info = await es.indices.get_alias(name=alias_name)
        for aliased_index in alias_info.keys():
            await es.indices.delete_alias(index=aliased_index, name=alias_name)
            logger.info("Removed alias '%s' from index '%s'", alias_name, aliased_index)
    except Exception:
        logger.exception("Failed removing alias '%s'", alias_name)


async def _ensure_alias_points_to(
    es: AsyncElasticsearch, index_name: str, alias_name: str
) -> None:
    """Make sure alias_name points only at index_name."""
    await _ensure_alias_name_free(es, alias_name)

    if await es.indices.exists_alias(name=alias_name):
        alias_info = await es.indices.get_alias(name=alias_name)
        pointed = set(alias_info.keys())
        if pointed == {index_name}:
            return
        for aliased_index in pointed - {index_name}:
            await es.indices.delete_alias(index=aliased_index, name=alias_name)
        if index_name in pointed:
            return

    await es.indices.put_alias(index=index_name, name=alias_name)
    logger.info("Alias '%s' now points to '%s'", alias_name, index_name)


async def _setup_index_with_alias(
    es: AsyncElasticsearch,
    index_name: str,
    alias_name: str,
    settings: dict,
    mapping: dict,
) -> None:
    # Legacy: alias name occupied by a concrete index → remove it
    await _ensure_alias_name_free(es, alias_name)

    alias_exists = await es.indices.exists_alias(name=alias_name)
    index_exists = await es.indices.exists(index=index_name)

    if index_exists:
        current_version = await _get_index_version(es, index_name)
        if current_version == SEARCH_INDEX_VERSION:
            logger.info(
                "Index '%s' already at version %s — ensuring alias '%s'",
                index_name,
                SEARCH_INDEX_VERSION,
                alias_name,
            )
            await _ensure_alias_points_to(es, index_name, alias_name)
            return

        logger.info(
            "Index version mismatch for '%s' (have=%s want=%s) — recreating",
            index_name,
            current_version,
            SEARCH_INDEX_VERSION,
        )
        await _remove_alias_completely(es, alias_name)
        await _delete_index_if_exists(es, index_name)
    elif alias_exists:
        # Alias exists but physical index missing / renamed — clean and recreate
        logger.info(
            "Alias '%s' exists without expected index '%s' — recreating",
            alias_name,
            index_name,
        )
        try:
            alias_info = await es.indices.get_alias(name=alias_name)
            for aliased_index in list(alias_info.keys()):
                await es.indices.delete_alias(index=aliased_index, name=alias_name)
                await _delete_index_if_exists(es, aliased_index)
        except Exception:
            logger.exception("Failed cleaning stale alias '%s'", alias_name)

    # Ensure alias name is free again before create + put_alias
    await _ensure_alias_name_free(es, alias_name)

    logger.info("Creating index '%s' (version %s)...", index_name, SEARCH_INDEX_VERSION)
    await es.indices.create(
        index=index_name,
        settings=settings,
        mappings=mapping,
    )
    await es.indices.put_alias(index=index_name, name=alias_name)
    logger.info("Index '%s' created and aliased as '%s'", index_name, alias_name)


async def setup_indices(es: AsyncElasticsearch) -> None:
    """Create Elasticsearch indices with versioning and aliases."""
    await _setup_index_with_alias(
        es, PRODUCT_INDEX_V1, PRODUCT_INDEX_ALIAS, COMMON_INDEX_SETTINGS, PRODUCT_INDEX_MAPPING
    )
    await _setup_index_with_alias(
        es, SHOP_INDEX_V1, SHOP_INDEX_ALIAS, COMMON_INDEX_SETTINGS, SHOP_INDEX_MAPPING
    )
