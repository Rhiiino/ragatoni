# ragatoni/backend/src/pipeline/02_chunk.py

"""Step 2: split extracted text into chunks and attach metadata (index, heading, filename)."""

_SEPARATORS = ["\n\n", "\n", ". ", " ", ""]


def chunk_text(text: str, chunk_size: int, overlap: int, filename: str) -> dict:
    if chunk_size < 1:
        raise ValueError("Characters per chunk must be at least 1.")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("Overlap must be zero or more and smaller than the chunk size.")

    pieces = _split_text(text, _SEPARATORS, chunk_size, overlap)
    headings = _headings(text)
    chunks: list[dict] = []
    cursor = 0
    for piece in pieces:
        start = text.find(piece, max(0, cursor - overlap - chunk_size))
        if start < 0:
            start = text.find(piece)
        if start < 0:
            start = cursor
        chunks.append(
            {
                "index": len(chunks) + 1,
                "heading": _heading_at(headings, start),
                "filename": filename,
                "characters": len(piece),
                "text": piece,
            }
        )
        cursor = start + 1

    lengths = [chunk["characters"] for chunk in chunks]
    count = len(chunks)
    return {
        "chunks": chunks,
        "summary": {
            "count": count,
            "chunk_size": chunk_size,
            "overlap": overlap,
            "source_characters": len(text),
            "shortest": min(lengths) if lengths else 0,
            "longest": max(lengths) if lengths else 0,
            "average": round(sum(lengths) / count) if count else 0,
        },
    }


def _split_text(text: str, separators: list[str], chunk_size: int, overlap: int) -> list[str]:
    separator = separators[-1]
    rest: list[str] = []
    for index, candidate in enumerate(separators):
        if candidate == "":
            separator = candidate
            break
        if candidate in text:
            separator = candidate
            rest = separators[index + 1 :]
            break

    splits = list(text) if separator == "" else text.split(separator)
    chunks: list[str] = []
    good: list[str] = []
    for piece in splits:
        if len(piece) <= chunk_size:
            good.append(piece)
            continue
        if good:
            chunks.extend(_merge(good, separator, chunk_size, overlap))
            good = []
        if not rest:
            chunks.append(piece)
        else:
            chunks.extend(_split_text(piece, rest, chunk_size, overlap))
    if good:
        chunks.extend(_merge(good, separator, chunk_size, overlap))
    return chunks


def _merge(splits: list[str], separator: str, chunk_size: int, overlap: int) -> list[str]:
    sep_len = len(separator)
    docs: list[str] = []
    current: list[str] = []
    total = 0
    for piece in splits:
        piece_len = len(piece)
        extra = sep_len if current else 0
        if total + piece_len + extra > chunk_size:
            if current:
                docs.append(separator.join(current))
                while total > overlap or (
                    total + piece_len + (sep_len if current else 0) > chunk_size and total > 0
                ):
                    if not current:
                        break
                    total -= len(current[0]) + (sep_len if len(current) > 1 else 0)
                    current = current[1:]
        current.append(piece)
        total += piece_len + (sep_len if len(current) > 1 else 0)
    if current:
        joined = separator.join(current)
        if joined:
            docs.append(joined)
    return docs


def _headings(text: str) -> list[tuple[int, str]]:
    found: list[tuple[int, str]] = []
    position = 0
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped and len(stripped) <= 40 and stripped[-1] not in ".!?":
            found.append((position, stripped))
        position += len(line) + 1
    return found


def _heading_at(headings: list[tuple[int, str]], start: int) -> str:
    current = ""
    for position, name in headings:
        if position <= start:
            current = name
        else:
            break
    return current
