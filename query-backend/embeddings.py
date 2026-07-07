from sentence_transformers import SentenceTransformer

from config import EMBED_MODEL

# Loaded once at import. This MUST be the same model your ingestion
# pipeline used, or the query vector won't be comparable to stored vectors.
_model = SentenceTransformer(EMBED_MODEL)


def embed(text: str) -> list[float]:
    # normalize so cosine similarity behaves; match your Atlas index metric.
    return _model.encode(text, normalize_embeddings=True).tolist()
