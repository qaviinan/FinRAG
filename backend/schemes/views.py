"""
Two endpoints:

POST /api/chat/
    Body:  { session_id, query, use_raptor }
    Response: { messages: [{type, content}], response_id }

POST /api/feedback/
    Body:  { response_id, rating, query, session_id }
    Response: { ok: true }
"""

from __future__ import annotations
import json
import logging
import uuid
import re
import sqlite3
from collections import deque

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Feedback
from .raptor.tree_builder import RAPTOR_ROOT_ID
from .services import groq_client, retriever, get_schemes_conn, CHAT_MODEL

logger = logging.getLogger(__name__)

# ── Conversation history (in-memory, keyed by session_id) ────────────────────
MAX_HISTORY = 20  # messages kept per session
_session_history: dict[str, deque] = {}


def _get_history(session_id: str) -> deque:
    if session_id not in _session_history:
        _session_history[session_id] = deque(maxlen=MAX_HISTORY)
    return _session_history[session_id]


# ── Tool definitions (Groq / OpenAI function-calling schema) ─────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "retrieve_context",
            "description": (
                "Retrieve relevant passages from the financial knowledge base. "
                "Call this before answering any question about trading strategies, "
                "market concepts, or investment theory."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant context.",
                    }
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_sql",
            "description": (
                "Execute a SELECT SQL query against the investment schemes database. "
                "Table: schemes. "
                "Columns: scheme_id, name, category, risk_level, min_investment, "
                "returns_3yr, returns_5yr, expense_ratio, fund_size, fund_manager, description. "
                "Use this when the user asks to compare, filter, or list investment schemes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "A SELECT SQL query (read-only).",
                    }
                },
                "required": ["sql"],
            },
        },
    },
]

SYSTEM_PROMPT = """You are FinRAG, an AI financial advisor with access to curated trading knowledge and a live investment schemes database.

Guidelines:
- Always call retrieve_context before answering questions about trading theory, strategies, or market concepts.
- Call run_sql when users ask to compare, filter, or explore investment schemes.
- Never mention that you are retrieving context or running SQL — weave the information seamlessly into your answers.
- Be descriptive and technically precise. Include step-by-step reasoning where relevant.
- Do not invent data. If context is insufficient, say so."""


# ── Tool execution ────────────────────────────────────────────────────────────

def _execute_retrieve_context(query: str, use_raptor: bool) -> str:
    docs = retriever.retrieve(query, use_raptor=use_raptor)
    if not docs:
        return "No relevant context found in the knowledge base."
    return "\n\n---\n\n".join(docs)


def _execute_run_sql(sql: str) -> tuple[str, list | None]:
    """Returns (text_summary, rows_or_None). rows is set when it's a table result."""
    sql_stripped = sql.strip()
    sql_upper = sql_stripped.upper()

    if not sql_upper.startswith("SELECT"):
        return "Error: only SELECT queries are permitted.", None

    # More robust check for forbidden keywords using regex word boundaries
    if re.search(r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|ATTACH|DETACH|PRAGMA)\b", sql_upper):
        return "Error: Forbidden SQL keyword detected.", None

    conn = get_schemes_conn()
    if conn is None:
        return "Schemes database is not available (CSV not loaded).", None

    try:
        cursor = conn.cursor()
        cursor.execute(sql_stripped)
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchmany(50)  # hard cap
        records = [dict(zip(columns, row)) for row in rows]
        if not records:
            return "Query returned no results.", None
        # Short text repr for the LLM's context message
        text = f"Query returned {len(records)} row(s):\n" + json.dumps(records[:5], default=str)
        return text, records
    except sqlite3.Error as e:
        return f"SQL error: {e}", None


def _get_raptor_collection():
    collection = retriever.instance._get_collection()
    return collection


def _serialize_tree_node(doc_id: str, document: str, metadata: dict) -> dict:
    # Prefer an explicit title produced during tree building (summary nodes).
    title = None
    if metadata:
        title = metadata.get("title")
    # Fallback: if it's a summary node but no explicit title, derive a short one.
    if not title and metadata and metadata.get("is_summary", False):
        title = " ".join(str(document or "").strip().split()[:3])
    if title and len(title) > 120:
        title = title[:117].rstrip() + "..."

    return {
        "id": doc_id,
        "title": title or "",
        "document": document,
        "level": metadata.get("level", 0),
        "is_summary": bool(metadata.get("is_summary", False)),
        "parent_id": metadata.get("parent_id"),
    }


