"""
RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval

Builds a hierarchical Chroma collection by recursively clustering leaf chunks
and summarizing each cluster, up to MAX_LEVELS deep.
"""

import os
import uuid
import logging
import numpy as np
import time
try:
    import resource
except Exception:
    resource = None
import json
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from sklearn.mixture import GaussianMixture
from groq import Groq
import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

logger = logging.getLogger(__name__)

RAPTOR_COLLECTION = os.getenv("CHROMA_RAPTOR_COLLECTION", "finfrag_raptor")
# Use absolute path: resolve relative to the backend directory
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", str(BACKEND_DIR / "chromadb"))
SUMMARY_MODEL = os.getenv("GROQ_SUMMARY_MODEL", "llama-3.1-8b-instant")
MAX_LEVELS = 3
MIN_CLUSTER_SIZE = 10  # stop recursing if fewer nodes than this
RAPTOR_ROOT_ID = "__raptor_root__"
# Safeguards to avoid running heavy clustering on extremely large leaf counts
MAX_TREE_LEAF_NODES = int(os.getenv("RAPTOR_MAX_LEAF_NODES", "2000"))
# Embed in batches when many texts
EMBEDDING_BATCH_SIZE = int(os.getenv("RAPTOR_EMBED_BATCH", "256"))


class RaptorTreeBuilder:
    def __init__(self):
        self.chroma = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        self.embed_fn = DefaultEmbeddingFunction()
        self.groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.collection = self.chroma.get_or_create_collection(
            RAPTOR_COLLECTION,
            embedding_function=self.embed_fn,
        )

    def clear(self):
        """Delete and recreate the Chroma collection."""
        try:
            self.chroma.delete_collection(RAPTOR_COLLECTION)
        except Exception:
            pass
        self.collection = self.chroma.get_or_create_collection(
            RAPTOR_COLLECTION,
            embedding_function=self.embed_fn,
        )

    def add_documents(self, texts: List[str], metadatas: Optional[List[Dict]] = None):
        """
        Ingest leaf-level chunks and build the full RAPTOR tree.

        texts     — pre-chunked text strings
        metadatas — optional per-chunk dicts (source, page, etc.)
        """
        if not texts:
            return

        # ── Level 0: leaf nodes ──────────────────────────────────────────────
        leaf_ids = [str(uuid.uuid4()) for _ in texts]
        leaf_metas = []
        for i, _ in enumerate(texts):
            meta = dict(metadatas[i]) if metadatas else {}
            meta["level"] = 0
            meta["is_summary"] = False
            meta["parent_id"] = RAPTOR_ROOT_ID
            leaf_metas.append(meta)

        logger.info("Adding %d leaf nodes to RAPTOR collection", len(texts))
        self._batch_add(leaf_ids, texts, leaf_metas)
        print(f"Added {len(texts)} leaf nodes to Chroma collection")

        # Safety: avoid expensive clustering if the number of leaf nodes is very large
        if len(texts) > MAX_TREE_LEAF_NODES:
            print(
                f"Too many leaf nodes ({len(texts)}) — skipping summary levels to avoid OOM."
            )
            print(
                "Set environment variable RAPTOR_MAX_LEAF_NODES to override, or increase --chunk-size."
            )
            return

        # ── Levels 1-N: cluster → summarize → store ──────────────────────────
        current_texts = texts
        current_ids = leaf_ids
        current_meta_by_id = {doc_id: meta for doc_id, meta in zip(current_ids, leaf_metas)}
        for level in range(1, MAX_LEVELS + 1):
            if len(current_texts) < MIN_CLUSTER_SIZE:
                logger.info(
                    "Only %d nodes at level %d — stopping tree growth",
                    len(current_texts), level - 1,
                )
                break

            logger.info("Building level %d summaries from %d nodes", level, len(current_texts))
            summary_texts, summary_ids, clusters, summary_titles = self._cluster_and_summarize(
                current_texts, current_ids, level
            )

            if not summary_texts:
                break

            summary_metas = []
            for t in (summary_titles or []):
                meta = {"level": level, "is_summary": True, "parent_id": RAPTOR_ROOT_ID}
                if t:
                    meta["title"] = t
                summary_metas.append(meta)
            self._batch_add(summary_ids, summary_texts, summary_metas)

            for summary_id, child_ids in zip(summary_ids, clusters):
                child_metas = []
                for child_id in child_ids:
                    child_meta = current_meta_by_id[child_id]
                    child_meta["parent_id"] = summary_id
                    child_metas.append(child_meta)
                self._batch_update_metadata(child_ids, child_metas)

            current_texts = summary_texts
            current_ids = summary_ids
            current_meta_by_id = {doc_id: meta for doc_id, meta in zip(current_ids, summary_metas)}

        logger.info("RAPTOR tree build complete")

    # ── Internal helpers ─────────────────────────────────────────────────────

    def _batch_add(self, ids: List[str], texts: List[str], metadatas: List[Dict]):
        batch = 100
        for i in range(0, len(ids), batch):
            self.collection.add(
                ids=ids[i : i + batch],
                documents=texts[i : i + batch],
                metadatas=metadatas[i : i + batch],
            )

    def _batch_update_metadata(self, ids: List[str], metadatas: List[Dict]):
        batch = 100
        for i in range(0, len(ids), batch):
            self.collection.update(
                ids=ids[i : i + batch],
                metadatas=metadatas[i : i + batch],
            )

    def _cluster_and_summarize(
        self, texts: List[str], ids: List[str], level: int
    ) -> Tuple[List[str], List[str], List[List[str]], List[str]]:
        """Embed → UMAP → GMM → summarize each cluster. Returns (texts, ids, child_id_groups, titles)."""
        n_texts = len(texts)
        print(f"_cluster_and_summarize: level={level} n_texts={n_texts}")
        total_chars = sum(len(t) for t in texts)
        print(f"Total chars across texts: {total_chars}")

        t0 = time.time()
        # Compute embeddings in batches for large corpora to avoid OOM
        try:
            if n_texts > EMBEDDING_BATCH_SIZE:
                print(f"Embedding in batches of {EMBEDDING_BATCH_SIZE}")
                emb_list = []
                for i in range(0, n_texts, EMBEDDING_BATCH_SIZE):
                    batch = texts[i : i + EMBEDDING_BATCH_SIZE]
                    try:
                        batch_emb = self.embed_fn(batch)
                    except Exception as e:
                        print("Embedding batch error:", e)
                        # Fallback: embed items individually
                        batch_emb = []
                        for b in batch:
                            try:
                                batch_emb.append(self.embed_fn([b])[0])
                            except Exception as e2:
                                print("Fallback embedding failed for one item:", e2)
                                batch_emb.append([0.0])
                    emb_list.extend(batch_emb)
                embeddings = np.array(emb_list)
            else:
                embeddings = np.array(self.embed_fn(texts))
        except Exception as e:
            print("Embedding failed:", e)
            return [], [], []

        print(f"Embeddings computed: shape={getattr(embeddings, 'shape', None)} time={(time.time()-t0):.2f}s")

        # Dimensionality reduction for better GMM clustering
        # UMAP can be memory-intensive; skip for very large inputs
        if n_texts > 2000:
            print("Skipping UMAP reduction for large n_texts to reduce memory usage")
            reduced = embeddings
        else:
            reduced = self._umap_reduce(embeddings, n_texts=len(texts))

        n_clusters = self._optimal_n_clusters(reduced)
        print(f"Chosen n_clusters={n_clusters}")

        if n_clusters <= 1:
            summary, title = self._summarize(texts)
            return [summary], [str(uuid.uuid4())], [ids], [title]

        gmm = GaussianMixture(n_components=n_clusters, random_state=42)
        labels = gmm.fit_predict(reduced)

        summary_texts, summary_ids, clusters, summary_titles = [], [], [], []
        for cid in range(n_clusters):
            print(f"Cluster {cid}: computing summary")
            cluster_texts = [t for t, lbl in zip(texts, labels) if lbl == cid]
            cluster_ids = [doc_id for doc_id, lbl in zip(ids, labels) if lbl == cid]
            print(f"Cluster {cid}: size={len(cluster_texts)}")
            if not cluster_texts:
                continue
            summary, title = self._summarize(cluster_texts)
            summary_texts.append(summary)
            summary_titles.append(title)
            summary_ids.append(str(uuid.uuid4()))
            clusters.append(cluster_ids)

        return summary_texts, summary_ids, clusters, summary_titles

    def _umap_reduce(self, embeddings: np.ndarray, n_texts: int) -> np.ndarray:
        try:
            import umap  # type: ignore

            n_components = min(10, n_texts - 2, embeddings.shape[1] - 1)
            n_neighbors = min(15, n_texts - 1)
            reducer = umap.UMAP(
                n_components=n_components,
                metric="cosine",
                random_state=42,
                n_neighbors=n_neighbors,
            )
            return reducer.fit_transform(embeddings)
        except ImportError:
            logger.warning("umap-learn not installed; clustering on raw embeddings")
            return embeddings

    def _optimal_n_clusters(self, data: np.ndarray, max_k: int = 10) -> int:
        """BIC-based GMM cluster count selection."""
        n = len(data)
        if n < 4:
            return 1
        max_k = min(max_k, n // 2)
        best_bic, best_k = float("inf"), 1
        for k in range(2, max_k + 1):
            try:
                gmm = GaussianMixture(n_components=k, random_state=42)
                gmm.fit(data)
                bic = gmm.bic(data)
                if bic < best_bic:
                    best_bic, best_k = bic, k
            except Exception:
                break
        return best_k

    def _summarize(self, texts: List[str]) -> Tuple[str, str]:
        """LLM-based cluster summarization via Groq. Returns (summary, title).

        The model is asked to return a JSON object with keys 'title' (2-3 words)
        and 'summary' (the full summary text). If parsing fails we fall back to
        using the raw model text as the summary and derive a short title.
        """
        combined = "\n\n---\n\n".join(texts[:20])
        if len(combined) > 12_000:
            combined = combined[:12_000]

        prompt_system = (
            "You are a financial text summarizer. Produce a concise but comprehensive "
            "summary that preserves key concepts and numerical facts. Return only a JSON object "
            "with two keys: 'title' (a short 2-3 word title) and 'summary' (the full summary)."
        )

        resp = self.groq.chat.completions.create(
            model=SUMMARY_MODEL,
            messages=[
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": f"Summarize the following passages:\n\n{combined}"},
            ],
            max_tokens=600,
        )

        content = resp.choices[0].message.content or ""
        # Try to parse JSON first
        try:
            parsed = json.loads(content.strip())
            summary = parsed.get("summary", "")
            title = parsed.get("title", "")
            if not summary:
                summary = content
            if not title:
                # Derive a short title from the first words of the summary
                title = " ".join(summary.split()[:3])
            return summary, title
        except Exception:
            # Fallback: use raw content as summary and derive a short title
            summary = content
            title = " ".join(summary.split()[:3])
            return summary, title
