from __future__ import annotations

import logging
from typing import Any, Dict
from elasticsearch import AsyncElasticsearch

logger = logging.getLogger(__name__)

KB_INDEX_V1 = "knowledge_base_chunks_v1"
KB_INDEX_ALIAS = "knowledge_base_chunks"

KB_INDEX_SETTINGS: Dict[str, Any] = {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
        "char_filter": {
            "html_strip": {
                "type": "html_strip",
            },
            "vi_char_filter": {
                "type": "mapping",
                "mappings": [
                    "đ => d",
                    "Đ => d",
                ],
            },
        },
        "analyzer": {
            "vi_text_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "char_filter": ["html_strip", "vi_char_filter"],
                "filter": ["lowercase", "asciifolding"],
            },
        },
    },
}

KB_INDEX_MAPPING: Dict[str, Any] = {
    "properties": {
        "chunk_id": {"type": "keyword"},
        "article_id": {"type": "keyword"},
        "article_public_id": {"type": "keyword"},
        "article_title": {
            "type": "text",
            "analyzer": "vi_text_analyzer",
            "fields": {
                "keyword": {"type": "keyword"},
            },
        },
        "section_title": {
            "type": "text",
            "analyzer": "vi_text_analyzer",
            "fields": {
                "keyword": {"type": "keyword"},
            },
        },
        "category": {"type": "keyword"},
        "slug": {"type": "keyword"},
        "page_number": {"type": "integer"},
        "file_url": {"type": "keyword"},
        "chunk_text": {
            "type": "text",
            "analyzer": "vi_text_analyzer",
        },
        "chunk_vector": {
            "type": "dense_vector",
            "dims": 1024,
            "index": True,
            "similarity": "cosine",
        },
        "is_published": {"type": "boolean"},
        "updated_at": {"type": "date"},
    },
}


async def setup_kb_index(es: AsyncElasticsearch) -> None:
    """Checks if KB index exists, creates with settings, mappings and alias if missing."""
    try:
        index_exists = await es.indices.exists(index=KB_INDEX_V1)
        alias_exists = await es.indices.exists_alias(name=KB_INDEX_ALIAS)

        if not index_exists:
            if alias_exists:
                try:
                    alias_info = await es.indices.get_alias(name=KB_INDEX_ALIAS)
                    for aliased_index in list(alias_info.keys()):
                        await es.indices.delete_alias(index=aliased_index, name=KB_INDEX_ALIAS)
                        logger.info("Removed stale alias '%s' from '%s'", KB_INDEX_ALIAS, aliased_index)
                except Exception:
                    logger.exception("Failed cleaning stale alias '%s'", KB_INDEX_ALIAS)

            logger.info("Creating Elasticsearch index '%s'...", KB_INDEX_V1)
            await es.indices.create(
                index=KB_INDEX_V1,
                settings=KB_INDEX_SETTINGS,
                mappings=KB_INDEX_MAPPING,
            )
            await es.indices.put_alias(index=KB_INDEX_V1, name=KB_INDEX_ALIAS)
            logger.info("Created KB index '%s' with alias '%s'", KB_INDEX_V1, KB_INDEX_ALIAS)
        else:
            if not alias_exists:
                await es.indices.put_alias(index=KB_INDEX_V1, name=KB_INDEX_ALIAS)
                logger.info("Created alias '%s' pointing to '%s'", KB_INDEX_ALIAS, KB_INDEX_V1)
            else:
                alias_info = await es.indices.get_alias(name=KB_INDEX_ALIAS)
                pointed = set(alias_info.keys())
                if pointed != {KB_INDEX_V1}:
                    for aliased_index in pointed - {KB_INDEX_V1}:
                        await es.indices.delete_alias(index=aliased_index, name=KB_INDEX_ALIAS)
                    if KB_INDEX_V1 not in pointed:
                        await es.indices.put_alias(index=KB_INDEX_V1, name=KB_INDEX_ALIAS)
                    logger.info("Updated alias '%s' to point exclusively to '%s'", KB_INDEX_ALIAS, KB_INDEX_V1)
    except Exception:
        logger.exception("Failed to setup Elasticsearch index '%s'", KB_INDEX_V1)
        raise
