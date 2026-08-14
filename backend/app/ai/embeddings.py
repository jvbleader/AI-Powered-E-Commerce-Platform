import json
import logging
import os
from pathlib import Path
from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings

from ai.ai_config import ai_settings

logger = logging.getLogger(__name__)

# Initialize the embedding model
_embeddings = None
_vector_cache: Dict[str, List[float]] | None = None


def get_vector_cache() -> Dict[str, List[float]]:
    """
    Loads pre-computed product embeddings from vector_cache.jsonl if available.
    """
    global _vector_cache
    if _vector_cache is None:
        _vector_cache = {}
        env_path = os.getenv("VECTOR_CACHE_FILE")
        candidate_paths = []
        if env_path:
            candidate_paths.append(Path(env_path))
        candidate_paths.extend([
            Path("/app/vector_cache.jsonl"),
            Path("/app/seed/vector_cache.jsonl"),
            Path(__file__).resolve().parents[3] / "database" / "seed" / "vector_cache.jsonl",
            Path.cwd() / "database" / "seed" / "vector_cache.jsonl",
            Path.cwd().parent / "database" / "seed" / "vector_cache.jsonl",
            Path.cwd() / "vector_cache.jsonl",
        ])

        for path in candidate_paths:
            if path.is_file():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line:
                                item = json.loads(line)
                                if "id" in item and "embedding" in item:
                                    _vector_cache[str(item["id"])] = item["embedding"]
                    logger.info("Loaded %d product embeddings from cache file: %s", len(_vector_cache), path)
                    break
                except Exception as e:
                    logger.warning("Failed to load vector cache from %s: %s", path, e)
    return _vector_cache


def get_embeddings_model() -> OpenAIEmbeddings:
    global _embeddings
    if _embeddings is None:
        try:
            _embeddings = OpenAIEmbeddings(
                openai_api_key=ai_settings.EMBEDDING_API_KEY,
                openai_api_base=ai_settings.EMBEDDING_BASE_URL,
                model=ai_settings.EMBEDDING_MODEL,
                dimensions=1024, # Jina v5-omni-small is 1024
                check_embedding_ctx_length=False # Required for non-OpenAI endpoints like Jina
            )
        except Exception as e:
            logger.error(f"Failed to initialize OpenAIEmbeddings: {e}")
            raise
    return _embeddings

async def generate_product_embedding(product_data: Dict[str, Any]) -> List[float]:
    """
    Generates a 1024-dimensional embedding vector for a product.
    First checks local vector cache before calling remote AI API.
    """
    prod_id = str(product_data.get("id") or "")
    if prod_id:
        cache = get_vector_cache()
        if prod_id in cache:
            return cache[prod_id]

    try:
        model = get_embeddings_model()
        
        name = product_data.get("name", "")
        brand = product_data.get("brand_name", "")
        
        # categories can be a list of names or a string
        categories = product_data.get("category_names", [])
        if isinstance(categories, list):
            categories = " ".join(categories)
            
        short_desc = product_data.get("short_description", "")
        
        # Construct the text to embed
        parts = []
        if name: parts.append(f"Tên sản phẩm: {name}")
        if brand: parts.append(f"Thương hiệu: {brand}")
        if categories: parts.append(f"Danh mục: {categories}")
        if short_desc: parts.append(f"Mô tả ngắn: {short_desc}")
        
        text_to_embed = " | ".join(parts)
        
        if not text_to_embed.strip():
            # Fallback if product has almost no data
            text_to_embed = "Sản phẩm không có thông tin"
            
        # aembed_query is async
        vector = await model.aembed_query(text_to_embed)
        return vector
    except Exception as e:
        logger.error(f"Error generating embedding for product {product_data.get('id')}: {e}")
        raise

_query_memory_cache: Dict[str, List[float]] = {}
QUERY_CACHE_TTL_SECONDS = 7 * 24 * 3600  # 7 days


async def generate_query_embedding(query: str) -> List[float]:
    """
    Generates an embedding vector for a search query.
    Uses multi-tier caching (L1 In-Memory -> L2 Redis -> AI Embedding API).
    """
    normalized_query = (query or "").strip().lower()
    if not normalized_query:
        return []

    # 1. Check L1 Memory Cache (0ms)
    if normalized_query in _query_memory_cache:
        return _query_memory_cache[normalized_query]

    # 2. Check L2 Redis Cache
    import hashlib
    redis_key = f"query_emb:{hashlib.sha256(normalized_query.encode('utf-8')).hexdigest()}"
    try:
        from core.redis import get_redis_client
        redis_client = await get_redis_client()
        cached_json = await redis_client.get(redis_key)
        if cached_json:
            vector = json.loads(cached_json)
            _query_memory_cache[normalized_query] = vector
            return vector
    except Exception as e:
        logger.debug("Redis query cache lookup skipped/failed: %s", e)

    # 3. Cache Miss: Call AI Embedding API
    try:
        model = get_embeddings_model()
        vector = await model.aembed_query(query)
        
        # Save to L1 Memory Cache
        _query_memory_cache[normalized_query] = vector
        
        # Save to L2 Redis Cache
        try:
            from core.redis import get_redis_client
            redis_client = await get_redis_client()
            await redis_client.setex(redis_key, QUERY_CACHE_TTL_SECONDS, json.dumps(vector))
        except Exception as e:
            logger.debug("Redis query cache write skipped/failed: %s", e)
            
        return vector
    except Exception as e:
        logger.error(f"Error generating embedding for query '{query}': {e}")
        raise