def _fetch_raptor_tree_nodes(parent_id: str | None = None) -> list[dict] | None:
    collection = _get_raptor_collection()
    if collection is None:
        return None

    where = {"parent_id": parent_id or RAPTOR_ROOT_ID}
    result = collection.get(where=where, include=["metadatas", "documents"], limit=500)
    ids = result.get("ids", []) or []
    documents = result.get("documents", []) or []
    metadatas = result.get("metadatas", []) or []

    if not ids and parent_id is None:
        # Fallback for older indexes that did not include parent marker metadata.
        all_result = collection.get(include=["metadatas", "documents"], limit=1000)
        all_ids = all_result.get("ids", []) or []
        all_documents = all_result.get("documents", []) or []
        all_metadatas = all_result.get("metadatas", []) or []
        nodes = []
        for doc_id, document, metadata in zip(all_ids, all_documents, all_metadatas):
            if metadata.get("parent_id") is None:
                nodes.append(_serialize_tree_node(doc_id, document, metadata))
        return nodes

    return [
        _serialize_tree_node(doc_id, document, metadata)
        for doc_id, document, metadata in zip(ids, documents, metadatas)
    ]


@csrf_exempt
@require_http_methods(["GET"])
def raptor_tree(request):
    node_id = request.GET.get("node_id")
    nodes = _fetch_raptor_tree_nodes(node_id)
    if nodes is None:
        return JsonResponse(
            {"error": "RAPTOR index is not available. Run build_raptor first."},
            status=503,
        )
    return JsonResponse({"nodes": nodes})


# ── Agentic chat loop ─────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def chat(request):
    body = json.loads(request.body)
    query: str = body.get("query", "").strip()
    session_id: str = body.get("session_id", "anon")
    use_raptor: bool = bool(body.get("use_raptor", True))
    mode: str = body.get("mode", "rag-only")  # 'rag-only' or 'llm+rag'

    if not query:
        return JsonResponse({"error": "query is required"}, status=400)

    history = _get_history(session_id)
    history.append({"role": "user", "content": query})

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + list(history)

    table_rows = None  # set if the SQL tool returns tabular data

    # Short-circuit: RAG-only mode should return retrieved suggestions immediately
    if mode == "rag-only":
        docs = retriever.retrieve(query, use_raptor=use_raptor)
        response_id = str(uuid.uuid4())
        if not docs:
            return JsonResponse(
                {"messages": [{"type": "text", "content": "No relevant context found in the knowledge base."}], "response_id": response_id}
            )

        out_messages = [{"type": "text", "content": f"Top {len(docs)} RAG suggestions:"}]
        for d in docs:
            out_messages.append({"type": "rag", "content": d})

        return JsonResponse({"messages": out_messages, "response_id": response_id})

    # For llm+rag mode: prefetch docs and attach them as system context so LLM sees them
    prefetch_docs = retriever.retrieve(query, use_raptor=use_raptor)
    if prefetch_docs:
        joined_docs = "\n\n---\n\n".join(prefetch_docs)
        messages.append({"role": "system", "content": f"Relevant retrieved passages:\n\n{joined_docs}"})

    # ── Tool-use loop (max 5 iterations to prevent runaway) ──────────────────
    for _ in range(5):
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=1500,
        )

        choice = response.choices[0]
        msg = choice.message

        # No tool calls → we have the final answer
        if not msg.tool_calls:
            break

        # Append the assistant's tool-call message
        messages.append(msg)

        # Execute each tool call and append results
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            fn_args = json.loads(tc.function.arguments)

            if fn_name == "retrieve_context":
                result_text = _execute_retrieve_context(fn_args["query"], use_raptor)
            elif fn_name == "run_sql":
                result_text, rows = _execute_run_sql(fn_args["sql"])
                if rows:
                    table_rows = rows
            else:
                result_text = f"Unknown tool: {fn_name}"

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_text,
            })
    else:
        # Exhausted iterations — call once more without tools for a plain answer
        response = groq_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            max_tokens=1500,
        )
        choice = response.choices[0]
        msg = choice.message

    answer = msg.content or ""

    # Save assistant turn to history
    history.append({"role": "assistant", "content": answer})

    # Build response message list
    response_id = str(uuid.uuid4())
    out_messages = [{"type": "text", "content": answer}]
    if table_rows:
        out_messages.append({"type": "table", "content": table_rows})

    # Append the retrieved RAG docs below the LLM answer for user inspection
    if prefetch_docs:
        out_messages.append({"type": "text", "content": f"RAG suggestions ({len(prefetch_docs)}):"})
        for d in prefetch_docs:
            out_messages.append({"type": "rag", "content": d})

    return JsonResponse({"messages": out_messages, "response_id": response_id})


# ── Feedback endpoint ─────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["POST"])
def feedback(request):
    body = json.loads(request.body)
    response_id = body.get("response_id", "")
    rating = body.get("rating", "")
    query = body.get("query", "")
    session_id = body.get("session_id", "")

    if rating not in (Feedback.LIKE, Feedback.DISLIKE):
        return JsonResponse({"error": "rating must be 'like' or 'dislike'"}, status=400)

    Feedback.objects.update_or_create(
        response_id=response_id,
        session_id=session_id,
        defaults={"rating": rating, "query": query},
    )

    return JsonResponse({"ok": True})
