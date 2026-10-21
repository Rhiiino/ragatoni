// rag-a-toni/frontend/server/keelPageVisits.mjs

import fs from "node:fs";

const DEFAULT_INGEST_URL = "https://api.keelium.net/services/ingest";
const TIMEOUT_MS = 3000;

const STATIC_EXTENSIONS = new Set([
  ".js",
  ".css",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".glb",
  ".json",
  ".wasm",
  ".txt",
  ".xml",
  ".webmanifest",
  ".mp4",
  ".mp3",
  ".pdf",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
]);

let missingTokenWarned = false;

export function requestPath(url) {
  const raw = (url ?? "/").split("?")[0]?.split("#")[0] ?? "/";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  let path = decoded.trim();
  if (!path) {
    path = "/";
  }
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  if (path.length > 2048) {
    path = path.slice(0, 2048);
  }
  return path;
}

function extensionOf(path) {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot).toLowerCase();
}

export function isStaticPath(path) {
  return STATIC_EXTENSIONS.has(extensionOf(path));
}

function headerValue(headers, name) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function headerPresent(headers, name) {
  return headers[name] !== undefined || headers[name.toLowerCase()] !== undefined;
}

export function isDocumentRequest(request) {
  if ((request.method ?? "GET").toUpperCase() !== "GET") {
    return false;
  }
  if (headerValue(request.headers, "upgrade")) {
    return false;
  }
  const path = requestPath(request.url);
  if (isStaticPath(path)) {
    return false;
  }
  if (
    path === "/health" ||
    path.startsWith("/health/") ||
    path.startsWith("/@") ||
    path.startsWith("/__vite") ||
    path === "/src" ||
    path.startsWith("/src/") ||
    path === "/node_modules" ||
    path.startsWith("/node_modules/") ||
    path.includes("/node_modules/")
  ) {
    return false;
  }
  const purpose = [headerValue(request.headers, "purpose"), headerValue(request.headers, "sec-purpose")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (purpose.includes("prefetch")) {
    return false;
  }
  const destPresent = headerPresent(request.headers, "sec-fetch-dest");
  const modePresent = headerPresent(request.headers, "sec-fetch-mode");
  if (destPresent || modePresent) {
    return (
      headerValue(request.headers, "sec-fetch-dest") === "document" &&
      headerValue(request.headers, "sec-fetch-mode") === "navigate"
    );
  }
  return (headerValue(request.headers, "accept") ?? "").toLowerCase().includes("text/html");
}

export function classifyClient(userAgent) {
  if (!userAgent?.trim()) {
    return undefined;
  }
  const ua = userAgent.toLowerCase();
  const mobileMarkers = [
    "mobi",
    "android",
    "iphone",
    "ipad",
    "ipod",
    "webos",
    "blackberry",
    "iemobile",
    "opera mini",
  ];
  if (mobileMarkers.some((marker) => ua.includes(marker))) {
    return "mobile";
  }
  if (["mozilla", "chrome", "safari", "firefox", "edg"].some((marker) => ua.includes(marker))) {
    return "desktop";
  }
  return undefined;
}

export function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) {
    return undefined;
  }
  const title = match[1].replace(/\s+/g, " ").trim();
  if (!title) {
    return undefined;
  }
  return title.slice(0, 300);
}

export function readIndexTitle(indexPath) {
  try {
    return extractTitle(fs.readFileSync(indexPath, "utf8"));
  } catch {
    return undefined;
  }
}

export function buildPayload(input) {
  const path = input.path.trim().slice(0, 2048) || "/";
  const body = { path };
  const title = input.title?.trim();
  if (title) {
    body.title = title.slice(0, 300);
  }
  const referrer = input.referrer?.trim();
  if (referrer) {
    body.referrer = referrer.slice(0, 2048);
  }
  if (input.client === "mobile" || input.client === "desktop") {
    body.client = input.client;
  }
  return body;
}

function ingestUrl() {
  const configured = process.env.KEEL_INGEST_URL?.trim();
  return configured || DEFAULT_INGEST_URL;
}

function warnMissingToken() {
  if (missingTokenWarned) {
    return;
  }
  missingTokenWarned = true;
  console.warn("Keel page visits disabled: KEEL_INGEST_TOKEN is not set");
}

function sendVisit(token, payload) {
  void fetch(ingestUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((response) => {
      if (!response.ok) {
        console.warn(`Keel ingest failed: HTTP ${response.status}`);
      }
    })
    .catch((error) => {
      const name = error instanceof Error ? error.name : "Error";
      console.warn(`Keel ingest failed: ${name}`);
    });
}

function reportPageVisit(request, options) {
  try {
    if (!isDocumentRequest(request)) {
      return;
    }
    const token = options.token?.trim();
    if (!token) {
      warnMissingToken();
      return;
    }
    const payload = buildPayload({
      path: requestPath(request.url),
      title: options.title,
      referrer: headerValue(request.headers, "referer"),
      client: classifyClient(headerValue(request.headers, "user-agent")),
    });
    sendVisit(token, payload);
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.warn(`Keel ingest failed: ${name}`);
  }
}

export function keelPageVisits(options) {
  const attach = (middlewares) => {
    middlewares.use((req, _res, next) => {
      // Snapshot the URL first. Vite's HTML fallback rewrites it to /index.html before next() returns.
      const url = req.url;
      next();
      reportPageVisit({ method: req.method, url, headers: req.headers }, options);
    });
  };

  return {
    name: "keel-page-visits",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
