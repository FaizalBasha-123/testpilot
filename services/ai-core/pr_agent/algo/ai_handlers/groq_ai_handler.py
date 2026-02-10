import os
from typing import Optional

from openai import AsyncOpenAI, APIError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt

from pr_agent.algo.ai_handlers.base_ai_handler import BaseAiHandler
from pr_agent.config_loader import get_settings
from pr_agent.log import get_logger

MODEL_RETRIES = 2
DEFAULT_GROQ_BASE = "https://api.groq.com/openai/v1"


class GroqAIHandler(BaseAiHandler):
    """
    Direct Groq API handler using the OpenAI-compatible endpoint.
    """

    def __init__(self):
        self.api_base = os.environ.get("GROQ_API_BASE") or get_settings().get("GROQ.API_BASE", DEFAULT_GROQ_BASE)
        self.api_key = get_settings().get("GROQ.KEY") or os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY or GROQ.KEY is required for GroqAIHandler")
        self._client: Optional[AsyncOpenAI] = None

    @property
    def deployment_id(self):
        return None

    def _get_client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.api_base)
        return self._client

    def _normalize_model(self, model: str) -> str:
        if not model:
            return model
        if model.startswith("groq/"):
            return model.split("/", 1)[1]
        return model

    @retry(
        retry=retry_if_exception_type((APIError, RateLimitError)),
        stop=stop_after_attempt(MODEL_RETRIES),
    )
    async def chat_completion(self, model: str, system: str, user: str, temperature: float = 0.2, img_path: str = None):
        if img_path:
            return "Groq chat API does not support image inputs.", "error"

        model = self._normalize_model(model)
        if not model:
            raise ValueError("Model name is required for Groq chat completion")

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user})

        try:
            response = await self._get_client().chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                timeout=get_settings().config.ai_timeout,
            )
        except Exception as exc:
            get_logger().error(f"Groq API error: {exc}")
            raise

        if not response.choices:
            raise APIError("Empty response from Groq")

        choice = response.choices[0]
        content = choice.message.content if choice.message else ""
        finish_reason = choice.finish_reason or "stop"

        if get_settings().config.verbosity_level >= 2:
            print(f"\nAI response:\n{content}")

        return content, finish_reason
