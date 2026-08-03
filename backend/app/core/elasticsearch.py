from __future__ import annotations

import logging
import os
from elasticsearch import AsyncElasticsearch

logger = logging.getLogger(__name__)

_es_client: AsyncElasticsearch | None = None

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")


def get_es_client() -> AsyncElasticsearch:
    """Return a singleton AsyncElasticsearch client."""
    global _es_client
    if _es_client is None:
        _es_client = AsyncElasticsearch(
            hosts=[ELASTICSEARCH_URL],
            request_timeout=10,
        )
        logger.info("Elasticsearch client created: %s", ELASTICSEARCH_URL)
    return _es_client


async def close_es_client() -> None:
    """Close the Elasticsearch client connection."""
    global _es_client
    if _es_client is not None:
        await _es_client.close()
        _es_client = None
        logger.info("Elasticsearch client closed.")
