"use client";

import { useState } from "react";
import type { ImportListItem } from "@/server/imports/list";
import { ImportFlow } from "./import-flow";
import { ImportList } from "./import-list";

/** Envoi des photos et liste des imports, rechargée à chaque mise en file. */
export function ImportWorkspace({ imports }: { imports: ImportListItem[] }) {
  const [queued, setQueued] = useState(0);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      <ImportFlow onQueued={() => setQueued((count) => count + 1)} />
      <ImportList initial={imports} refreshKey={queued} />
    </div>
  );
}
