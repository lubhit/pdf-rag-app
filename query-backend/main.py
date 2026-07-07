from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from config import TOP_K, FRONTEND_ORIGIN
from embeddings import embed
from vector_store import search
from llm import get_provider, build_prompt, SYSTEM_PROMPT

app = FastAPI(title="PDF RAG Query")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only — tighten to FRONTEND_ORIGIN before deploying
    allow_methods=["*"],
    allow_headers=["*"],
)

provider = get_provider()


class ChatRequest(BaseModel):
    question: str
    k: Optional[int] = None


class Source(BaseModel):
    source_file: Optional[str] = None
    chunk_number: Optional[int] = None
    score: Optional[float] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    k = req.k or TOP_K

    # 1. embed the question (same model as ingestion)
    query_vec = embed(req.question)

    # 2. retrieve top-k chunks from Atlas
    chunks = search(query_vec, k)

    # 3. build context-grounded prompt and call the LLM
    user_prompt = build_prompt(req.question, chunks)
    answer = provider.complete(SYSTEM_PROMPT, user_prompt)

    sources = [
        Source(
            source_file=c.get("source_file"),
            chunk_number=c.get("chunk_number"),
            score=c.get("score"),
        )
        for c in chunks
    ]
    return ChatResponse(answer=answer, sources=sources)


@app.get("/health")
def health():
    return {"status": "ok"}