"""
Shared service singletons — instantiated once at startup to avoid re-connecting
on every request.
"""

from __future__ import annotations
import os
import sqlite3
import logging

import pandas as pd
from dotenv import load_dotenv
from groq import Groq

from .raptor.retriever import RaptorRetriever

load_dotenv()

logger = logging.getLogger(__name__)

# ── Groq client ──────────────────────────────────────────────────────────────
# Use a tool-use capable model for the main chat agent.
CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama3-groq-70b-8192-tool-use-preview")

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class RetrieverWrapper:
    """Wrapper to provide logging and status checks for the RaptorRetriever."""
    def __init__(self):
        self.instance = RaptorRetriever()
    
    def retrieve(self, query: str, use_raptor: bool):
        # You can add logic here to check if the Chroma collection exists/is empty
        return self.instance.retrieve(query, use_raptor=use_raptor)

    def get_status(self):
        return "Ready" # Extend this to return collection counts if RaptorRetriever exposes them

retriever = RetrieverWrapper()

# ── In-memory schemes SQLite DB ──────────────────────────────────────────────
_schemes_conn: sqlite3.Connection | None = None
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "clean", "latest_schemes_data.csv")


def get_schemes_conn() -> sqlite3.Connection | None:
    """
    Load the schemes CSV into a persistent in-memory SQLite connection once.
    Returns None if the CSV doesn't exist yet.
    """
    global _schemes_conn
    if _schemes_conn is not None:
        return _schemes_conn

    csv_path = os.path.normpath(CSV_PATH)
    if not os.path.exists(csv_path):
        logger.warning("Schemes CSV not found at %s — SQL tool will be unavailable", csv_path)
        return None

    try:
        df = pd.read_csv(csv_path)
        numeric_cols = ["min_investment", "returns_3yr", "returns_5yr", "expense_ratio", "fund_size"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        conn = sqlite3.connect(":memory:", check_same_thread=False)
        df.to_sql("schemes", conn, index=False, if_exists="replace")
        _schemes_conn = conn
        logger.info("Schemes DB loaded: %d rows", len(df))
    except Exception as e:
        logger.error("Failed to load schemes CSV: %s", e)
        return None

    return _schemes_conn
