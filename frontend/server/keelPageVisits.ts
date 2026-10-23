// ragatoni/frontend/server/keelPageVisits.ts

import type { Plugin } from "vite";
import { keelPageVisits as createKeelPageVisits, readIndexTitle as readTitle } from "./keelPageVisits.mjs";

type KeelPageVisitOptions = {
  token?: string;
  title?: string;
};

export function readIndexTitle(indexPath: string): string | undefined {
  return readTitle(indexPath);
}

export function keelPageVisits(options: KeelPageVisitOptions): Plugin {
  return createKeelPageVisits(options);
}
