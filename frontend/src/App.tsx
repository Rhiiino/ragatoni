// rag-a-toni/frontend/src/App.tsx

import { useEffect, useRef, useState } from "react";

const logoUrl = new URL("./assets/ragatoni-logo.png", import.meta.url).href;

type HeldDocument = {
  name: string;
};

type Passage = {
  index: number;
  heading: string;
  filename: string;
  characters: number;
  text: string;
};

type ChunkSummary = {
  count: number;
  chunk_size: number;
  overlap: number;
  source_characters: number;
  shortest: number;
  longest: number;
  average: number;
};

type ChunkResult = {
  chunks: Passage[];
  summary: ChunkSummary;
};

type EmbedChoice = {
  id: string;
  model: string;
  dimensions: number;
  pricePerMillion: number;
};

type EmbeddedPassage = {
  index: number;
  heading: string;
  filename: string;
  dimensions: number;
  vector: number[];
};

type EmbedSummary = {
  model: string;
  dimensions: number;
  count: number;
  tokens: number;
  price_per_million: number;
  cost: number;
};

type EmbedResult = {
  embeddings: EmbeddedPassage[];
  summary: EmbedSummary;
};

type StoredDocument = {
  id: string;
  filename: string;
  embedding_model: string;
  dimensions: number;
  chunk_count: number;
  created_at: string;
};

type ChatChoice = {
  id: string;
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  cost?: number;
};

const EMBED_CHOICES: EmbedChoice[] = [
  { id: "text-embedding-3-small:1536", model: "text-embedding-3-small", dimensions: 1536, pricePerMillion: 0.02 },
  { id: "text-embedding-3-small:512", model: "text-embedding-3-small", dimensions: 512, pricePerMillion: 0.02 },
  { id: "text-embedding-3-large:3072", model: "text-embedding-3-large", dimensions: 3072, pricePerMillion: 0.13 },
  { id: "text-embedding-3-large:1024", model: "text-embedding-3-large", dimensions: 1024, pricePerMillion: 0.13 },
  { id: "text-embedding-ada-002:1536", model: "text-embedding-ada-002", dimensions: 1536, pricePerMillion: 0.1 },
];

const CHAT_CHOICES: ChatChoice[] = [
  { id: "gpt-5.4-mini", model: "gpt-5.4-mini", inputPerMillion: 0.75, outputPerMillion: 4.5 },
  { id: "gpt-5.4", model: "gpt-5.4", inputPerMillion: 2.5, outputPerMillion: 15 },
  { id: "gpt-5-mini", model: "gpt-5-mini", inputPerMillion: 0.25, outputPerMillion: 2 },
  { id: "gpt-5", model: "gpt-5", inputPerMillion: 1.25, outputPerMillion: 10 },
  { id: "gpt-4.1-mini", model: "gpt-4.1-mini", inputPerMillion: 0.4, outputPerMillion: 1.6 },
];

const SESSION_KEY = "rag_session_id";

function sessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

