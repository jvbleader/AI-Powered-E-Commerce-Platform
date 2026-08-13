import asyncio
import sys
import codecs
from core.elasticsearch import get_es_client

sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

async def main():
    try:
        es = get_es_client()
        resp = await es.search(
            index="products_current",
            body={
                "size": 100,
                "query": {"match_all": {}},
                "_source": ["name", "sold_count", "average_rating"]
            }
        )
        hits = resp.get("hits", {}).get("hits", [])
        
        print(f"Total products: {len(hits)}")
        
        for hit in hits:
            src = hit['_source']
            print(f"ID: {hit['_id']}, Name: {src.get('name')}, Sold: {src.get('sold_count')}, Rating: {src.get('average_rating')}")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
