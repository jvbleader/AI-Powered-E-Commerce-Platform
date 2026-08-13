import logging
from typing import List, Dict, Any
from langchain_openai import OpenAIEmbeddings

from ai.ai_config import ai_settings

logger = logging.getLogger(__name__)

# Initialize the embedding model
_embeddings = None

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
    Generates a 1536-dimensional embedding vector for a product.
    Combines name, brand_name, category_names, and short_description.
    """
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

async def generate_query_embedding(query: str) -> List[float]:
    """
    Generates an embedding vector for a search query.
    """
    try:
        model = get_embeddings_model()
        vector = await model.aembed_query(query)
        return vector
    except Exception as e:
        logger.error(f"Error generating embedding for query '{query}': {e}")
        raise

