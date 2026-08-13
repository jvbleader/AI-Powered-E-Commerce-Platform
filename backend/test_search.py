import asyncio
import sys
import codecs
from app.services.search.search_service import search_products
from app.schemas.search.search_schema import SearchRequest
from core.elasticsearch import get_es_client

sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

async def main():
    req = SearchRequest(q="áo", limit=20, page=1)
    try:
        es = get_es_client()
        from app.search.pipeline.pipeline import SearchPipeline
        from app.search.strategies import ProductSearchStrategy
        from ai.embeddings import generate_query_embedding

        processed_query = SearchPipeline().process_query(req.q)
        query_vector = await generate_query_embedding(processed_query)
        strategy = ProductSearchStrategy()
        final_query = strategy.build_query(
            processed_query=processed_query,
            filters={},
            page=req.page,
            size=req.limit,
            sort_by="relevance",
            query_vector=query_vector
        )
        final_query["_source"] = ["name", "sold_count", "average_rating"]
        final_query["explain"] = True  # Get explanation

        import json
        
        resp = await es.search(
            index="products_current",
            body=final_query,
            request_timeout=3.0
        )
        hits = resp.get("hits", {}).get("hits", [])
        print("\nResults:")
        for i, hit in enumerate(hits):
            print(f"{i+1}. Score: {hit['_score']} - Name: {hit['_source'].get('name')}")
            # print top level explanation to see why it scored this way
            expl = hit.get('_explanation', {})
            print(f"   Explain: {expl.get('value')} = {expl.get('description')}")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
