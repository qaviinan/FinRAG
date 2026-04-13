# Default value for top_k retrievals
DEFAULT_TOP_K = 5
"""
RAPTOR retriever.

use_raptor=True  → collapsed-tree search across all levels (leaves + summaries)
use_raptor=False → flat RAG: only leaf nodes (level 0, is_summary=False)
"""

import os
import logging
from typing import List
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

logger = logging.getLogger(__name__)

RAPTOR_COLLECTION = os.getenv("CHROMA_RAPTOR_COLLECTION", "finfrag_raptor")
# Use absolute path: resolve relative to the backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", str(BACKEND_DIR / "chromadb"))
class RaptorRetriever:
    def __init__(self):
        self.chroma = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        self.embed_fn = DefaultEmbeddingFunction()
        self._collection = None

    def _get_collection(self):
        if self._collection is None:
            try:
                self._collection = self.chroma.get_collection(
                    RAPTOR_COLLECTION,
                    embedding_function=self.embed_fn,
                )
            except Exception:
                logger.warning(
                    "RAPTOR collection '%s' not found. Run: python manage.py build_raptor",
                    RAPTOR_COLLECTION,
                )
                return None
        return self._collection

    def retrieve(self, query: str, use_raptor: bool = True, top_k: int = DEFAULT_TOP_K) -> List[str]:
        """
        Return a list of relevant text passages.

        use_raptor=True  → search all levels (RAPTOR collapsed-tree)
        use_raptor=False → search leaf nodes only (plain RAG)
        """
        collection = self._get_collection()
        if collection is None:
            return []

        count = collection.count()
        if count == 0:
            return []

        where = None if use_raptor else {"is_summary": False}

        try:
            results = collection.query(
                query_texts=[query],
                n_results=min(top_k, count),
                where=where,
            )
            return results.get("documents", [[]])[0]
        except Exception as e:
            logger.error("RAPTOR retrieval error: %s", e)
            return []
