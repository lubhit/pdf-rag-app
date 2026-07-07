import os

from dotenv import load_dotenv

load_dotenv()


# --- Vector store (MongoDB Atlas) ---
MONGO_URI = os.environ["MONGO_URI"]
DB_NAME = os.getenv("DB_NAME", "pdf_rag")
COLLECTION = os.getenv("COLLECTION", "chunks")
VECTOR_INDEX = os.getenv("VECTOR_INDEX", "vector_index")

# --- Embeddings (must match what the ingestion pipeline used) ---
EMBED_MODEL = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")

# --- LLM (swappable) ---
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")  # "openai" | "anthropic"
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# --- Retrieval ---
TOP_K = int(os.getenv("TOP_K", "5"))

# --- CORS ---
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
# ... all the existing config lines ...

print(f"DEBUG: DB_NAME={DB_NAME}, COLLECTION={COLLECTION}, VECTOR_INDEX={VECTOR_INDEX}")