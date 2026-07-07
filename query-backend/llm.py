from abc import ABC, abstractmethod

from config import LLM_PROVIDER, LLM_MODEL

SYSTEM_PROMPT = (
    "You answer questions using ONLY the provided context extracted from a PDF. "
    "If the answer is not contained in the context, say you don't know rather "
    "than guessing. Cite the source file when it helps."
)


def build_prompt(question: str, chunks: list[dict]) -> str:
    context = "\n\n".join(
        f"[{c.get('source_file', '?')}, chunk {c.get('chunk_number', '?')}] {c['text']}"
        for c in chunks
    )
    return f"Context:\n{context}\n\nQuestion: {question}"


class LLMProvider(ABC):
    @abstractmethod
    def complete(self, system: str, user: str) -> str: ...


class OpenAIProvider(LLMProvider):
    def __init__(self):
        from openai import OpenAI

        self.client = OpenAI()  # reads OPENAI_API_KEY

    def complete(self, system: str, user: str) -> str:
        resp = self.client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return resp.choices[0].message.content


class AnthropicProvider(LLMProvider):
    def __init__(self):
        from anthropic import Anthropic

        self.client = Anthropic()  # reads ANTHROPIC_API_KEY

    def complete(self, system: str, user: str) -> str:
        resp = self.client.messages.create(
            model=LLM_MODEL,
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text


_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
}


def get_provider() -> LLMProvider:
    try:
        return _PROVIDERS[LLM_PROVIDER]()
    except KeyError:
        raise ValueError(
            f"Unknown LLM_PROVIDER '{LLM_PROVIDER}'. "
            f"Options: {', '.join(_PROVIDERS)}"
        )