const STEPS = [
  { id: "upload", n: "01", title: "Upload", text: "Add a PDF, Markdown, or text file to start the pipeline." },
  { id: "extract", n: "02", title: "Extract", text: "Read the words out of the file you just uploaded." },
  { id: "chunk", n: "03", title: "Chunk", text: "Split that extracted text into overlapping passages." },
  { id: "embed", n: "04", title: "Embed", text: "Pick an embedding model to turn each chunk into a vector." },
  { id: "store", n: "05", title: "Store", text: "Save those vectors beside their passages for later search." },
  { id: "ask", n: "06", title: "Ask", text: "Ask a question and answer it from the stored passages." },
];

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneDepth = useRef(0);
  const onUpload = useRef(true);
  const [windowDrag, setWindowDrag] = useState(false);
  const [overZone, setOverZone] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [documentFile, setDocumentFile] = useState<HeldDocument | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractText, setExtractText] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState("800");
  const [chunkOverlap, setChunkOverlap] = useState("120");
  const [chunking, setChunking] = useState(false);
  const [chunkError, setChunkError] = useState<string | null>(null);
  const [chunkResult, setChunkResult] = useState<ChunkResult | null>(null);
  const [embedChoiceId, setEmbedChoiceId] = useState(EMBED_CHOICES[0].id);
  const [embedding, setEmbedding] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [embedResult, setEmbedResult] = useState<EmbedResult | null>(null);
  const [session] = useState(sessionId);
  const [storedDocs, setStoredDocs] = useState<StoredDocument[]>([]);
  const [storedLoaded, setStoredLoaded] = useState(false);
  const [choosingFile, setChoosingFile] = useState(false);
  const [selectedStoredId, setSelectedStoredId] = useState<string | null>(null);
  const [storing, setStoring] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storedDocument, setStoredDocument] = useState<StoredDocument | null>(null);
  const [askDocument, setAskDocument] = useState<StoredDocument | null>(null);
  const [chatChoiceId, setChatChoiceId] = useState(CHAT_CHOICES[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [canMove, setCanMove] = useState(false);
  const chatLogRef = useRef<HTMLDivElement>(null);

  onUpload.current = stepIndex === 0;

  useEffect(() => {
    if (stepIndex === 5) setCanMove(true);
  }, [stepIndex]);

  useEffect(() => {
    let depth = 0;

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      if (!onUpload.current) return;
      depth += 1;
      setWindowDrag(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      if (!onUpload.current) return;
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      if (!onUpload.current) return;
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setWindowDrag(false);
        setOverZone(false);
        zoneDepth.current = 0;
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      depth = 0;
      zoneDepth.current = 0;
      setWindowDrag(false);
      setOverZone(false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadStored() {
      try {
        const response = await fetch("/api/documents", {
          headers: { "X-Session-Id": session },
        });
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok && payload && Array.isArray(payload.documents)) {
          setStoredDocs(payload.documents as StoredDocument[]);
        }
      } catch {
        // A failed list leaves the drop zone in place.
      } finally {
        if (!cancelled) setStoredLoaded(true);
      }
    }
    void loadStored();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    const log = chatLogRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [messages, asking]);

  async function acceptDocument(file: File | undefined) {
    if (!file || stepIndex !== 0) return;
    setDocumentFile({ name: file.name });
    setExtractText(null);
    setExtractError(null);
    setChunkResult(null);
    setChunkError(null);
    setEmbedResult(null);
    setEmbedError(null);
    setChoosingFile(false);
    setStoredDocument(null);
    setStoreError(null);
    setAskDocument(null);
    setMessages([]);
    setAskError(null);
    setDraft("");
    setExtracting(true);
    setWindowDrag(false);
    setOverZone(false);
    zoneDepth.current = 0;
    setStepIndex(1);

    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/documents", { method: "POST", body });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null;
        setExtractError(detail ?? "The file could not be read.");
        return;
      }
      setExtractText(payload && typeof payload.text === "string" ? payload.text : "");
    } catch {
      setExtractError("The file could not be read.");
    } finally {
      setExtracting(false);
    }
  }

  async function runChunk() {
    if (extractText === null || chunking) return;
    const size = Number(chunkSize);
    const overlap = Number(chunkOverlap);
    if (!Number.isInteger(size) || size < 1) {
      setChunkError("Characters per chunk must be a whole number of at least 1.");
      return;
    }
    if (!Number.isInteger(overlap) || overlap < 0 || overlap >= size) {
      setChunkError("Overlap must be a whole number smaller than the chunk size.");
      return;
    }

    setChunking(true);
    setChunkError(null);
    try {
      const response = await fetch("/api/documents/chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: extractText,
          filename: documentFile?.name ?? "",
          chunk_size: size,
          overlap,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null;
        setChunkError(detail ?? "The text could not be chunked.");
        return;
      }
      if (!payload || !Array.isArray(payload.chunks) || !payload.summary) {
        setChunkError("The text could not be chunked.");
        return;
      }
      setChunkResult(payload as ChunkResult);
      setEmbedResult(null);
      setEmbedError(null);
    } catch {
      setChunkError("The text could not be chunked.");
    } finally {
      setChunking(false);
    }
  }

  async function runEmbed() {
    if (!chunkResult || embedding) return;
    const choice = EMBED_CHOICES.find((item) => item.id === embedChoiceId);
    if (!choice) return;

    setEmbedding(true);
    setEmbedError(null);
    try {
      const response = await fetch("/api/documents/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: choice.model,
          dimensions: choice.dimensions,
          chunks: chunkResult.chunks.map((passage) => ({
            index: passage.index,
            heading: passage.heading,
            filename: passage.filename,
            text: passage.text,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null;
        setEmbedError(detail ?? "The passages could not be embedded.");
        return;
      }
      if (!payload || !Array.isArray(payload.embeddings) || !payload.summary) {
        setEmbedError("The passages could not be embedded.");
        return;
      }
      setEmbedResult(payload as EmbedResult);
      setStoredDocument(null);
      setStoreError(null);
    } catch {
      setEmbedError("The passages could not be embedded.");
    } finally {
      setEmbedding(false);
    }
  }

  async function refreshStored() {
    try {
      const response = await fetch("/api/documents", {
        headers: { "X-Session-Id": session },
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload && Array.isArray(payload.documents)) {
        setStoredDocs(payload.documents as StoredDocument[]);
      }
    } catch {
      // The store screen already has the saved document for this visit.
    }
  }

  async function runStore() {
    if (!embedResult || !chunkResult || storing) return;
    const textByIndex = new Map(chunkResult.chunks.map((passage) => [passage.index, passage.text]));
    setStoring(true);
    setStoreError(null);
    setStoredDocument(null);
    setStepIndex(4);
    try {
      const response = await fetch("/api/documents/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": session,
        },
        body: JSON.stringify({
          filename: documentFile?.name ?? "",
          model: embedResult.summary.model,
          dimensions: embedResult.summary.dimensions,
          chunks: embedResult.embeddings.map((passage) => ({
            index: passage.index,
            heading: passage.heading,
            text: textByIndex.get(passage.index) ?? "",
            vector: passage.vector,
          })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null;
        setStoreError(detail ?? "The document could not be stored.");
        return;
      }
      if (!payload || typeof payload.id !== "string") {
        setStoreError("The document could not be stored.");
        return;
      }
      const saved = payload as StoredDocument;
      setStoredDocument(saved);
      setAskDocument(saved);
      setMessages([]);
      setAskError(null);
      setDraft("");
      void refreshStored();
    } catch {
      setStoreError("The document could not be stored.");
    } finally {
      setStoring(false);
    }
  }

  function openStoredAsk() {
    const saved = storedDocs.find((item) => item.id === selectedStoredId);
    if (!saved) return;
    setDocumentFile({ name: saved.filename });
    setAskDocument(saved);
    setMessages([]);
    setAskError(null);
    setDraft("");
    setStepIndex(5);
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || asking || !askDocument) return;
    const choice = CHAT_CHOICES.find((item) => item.id === chatChoiceId);
    if (!choice) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setAsking(true);
    setAskError(null);
    try {
      const response = await fetch("/api/documents/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": session,
        },
        body: JSON.stringify({
          document_id: askDocument.id,
          model: choice.model,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = payload && typeof payload.detail === "string" ? payload.detail : null;
        setAskError(detail ?? "The reply could not be written.");
        return;
      }
      if (!payload || typeof payload.reply !== "string") {
        setAskError("The reply could not be written.");
        return;
      }
      setMessages([
        ...next,
        {
          role: "assistant",
          content: payload.reply,
          cost: typeof payload.cost === "number" ? payload.cost : undefined,
        },
      ]);
    } catch {
      setAskError("The reply could not be written.");
    } finally {
      setAsking(false);
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function onZoneDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    zoneDepth.current += 1;
    setOverZone(true);
  }

  function onZoneDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    zoneDepth.current -= 1;
    if (zoneDepth.current <= 0) {
      zoneDepth.current = 0;
      setOverZone(false);
    }
  }

  function onZoneDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    zoneDepth.current = 0;
    setOverZone(false);
    setWindowDrag(false);
    acceptDocument(event.dataTransfer.files[0]);
  }

  function goToStep(index: number) {
    setChoosingFile(false);
    setStepIndex(index);
  }

  const step = STEPS[stepIndex];
  const savedRecord = storedDocument ?? askDocument;
  const uploading = stepIndex === 0;
  const dropTitle = overZone
    ? "Release to upload"
    : windowDrag
      ? "Drop it in this panel"
      : "Drop a document here";
  const dropHint = overZone
    ? "One document moves the page to Extract."
    : windowDrag
      ? "Release over the highlighted panel."
      : "One document · PDF, Markdown, or plain text";

  return (
    <div className={uploading && windowDrag ? "shell is-dragging" : "shell"}>
      <header className="site-header">
        <div className="site-header-inner">
          <p className="site-brand">
            <Wordmark />
          </p>
        </div>
      </header>
      <main className="main">
        <header className="intro">
          <h1>
            <Wordmark title />
          </h1>
          <p className="app-name">Try out retrieval-augmented generation&nbsp;!</p>
        </header>

        <ol className={canMove ? "steps can-move" : "steps"} aria-label="Pipeline">
          {STEPS.map((item, index) => (
            <li
              key={item.id}
              className={index === stepIndex ? "step current" : "step"}
              aria-current={canMove ? undefined : index === stepIndex ? "step" : undefined}
            >
              {canMove ? (
                <button
                  type="button"
                  className="step-jump"
                  aria-current={index === stepIndex ? "step" : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span className="step-index">{item.n}</span>
                  <span className="step-title">{item.title}</span>
                </button>
              ) : (
                <>
                  <span className="step-index">{item.n}</span>
                  <span className="step-title">{item.title}</span>
                </>
              )}
            </li>
          ))}
        </ol>

        {uploading ? (
          <>
            <input
              ref={inputRef}
              className="file-input"
              type="file"
              accept=".pdf,.txt,.md,.markdown,.docx,text/plain,text/markdown,application/pdf"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                acceptDocument(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            {!storedLoaded ? (
              <div className="library-actions">
                <p className="drop-hint">Checking saved documents…</p>
              </div>
            ) : storedDocs.length > 0 && choosingFile ? (
              <section className="step-panel" aria-label="Saved documents">
                <div className="step-head">
                  <div>
                    <p className="step-kicker">01</p>
                    <h2>Choose file</h2>
                  </div>
                  <button
                    type="button"
                    className="continue"
                    disabled={selectedStoredId === null}
                    onClick={openStoredAsk}
                  >
                    Continue
                  </button>
                </div>
                <p>Pick a document already stored for this session.</p>
                <button type="button" className="back-link" onClick={() => setChoosingFile(false)}>
                  Back
                </button>
                <ul className="file-list">
                  {storedDocs.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className={doc.id === selectedStoredId ? "file-choice is-selected" : "file-choice"}
                        aria-pressed={doc.id === selectedStoredId}
                        onClick={() => setSelectedStoredId(doc.id)}
                      >
                        <span className="file-name">{doc.filename}</span>
                        <span className="file-meta">
                          {doc.chunk_count} {doc.chunk_count === 1 ? "passage" : "passages"} · {doc.embedding_model}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : storedDocs.length > 0 ? (
              <section className="library-actions" aria-label="Start">
                <div className="library-lead">
                  <p className="library-kicker">This session</p>
                  <h2>Continue or start fresh</h2>
                  <p>Upload a new file, or open a document already stored for this session.</p>
                </div>
                <div className="library-buttons">
                  <button type="button" className="library-button" onClick={openPicker}>
                    <UploadIcon />
                    Upload
                  </button>
                  <button type="button" className="library-button is-secondary" onClick={() => setChoosingFile(true)}>
                    <FolderIcon />
                    Choose file
                  </button>
                </div>
              </section>
            ) : (
              <div
                className={
                  overZone ? "drop is-hot is-over" : windowDrag ? "drop is-hot" : "drop"
                }
                role="button"
                tabIndex={0}
                aria-label="Drop one document here, or press Enter to browse"
                onClick={openPicker}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPicker();
                  }
                }}
                onDragEnter={onZoneDragEnter}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={onZoneDragLeave}
                onDrop={onZoneDrop}
              >
                <span className="upload-medallion" aria-hidden="true">
                  <UploadIcon />
                </span>
                <p className="drop-title">{dropTitle}</p>
                <p className="drop-hint">{dropHint}</p>
              </div>
            )}
          </>
        ) : (
          <section className="step-panel" aria-live="polite" aria-busy={extracting || chunking || embedding || storing || asking}>
            <div className="step-head">
              <div>
                <p className="step-kicker">{step.n}</p>
                <h2>{step.title}</h2>
              </div>
              {stepIndex === 1 && (
                <button type="button" className="continue" onClick={() => setStepIndex(2)}>
                  Continue
                </button>
              )}
              {stepIndex === 2 && (
                <button
                  type="button"
                  className="continue"
                  disabled={chunkResult === null}
                  onClick={() => setStepIndex(3)}
                >
                  Continue
                </button>
              )}
              {stepIndex === 3 && (
                <button
                  type="button"
                  className="continue"
                  disabled={embedResult === null || storing}
                  onClick={() => {
                    void runStore();
                  }}
                >
                  Continue
                </button>
              )}
              {stepIndex === 4 && (
                <button
                  type="button"
                  className="continue"
                  disabled={storing || savedRecord === null}
                  onClick={() => setStepIndex(5)}
                >
                  Continue
                </button>
              )}
            </div>
            <p>{step.text}</p>
            {documentFile && <p className="held-doc">{documentFile.name}</p>}
            {stepIndex === 1 && extracting && <p className="extract-status">Reading the file…</p>}
            {stepIndex === 1 && extractError && <p className="extract-error">{extractError}</p>}
            {stepIndex === 1 && extractText !== null && (
              <div className="extract-sheet">
                <div className="extract-sheet-bar">
                  <span>Extracted text</span>
                  <span>{extractText.length.toLocaleString()} characters</span>
                </div>
                <pre className="extract-text">{extractText}</pre>
              </div>
            )}
            {stepIndex === 2 && (
              <>
                <form
                  className="chunk-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runChunk();
                  }}
                >
                  <label className="chunk-field">
                    Characters per chunk
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={chunkSize}
                      onChange={(event) => setChunkSize(event.target.value)}
                    />
                  </label>
                  <label className="chunk-field">
                    Overlap
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={chunkOverlap}
                      onChange={(event) => setChunkOverlap(event.target.value)}
                    />
                  </label>
                  <button type="submit" className="chunk-run" disabled={chunking || extractText === null}>
                    {chunking ? "Chunking…" : "Chunk"}
                  </button>
                </form>
                {extractText === null && (
                  <p className="chunk-error">Extract a document before chunking.</p>
                )}
                {chunkError && <p className="chunk-error">{chunkError}</p>}
                {chunkResult && (
                  <>
                    <ul className="chunk-summary">
                      <li className="chunk-stat">
                        <span>Chunks</span>
                        <strong>{chunkResult.summary.count}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Source characters</span>
                        <strong>{chunkResult.summary.source_characters}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Shortest</span>
                        <strong>{chunkResult.summary.shortest}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Longest</span>
                        <strong>{chunkResult.summary.longest}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Average</span>
                        <strong>{chunkResult.summary.average}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Size</span>
                        <strong>{chunkResult.summary.chunk_size}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Overlap</span>
                        <strong>{chunkResult.summary.overlap}</strong>
                      </li>
                    </ul>
                    <ol className="chunk-list">
                      {chunkResult.chunks.map((passage) => (
                        <li key={passage.index} className="chunk-card">
                          <header>
                            <span className="chunk-index">{String(passage.index).padStart(2, "0")}</span>
                            <span className="chunk-heading">{passage.heading || "No heading"}</span>
                            <span className="chunk-count">{passage.characters} characters</span>
                          </header>
                          <pre className="chunk-text">{passage.text}</pre>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}
            {stepIndex === 3 && (
              <>
                <form
                  className="embed-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runEmbed();
                  }}
                >
                  <div className="embed-field">
                    <span id="embed-model-label">Embedding model</span>
                    <EmbedModelMenu
                      choiceId={embedChoiceId}
                      onChange={(id) => {
                        setEmbedChoiceId(id);
                        setEmbedResult(null);
                        setEmbedError(null);
                      }}
                    />
                  </div>
                  <button type="submit" className="chunk-run" disabled={embedding || chunkResult === null}>
                    {embedding ? "Embedding…" : "Embed"}
                  </button>
                </form>
                {chunkResult === null && (
                  <p className="chunk-error">Chunk a document before embedding.</p>
                )}
                {embedError && <p className="chunk-error">{embedError}</p>}
                {embedResult && (
                  <>
                    <ul className="chunk-summary">
                      <li className="chunk-stat">
                        <span>Chunks</span>
                        <strong>{embedResult.summary.count}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Dimensions</span>
                        <strong>{embedResult.summary.dimensions.toLocaleString("en-US")}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Tokens</span>
                        <strong>{embedResult.summary.tokens.toLocaleString("en-US")}</strong>
                      </li>
                      <li className="chunk-stat">
                        <span>Cost</span>
                        <strong>{formatCost(embedResult.summary.cost)}</strong>
                      </li>
                    </ul>
                    <ol className="chunk-list">
                      {embedResult.embeddings.map((passage) => (
                        <li key={passage.index} className="chunk-card">
                          <header>
                            <span className="chunk-index">{String(passage.index).padStart(2, "0")}</span>
                            <span className="chunk-heading">{passage.heading || "No heading"}</span>
                            <span className="chunk-count">
                              First 8 of {passage.dimensions.toLocaleString("en-US")}
                            </span>
                          </header>
                          <p className="embed-preview">{vectorPreview(passage.vector)}</p>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            )}
            {stepIndex === 4 && (
              <div className="store-mark">
                {storeError ? (
                  <>
                    <p className="chunk-error">{storeError}</p>
                    <button type="button" className="chunk-run" onClick={() => void runStore()}>
                      Try again
                    </button>
                  </>
                ) : (
                  <>
                    {(storing || savedRecord) && (
                      <span className="check-medallion" aria-hidden="true">
                        <svg viewBox="0 0 72 72" className="icon check">
                          <circle cx="36" cy="36" r="28" />
                          <path d="M22 37.5 32 47.5 51 26.5" />
                        </svg>
                      </span>
                    )}
                    <p className="store-label">
                      {storing && storedDocument === null ? "Storing…" : savedRecord ? "Stored" : "Nothing stored yet"}
                    </p>
                    {savedRecord && !(storing && storedDocument === null) && (
                      <p className="store-detail">
                        {savedRecord.chunk_count} {savedRecord.chunk_count === 1 ? "passage" : "passages"} from {savedRecord.filename}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            {stepIndex === 5 && (
              <>
                <form className="embed-form" onSubmit={(event) => event.preventDefault()}>
                  <div className="embed-field">
                    <span id="chat-model-label">Chat model</span>
                    <ChatModelMenu choiceId={chatChoiceId} onChange={setChatChoiceId} />
                  </div>
                </form>
                {askDocument === null && (
                  <p className="chunk-error">Store a document before asking.</p>
                )}
                <div className="chat-log" ref={chatLogRef}>
                  {messages.map((message, index) => (
                    <article
                      key={`${message.role}-${index}`}
                      className={message.role === "user" ? "chat-bubble is-user" : "chat-bubble"}
                    >
                      <p>{message.content}</p>
                      {message.role === "assistant" && message.cost !== undefined && (
                        <p className="chat-cost">This reply {formatCost(message.cost)}</p>
                      )}
                    </article>
                  ))}
                  {asking && <p className="chat-status">Writing…</p>}
                </div>
                {askError && <p className="chunk-error">{askError}</p>}
                <form
                  className="chat-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage();
                  }}
                >
                  <input
                    value={draft}
                    placeholder="Ask about this document"
                    disabled={asking || askDocument === null}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button type="submit" className="chunk-run" disabled={asking || askDocument === null || draft.trim() === ""}>
                    {asking ? "Sending…" : "Send"}
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <p className="footer-name">RAG-a-toni</p>
            <p className="footer-note">A step-by-step look at retrieval-augmented generation.</p>
          </div>
          <p className="footer-meta">Upload · Extract · Chunk · Embed · Store · Ask</p>
        </div>
      </footer>
    </div>
  );
}

function formatModelPrice(price: number) {
  return `$${price.toFixed(2)} / 1M tokens`;
}

function formatChatPrice(input: number, output: number) {
  return `$${input.toFixed(2)} in · $${output.toFixed(2)} out / 1M`;
}

function formatCost(cost: number) {
  if (cost >= 0.01) return `$${cost.toFixed(2)}`;
  if (cost <= 0) return "$0.00";
  const digits = Math.min(8, Math.ceil(-Math.log10(cost)) + 1);
  return `$${cost.toFixed(digits)}`;
}

function vectorPreview(vector: number[]) {
  const head = vector.slice(0, 8).map((value) => value.toFixed(4));
  return head.join("  ") + (vector.length > 8 ? " …" : "");
}

function EmbedModelMenu({
  choiceId,
  onChange,
}: {
  choiceId: string;
  onChange: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = EMBED_CHOICES.find((item) => item.id === choiceId) ?? EMBED_CHOICES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function openMenu() {
    const index = EMBED_CHOICES.findIndex((item) => item.id === choiceId);
    setActive(index < 0 ? 0 : index);
    setOpen(true);
  }

  function choose(index: number) {
    const choice = EMBED_CHOICES[index];
    if (!choice) return;
    onChange(choice.id);
    setOpen(false);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (!open && (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % EMBED_CHOICES.length);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + EMBED_CHOICES.length) % EMBED_CHOICES.length);
    } else if (key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (key === "End") {
      event.preventDefault();
      setActive(EMBED_CHOICES.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="model-menu" ref={rootRef}>
      <button
        type="button"
        className={open ? "model-trigger is-open" : "model-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Embedding model, ${selected.model}, ${selected.dimensions.toLocaleString("en-US")} dimensions, ${formatModelPrice(selected.pricePerMillion)}`}
        aria-controls="embed-model-list"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="model-name">{selected.model}</span>
        <span className="model-dims">{selected.dimensions.toLocaleString("en-US")} dimensions</span>
        <span className="model-price">{formatModelPrice(selected.pricePerMillion)}</span>
        <span className="model-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul
          className="model-list"
          id="embed-model-list"
          role="listbox"
          aria-labelledby="embed-model-label"
          aria-activedescendant={`embed-option-${active}`}
        >
          {EMBED_CHOICES.map((choice, index) => (
            <li key={choice.id} role="presentation">
              <button
                type="button"
                id={`embed-option-${index}`}
                className={
                  choice.id === choiceId
                    ? index === active
                      ? "model-option is-selected is-active"
                      : "model-option is-selected"
                    : index === active
                      ? "model-option is-active"
                      : "model-option"
                }
                role="option"
                aria-selected={choice.id === choiceId}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span className="model-name">{choice.model}</span>
                <span className="model-dims">{choice.dimensions.toLocaleString("en-US")} dimensions</span>
                <span className="model-price">{formatModelPrice(choice.pricePerMillion)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatModelMenu({
  choiceId,
  onChange,
}: {
  choiceId: string;
  onChange: (id: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = CHAT_CHOICES.find((item) => item.id === choiceId) ?? CHAT_CHOICES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function openMenu() {
    const index = CHAT_CHOICES.findIndex((item) => item.id === choiceId);
    setActive(index < 0 ? 0 : index);
    setOpen(true);
  }

  function choose(index: number) {
    const choice = CHAT_CHOICES[index];
    if (!choice) return;
    onChange(choice.id);
    setOpen(false);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (!open && (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ")) {
      event.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % CHAT_CHOICES.length);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + CHAT_CHOICES.length) % CHAT_CHOICES.length);
    } else if (key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (key === "End") {
      event.preventDefault();
      setActive(CHAT_CHOICES.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const price = formatChatPrice(selected.inputPerMillion, selected.outputPerMillion);

  return (
    <div className="model-menu is-chat" ref={rootRef}>
      <button
        type="button"
        className={open ? "model-trigger is-open" : "model-trigger"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chat model, ${selected.model}, ${price}`}
        aria-controls="chat-model-list"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="model-name">{selected.model}</span>
        <span className="model-price">{price}</span>
        <span className="model-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul
          className="model-list"
          id="chat-model-list"
          role="listbox"
          aria-labelledby="chat-model-label"
          aria-activedescendant={`chat-option-${active}`}
        >
          {CHAT_CHOICES.map((choice, index) => (
            <li key={choice.id} role="presentation">
              <button
                type="button"
                id={`chat-option-${index}`}
                className={
                  choice.id === choiceId
                    ? index === active
                      ? "model-option is-selected is-active"
                      : "model-option is-selected"
                    : index === active
                      ? "model-option is-active"
                      : "model-option"
                }
                role="option"
                aria-selected={choice.id === choiceId}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span className="model-name">{choice.model}</span>
                <span className="model-price">{formatChatPrice(choice.inputPerMillion, choice.outputPerMillion)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Wordmark({ title = false }: { title?: boolean }) {
  return (
    <img
      className={title ? "logo logo-title" : "logo logo-header"}
      src={logoUrl}
      alt={title ? "RAG-a-toni" : ""}
    />
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 48 48" className="icon upload" aria-hidden="true">
      <path
        d="M24 31V15m0 0-6.5 6.5M24 15l6.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 28.5v3.2A4.3 4.3 0 0 0 18.3 36h11.4a4.3 4.3 0 0 0 4.3-4.3v-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 48 48" className="icon folder" aria-hidden="true">
      <path
        d="M8.5 18.5v15a3.5 3.5 0 0 0 3.5 3.5h24a3.5 3.5 0 0 0 3.5-3.5v-12a3.5 3.5 0 0 0-3.5-3.5H24.2L20.4 14a3.5 3.5 0 0 0-2.6-1.2H12a3.5 3.5 0 0 0-3.5 3.5v2.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
