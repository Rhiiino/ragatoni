# ragatoni/backend/src/pipeline/05_ask.py

"""Step 5: answer questions about one stored document with searchable tools."""

import json
from typing import TypedDict

from openai import OpenAI, OpenAIError

from core.config import settings
from core.db import connect, parse_document_id, parse_session_id

_PREVIEW = 700
_PASSAGE_LIMIT = 12_000
_ROUNDS = 6


class AskError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class ChatChoice(TypedDict):
    model: str
    input_per_million: float
    output_per_million: float


CHOICES: tuple[ChatChoice, ...] = (
    {"model": "gpt-5.4-mini", "input_per_million": 0.75, "output_per_million": 4.50},
    {"model": "gpt-5.4", "input_per_million": 2.50, "output_per_million": 15.00},
    {"model": "gpt-5-mini", "input_per_million": 0.25, "output_per_million": 2.00},
    {"model": "gpt-5", "input_per_million": 1.25, "output_per_million": 10.00},
    {"model": "gpt-4.1-mini", "input_per_million": 0.40, "output_per_million": 1.60},
)

_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_passages",
            "description": "Find the passages in this document that are closest to a question.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to look for in the document.",
                    }
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_passage",
            "description": "Read the full text of one passage by the index returned from search_passages.",
            "parameters": {
                "type": "object",
                "properties": {
                    "index": {
                        "type": "integer",
                        "description": "Passage index from search_passages.",
                    }
                },
                "required": ["index"],
                "additionalProperties": False,
            },
        },
    },
]


def answer_question(session_id: str, document_id: str, model: str, messages: list[dict]) -> dict:
    choice = _choice(model)
    session = _session(session_id)
    document = _document_id(document_id)
    history = _history(messages)
    if not settings.openai_api_key:
        raise AskError("Set OPENAI_API_KEY before asking.")

    client = OpenAI(api_key=settings.openai_api_key, timeout=90.0)
    with connect() as conn:
        stored = conn.execute(
            """
            SELECT id, filename, embedding_model, dimensions
            FROM documents
            WHERE id = %s AND session_id = %s
            """,
            (document, session),
        ).fetchone()
        if stored is None:
            raise AskError("That document is not in this session.", status_code=404)

        transcript: list[dict] = [
            {
                "role": "system",
                "content": (
                    f'You answer questions about the document "{stored["filename"]}". '
                    "Use search_passages to find relevant passages and read_passage when you need the full text. "
                    "Base the answer on those passages. If the document does not contain the answer, say so."
                ),
            },
            *history,
        ]
        input_tokens = 0
        output_tokens = 0
        try:
            for round_index in range(_ROUNDS):
                kwargs: dict = {
                    "model": choice["model"],
                    "messages": transcript,
                    "tools": _TOOLS,
                    "max_completion_tokens": 2048,
                }
                if round_index == 0:
                    kwargs["tool_choice"] = {"type": "function", "function": {"name": "search_passages"}}
                if choice["model"].startswith("gpt-5"):
                    kwargs["reasoning_effort"] = "none"
                response = client.chat.completions.create(**kwargs)
                usage = response.usage
                if usage is not None:
                    input_tokens += int(getattr(usage, "prompt_tokens", 0) or 0)
                    output_tokens += int(getattr(usage, "completion_tokens", 0) or 0)
                message = response.choices[0].message
                tool_calls = list(message.tool_calls or [])
                if not tool_calls:
                    reply = (message.content or "").strip()
                    if not reply:
                        raise AskError("The model returned an empty answer.", status_code=502)
                    return _result(choice, reply, input_tokens, output_tokens)
                transcript.append(_assistant_message(message, tool_calls))
                for call in tool_calls:
                    transcript.append(
                        {
                            "role": "tool",
                            "tool_call_id": call.id,
                            "content": _run_tool(client, conn, stored, call),
                        }
                    )
        except OpenAIError as exc:
            raise AskError(_public_error(exc), status_code=502) from exc
    raise AskError("The model did not finish an answer.", status_code=502)


def _result(choice: ChatChoice, reply: str, input_tokens: int, output_tokens: int) -> dict:
    cost = (
        input_tokens * choice["input_per_million"] + output_tokens * choice["output_per_million"]
    ) / 1_000_000
    return {
        "reply": reply,
        "model": choice["model"],
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost": round(cost, 8),
    }


def _choice(model: str) -> ChatChoice:
    for choice in CHOICES:
        if choice["model"] == model:
            return choice
    raise AskError("Choose one of the listed chat models.")


