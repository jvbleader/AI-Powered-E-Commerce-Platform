import sys
from pathlib import Path
import asyncio
import json
import logging

backend_dir = Path(__file__).resolve().parent.parent
app_dir = backend_dir / "app"
if str(app_dir) not in sys.path:
    sys.path.insert(0, str(app_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from core.elasticsearch import get_es_client
from ai.embeddings import generate_product_embedding
from search.indices import PRODUCT_INDEX_ALIAS
from services.search.search_service import recreate_products_index, bulk_index_products

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

CACHE_FILE = backend_dir.parent / "database" / "seed" / "vector_cache.jsonl"

def load_cache():
    cache = {}
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    data = json.loads(line)
                    cache[data["id"]] = data["embedding"]
    return cache

def append_to_cache(product_id, embedding):
    with open(CACHE_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"id": product_id, "embedding": embedding}) + "\n")

async def fetch_all_es_products():
    es = get_es_client()
    products = []
    try:
        # Check if index exists first
        exists = await es.indices.exists(index=PRODUCT_INDEX_ALIAS)
        if not exists:
            logger.warning(f"Index {PRODUCT_INDEX_ALIAS} does not exist yet.")
            return products
            
        resp = await es.search(
            index=PRODUCT_INDEX_ALIAS,
            body={"query": {"match_all": {}}},
            size=10000 # Assume < 10k products for now
        )
        for hit in resp.get("hits", {}).get("hits", []):
            products.append(hit["_source"])
    except Exception as e:
        logger.error(f"Error fetching from ES: {e}")
    return products

async def main():
    logger.info("Starting Re-indexing and Embedding generation from ES data...")
    
    products = await fetch_all_es_products()
    logger.info(f"Fetched {len(products)} products from Elasticsearch.")
    
    if not products:
        logger.info("No products to reindex. Recreating index anyway.")
        await recreate_products_index()
        return

    cache = load_cache()
    logger.info(f"Loaded {len(cache)} cached embeddings.")
    
    # Process embeddings
    for p in products:
        pid = p["id"]
        # Convert to string for cache key if needed, or use as is
        pid_str = str(pid)
        
        if pid_str in cache:
            p["embedding"] = cache[pid_str]
        elif pid in cache:
            p["embedding"] = cache[pid]
        else:
            logger.info(f"Generating embedding for product: {p.get('name')}")
            try:
                embedding = await generate_product_embedding(p)
                p["embedding"] = embedding
                append_to_cache(pid_str, embedding)
                logger.info(f"Successfully generated and cached embedding for {pid}")
            except Exception as e:
                logger.error(f"Failed to generate embedding for {pid}: {e}")
                
    # Recreate ES indices
    logger.info("Recreating Elasticsearch indices (v3 with dense_vector)...")
    await recreate_products_index()
    
    # Bulk index
    logger.info("Bulk indexing products into Elasticsearch...")
    valid_products = [p for p in products if "embedding" in p]
    await bulk_index_products(valid_products)
    
    logger.info("Done!")

if __name__ == "__main__":
    asyncio.run(main())
