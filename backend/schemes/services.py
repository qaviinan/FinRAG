from embedchain import App
from embedchain.config import BaseLlmConfig
import os
from dotenv import load_dotenv

load_dotenv()

def create_embedchain_bot():
    return App.from_config(
        config={
            "llm": {
                "provider": "groq",
                "config": {
                    "model": "llama-3-8b-8192",
                    "max_tokens": 1000,
                    "stream": False,
                    "api_key": os.getenv("GROQ_API_KEY"),
                },
            },
            "app": {
                "config": {
                    "log_level": "DEBUG",
                    "id": "hotel-101"
                }
            },
            "chunker": {"chunk_size": 1000, "chunk_overlap": 0, "length_function": "len"},
        }
    )

ec_app = create_embedchain_bot() 