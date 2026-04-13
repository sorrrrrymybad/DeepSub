from openai import OpenAI

from engines.base import TranslateEngine


class OpenAITranslateEngine(TranslateEngine):
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: str | None = None,
    ):
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional subtitle translator. "
                        f"Translate from {source_lang} to {target_lang}. "
                        "Output ONLY the translated text, no explanations."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
