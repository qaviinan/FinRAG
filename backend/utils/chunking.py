"""
Utility for chunking text into overlapping word-level chunks.
"""

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100):
    """Split text into overlapping word-level chunks."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + chunk_size]))
        i += chunk_size - overlap
    return chunks
