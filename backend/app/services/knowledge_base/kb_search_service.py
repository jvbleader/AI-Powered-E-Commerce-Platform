from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from elasticsearch import AsyncElasticsearch

from ai.embeddings import generate_query_embedding
from core.elasticsearch import get_es_client
from search.indices_kb import KB_INDEX_ALIAS

logger = logging.getLogger(__name__)


import re


def _clean_chunk_text(text: str, max_chars: int = 800) -> str:
    """Removes metadata headers like '[Title - Trang X]' and returns the pure chunk text."""
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^\[.*?\]\s*", "", cleaned).strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars].rstrip() + "..."


_build_excerpt = _clean_chunk_text


async def search_knowledge_base(
    query: str,
    category: Optional[str] = None,
    limit: int = 4,
    es: Optional[AsyncElasticsearch] = None,
) -> Dict[str, Any]:
    """Execute hybrid (lexical + kNN dense vector) search on knowledge base articles.

    Args:
        query: User search query string.
        category: Optional category filter (e.g. RETURN_REFUND, SHIPPING, etc.).
        limit: Maximum number of chunks to return (defaults to 4).
        es: Optional AsyncElasticsearch client instance (defaults to get_es_client()).

    Returns:
        Dict containing:
            - 'chunks': List of matching chunk dictionaries with relevance score.
            - 'citations': Deduplicated list of source article citations with excerpts.
    """
    clean_query = (query or "").strip()
    if not clean_query:
        return {"chunks": [], "citations": []}

    try:
        # 1. Generate query embedding vector with graceful fallback
        query_vector: Optional[List[float]] = None
        try:
            vector = await generate_query_embedding(clean_query)
            if isinstance(vector, list) and len(vector) == 1024:
                query_vector = vector
            else:
                logger.warning(
                    "Query embedding returned invalid dimension or empty vector for '%s', fallback to lexical search",
                    clean_query,
                )
        except Exception as emb_err:
            logger.warning(
                "Embedding generation failed for query '%s', fallback to lexical search: %s",
                clean_query,
                emb_err,
            )

        # 2. Build filters for boolean query and kNN
        filter_clauses: List[Dict[str, Any]] = [
            {"term": {"is_published": True}}
        ]
        if category and category.strip():
            filter_clauses.append({"term": {"category": category.strip()}})

        should_clauses: List[Dict[str, Any]] = [
            {
                "multi_match": {
                    "query": clean_query,
                    "fields": [
                        "article_title^3",
                        "section_title^2",
                        "chunk_text",
                    ],
                    "boost": 1.0,
                }
            }
        ]

        bool_query: Dict[str, Any] = {
            "filter": filter_clauses,
            "should": should_clauses,
        }
        # When embedding is unavailable (pure lexical fallback), require at least 1 keyword match in should
        if not query_vector:
            bool_query["minimum_should_match"] = 1

        search_body: Dict[str, Any] = {
            "size": max(1, limit),
            "query": {
                "bool": bool_query,
            },
            "_source": [
                "chunk_id",
                "article_id",
                "article_public_id",
                "article_title",
                "section_title",
                "slug",
                "category",
                "page_number",
                "file_url",
                "chunk_text",
            ],
        }

        # 3. Attach kNN clause if valid dense embedding is available
        if query_vector:
            knn_filter: List[Dict[str, Any]] = [
                {"term": {"is_published": True}}
            ]
            if category and category.strip():
                knn_filter.append({"term": {"category": category.strip()}})

            search_body["knn"] = {
                "field": "chunk_vector",
                "query_vector": query_vector,
                "k": max(1, limit),
                "num_candidates": max(1, limit) * 5,
                "boost": 1.5,
                "filter": knn_filter,
            }

        # 4. Execute Elasticsearch search
        client = es or get_es_client()
        response = await client.search(
            index=KB_INDEX_ALIAS,
            body=search_body,
        )

        # 5. Extract chunks and build deduplicated citations
        raw_hits = response.get("hits", {}).get("hits", [])
        # Only retain hits with a positive relevance score
        hits = [h for h in raw_hits if float(h.get("_score") or 0.0) > 0.0]
        chunks: List[Dict[str, Any]] = []
        citations: List[Dict[str, Any]] = []
        seen_citations = set()

        for hit in hits:
            source = hit.get("_source") or {}
            chunk_id = str(source.get("chunk_id") or hit.get("_id", ""))
            article_id = str(source.get("article_id", ""))
            article_public_id = str(source.get("article_public_id", ""))
            article_title = source.get("article_title", "")
            section_title = source.get("section_title", "")
            slug = source.get("slug", "")
            cat = source.get("category", "")
            page_number = int(source.get("page_number") or 1)
            file_url = str(source.get("file_url") or "")
            chunk_text = source.get("chunk_text", "")
            score = float(hit.get("_score") or 0.0)

            chunks.append({
                "chunk_id": chunk_id,
                "article_id": article_id,
                "article_public_id": article_public_id,
                "article_title": article_title,
                "section_title": section_title,
                "slug": slug,
                "category": cat,
                "page_number": page_number,
                "file_url": file_url,
                "chunk_text": chunk_text,
                "score": score,
            })

            dedup_key = (article_id or article_public_id, section_title, page_number)
            if dedup_key not in seen_citations:
                seen_citations.add(dedup_key)
                citations.append({
                    "article_id": article_id,
                    "article_public_id": article_public_id,
                    "title": article_title,
                    "section_title": section_title,
                    "slug": slug,
                    "category": cat,
                    "page_number": page_number,
                    "file_url": file_url,
                    "excerpt": _clean_chunk_text(chunk_text),
                })

        return {
            "chunks": chunks,
            "citations": citations,
        }

    except Exception:
        logger.exception("Error searching knowledge base for query: %s", query)
        return {"chunks": [], "citations": []}
