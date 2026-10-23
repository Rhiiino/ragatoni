// ragatoni/frontend/server/keelPageVisits.d.mts

import type { Plugin } from "vite";

export function requestPath(url: string | undefined): string;

export function isStaticPath(path: string): boolean;

export function isDocumentRequest(request: {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}): boolean;

export function classifyClient(userAgent: string | undefined): "mobile" | "desktop" | undefined;

export function extractTitle(html: string): string | undefined;

export function readIndexTitle(indexPath: string): string | undefined;

export function buildPayload(input: {
  path: string;
  title?: string;
  referrer?: string;
  client?: string;
}): Record<string, string>;

export function keelPageVisits(options: { token?: string; title?: string }): Plugin;
