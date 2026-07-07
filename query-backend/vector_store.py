from pymongo import MongoClient

from config import MONGO_URI, DB_NAME, COLLECTION, VECTOR_INDEX

_collection = MongoClient(MONGO_URI)[DB_NAME][COLLECTION]


def search(query_vec: list[float], k: int) -> list[dict]:
    """Top-k most similar chunks for the query vector.

    Field names below (`embedding`, `text`, `source_file`, `chunk_number`)
    match what the ingestion pipeline writes.
    """
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX,
                "path": "embedding",
                "queryVector": query_vec,
                "numCandidates": max(100, k * 20),
                "limit": k,
            }
        },
        {
            "$project": {
                "_id": 0,
                "text": 1,
                "source_file": 1,
                "chunk_number": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]
    return list(_collection.aggregate(pipeline))
