"""
Test script for chunk_text function.
Shows chunk sizes in words and characters.
"""


from pathlib import Path
from utils.chunking import chunk_text
import sys

def print_chunk_stats(text, chunk_size=800, overlap=100):
    chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
    print(f"Total chunks: {len(chunks)}\n")
    for i, chunk in enumerate(chunks):
        word_count = len(chunk.split())
        char_count = len(chunk)
        print(f"Chunk {i+1}: {word_count} words, {char_count} chars\n{chunk[:120]}...\n")

if __name__ == "__main__":
    # Example text (replace with your own or read from file)
    sample_text = (
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 100
        + "\n" +
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " * 100
    )
    print("=== Demo: chunk_text ===\n")
    print_chunk_stats(sample_text, chunk_size=50, overlap=10)

    # Optionally, test with a file
    if len(sys.argv) > 1:
        file_path = Path(sys.argv[1])
        if file_path.exists():
            text = file_path.read_text(errors="ignore")
            print(f"\n=== File: {file_path} ===\n")
            print_chunk_stats(text, chunk_size=50, overlap=10)
        else:
            print(f"File not found: {file_path}")
