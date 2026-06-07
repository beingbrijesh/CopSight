import asyncio
from app.services.database import db_manager
from app.config import settings

async def main():
    await db_manager.connect()
    
    # Check elasticsearch
    if db_manager.elasticsearch:
        res = await db_manager.elasticsearch.search(
            index="ufdr-*",
            body={
                "query": {"match_all": {}},
                "sort": [{"timestamp": {"order": "desc", "unmapped_type": "date"}}],
                "size": 5
            }
        )
        print("ES Recent records:")
        for hit in res['hits']['hits']:
            print(f"Case: {hit['_source'].get('caseId')} | {hit['_source'].get('content')} | {hit['_source'].get('timestamp')}")

if __name__ == "__main__":
    asyncio.run(main())