def _session(session_id: str) -> str:
    try:
        return parse_session_id(session_id)
    except ValueError as exc:
        raise AskError(str(exc)) from exc


def _document_id(document_id: str) -> str:
    try:
        return parse_document_id(document_id)
    except ValueError as exc:
        raise AskError(str(exc)) from exc


def _history(messages: list[dict]) -> list[dict]:
    if not messages:
        raise AskError("Send a message to start the chat.")
    if len(messages) > 24:
        raise AskError("This chat is too long. Start a new question about the document.")
    history: list[dict] = []
    for message in messages:
        role = message.get("role")
        content = message.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str) or not content.strip():
            raise AskError("Each message needs a role and some text.")
        if len(content) > 8000:
            raise AskError("A message is too long.")
        history.append({"role": role, "content": content.strip()})
    if history[-1]["role"] != "user":
        raise AskError("The latest message must be from you.")
    return history


def _assistant_message(message, tool_calls: list) -> dict:
    assistant: dict = {"role": "assistant"}
    if message.content:
        assistant["content"] = message.content
    assistant["tool_calls"] = []
    for call in tool_calls:
        function = getattr(call, "function", None)
        if function is None:
            assistant["tool_calls"].append(
                {"id": call.id, "type": "function", "function": {"name": "search_passages", "arguments": "{}"}}
            )
            continue
        assistant["tool_calls"].append(
            {
                "id": call.id,
                "type": "function",
                "function": {"name": function.name, "arguments": function.arguments or "{}"},
            }
        )
    return assistant


def _run_tool(client: OpenAI, conn, document: dict, call) -> str:
    function = getattr(call, "function", None)
    if function is None:
        return "That tool is not available."
    try:
        arguments = json.loads(function.arguments or "{}")
    except json.JSONDecodeError:
        return "The tool arguments were not valid JSON."
    if not isinstance(arguments, dict):
        return "The tool arguments were not an object."
    try:
        if function.name == "search_passages":
            query = arguments.get("query")
            if not isinstance(query, str) or not query.strip():
                return "Provide a query to search the document."
            return _search(client, conn, document, query.strip())
        if function.name == "read_passage":
            index = arguments.get("index")
            if isinstance(index, bool) or not isinstance(index, int):
                return "Provide the passage index to read."
            return _read(conn, document, index)
    except OpenAIError as exc:
        return _public_error(exc)
    except Exception:
        return "That lookup failed."
    return "That tool is not available."


def _search(client: OpenAI, conn, document: dict, query: str) -> str:
    vector = _embed_query(client, document["embedding_model"], int(document["dimensions"]), query)
    rows = conn.execute(
        """
        SELECT chunk_index, heading, body
        FROM chunks
        WHERE document_id = %s
        ORDER BY embedding <=> %s::vector
        LIMIT 4
        """,
        (document["id"], json.dumps(vector)),
    ).fetchall()
    if not rows:
        return "No passages are stored for this document."
    parts: list[str] = []
    for row in rows:
        body = row["body"]
        preview = body if len(body) <= _PREVIEW else body[:_PREVIEW] + "…"
        heading = row["heading"] or "No heading"
        parts.append(f"[{row['chunk_index']}] {heading}\n{preview}")
    return "\n\n".join(parts)


def _read(conn, document: dict, index: int) -> str:
    row = conn.execute(
        """
        SELECT heading, body
        FROM chunks
        WHERE document_id = %s AND chunk_index = %s
        """,
        (document["id"], index),
    ).fetchone()
    if row is None:
        return "That passage index is not in this document."
    body = row["body"]
    if len(body) > _PASSAGE_LIMIT:
        body = body[:_PASSAGE_LIMIT] + "…"
    heading = row["heading"] or "No heading"
    return f"[{index}] {heading}\n{body}"


def _embed_query(client: OpenAI, model: str, dimensions: int, text: str) -> list[float]:
    kwargs: dict = {"model": model, "input": text, "encoding_format": "float"}
    if model != "text-embedding-ada-002":
        kwargs["dimensions"] = dimensions
    response = client.embeddings.create(**kwargs)
    return list(response.data[0].embedding)


def _public_error(exc: OpenAIError) -> str:
    message = str(exc).lower()
    if "sk-" in message or "api key" in message or "401" in message:
        return "The OpenAI API key was rejected."
    if "429" in message:
        return "OpenAI rate-limited the request. Try again in a moment."
    if "model" in message and ("not found" in message or "does not exist" in message):
        return "That model is not available."
    return "The chat request failed."
