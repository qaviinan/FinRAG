"""
Build (or rebuild) the RAPTOR tree from source documents.

Usage:
    python manage.py build_raptor
    python manage.py build_raptor --source-dir path/to/books
    python manage.py build_raptor --source-dir path/to/books --clear --chunk-size 600

Supported file types: .pdf, .txt, .md
"""


from pathlib import Path
from django.core.management.base import BaseCommand
from schemes.raptor.tree_builder import RaptorTreeBuilder
from utils.chunking import chunk_text


class Command(BaseCommand):
    help = "Build RAPTOR tree index from PDF / text source documents"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-dir",
            default="references",
            help="Directory containing .pdf / .txt / .md source files (default: references/)",
        )
        parser.add_argument(
            "--chunk-size",
            type=int,
            default=50,
            help="Words per leaf chunk (default: 50)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete the existing RAPTOR collection before rebuilding",
        )

    def handle(self, *args, **options):
        source_dir = Path(options["source_dir"])
        if not source_dir.exists():
            self.stderr.write(f"Source directory not found: {source_dir}")
            return

        # Delay creating the RAPTOR builder (and Chroma client) until after
        # we've scanned and chunked source files to avoid long startup stalls.
        builder = None

        all_texts, all_metas = [], []

        for path in sorted(source_dir.iterdir()):
            text = None
            suffix = path.suffix.lower()

            if suffix == ".pdf":
                try:
                    from pypdf import PdfReader

                    reader = PdfReader(str(path))
                    text = "\n".join(page.extract_text() or "" for page in reader.pages)
                except Exception as e:
                    self.stderr.write(f"Could not read {path.name}: {e}")
                    continue

            elif suffix in (".txt", ".md"):
                try:
                    text = path.read_text(errors="ignore")
                except Exception as e:
                    self.stderr.write(f"Could not read {path.name}: {e}")
                    continue

            if not text or not text.strip():
                continue

            print(f"\n--- Processing file: {path.name} ---")
            print(f"Total input chars: {len(text)} | words: {len(text.split())}")

            chunks = chunk_text(text, chunk_size=options["chunk_size"])
            print(f"Chunks created: {len(chunks)}")
            for idx, chunk in enumerate(chunks):
                print(f"  Chunk {idx+1}: {len(chunk)} chars, {len(chunk.split())} words")
            for i, chunk in enumerate(chunks):
                all_texts.append(chunk)
                all_metas.append({"source": path.name, "chunk_index": i})

            self.stdout.write(f"  {path.name}: {len(chunks)} chunks")

        if not all_texts:
            self.stdout.write(
                self.style.WARNING(
                    "No text found. Add .pdf or .txt files to the source directory and re-run."
                )
            )
            return

        print(f"\n=== Ingestion summary ===")
        print(f"Total chunks to ingest: {len(all_texts)}")
        for i, chunk in enumerate(all_texts):
            print(f"  Ingest {i+1}: {len(chunk)} chars, {len(chunk.split())} words, meta: {all_metas[i]}")

        self.stdout.write(
            f"\nBuilding RAPTOR tree from {len(all_texts)} total chunks…"
        )
        # Instantiate the builder now (this may initialize Chroma and embeddings)
        print("Instantiating RaptorTreeBuilder (this may take a moment)...")
        builder = RaptorTreeBuilder()
        if options["clear"]:
            self.stdout.write("Clearing existing RAPTOR tree…")
            builder.clear()

        print("Calling builder.add_documents...")
        builder.add_documents(all_texts, all_metas)
        print("builder.add_documents finished.")
        self.stdout.write(self.style.SUCCESS("RAPTOR tree built successfully."))
