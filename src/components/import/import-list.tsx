"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { orbForImport, PendingOrb } from "@/components/ui/pending";
import { formatDateTime } from "@/lib/format";
import { ACTION_LINK } from "@/lib/utils";
import type { ImportListItem } from "@/server/imports/list";
import { DeleteImport } from "./delete-import";

/** L'UI interroge l'état des imports toutes les 2 s tant que l'un d'eux attend (décision 4). */
export const POLL_INTERVAL_MS = 2000;

const isPending = (item: ImportListItem) => item.status === "queued" || item.status === "reading";

/** Recharge la liste une fois, ou toutes les 2 s ; renvoie la fonction d'arrêt. */
function keepLoading(apply: (items: ImportListItem[]) => void, { repeat }: { repeat: boolean }) {
  let stopped = false;
  async function load() {
    const response = await fetch("/api/imports", { cache: "no-store" });
    if (response.ok && !stopped) apply(await response.json());
  }
  const timer = repeat ? setInterval(() => void load(), POLL_INTERVAL_MS) : undefined;
  if (!repeat) void load();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** Orbe d'un import qui attend sa lecture, rien une fois la lecture finie. */
function ImportOrb({ item }: { item: ImportListItem }) {
  const state = orbForImport(item.status);
  return state && <PendingOrb state={state} />;
}

function RecropLink({ id }: { id: number }) {
  return (
    <Link href={`/imports/${id}/recadrer`} className={ACTION_LINK}>
      Recadrer la photo
    </Link>
  );
}

function ImportAction({ item, reload }: { item: ImportListItem; reload: () => void }) {
  if (item.roundId !== null) {
    return (
      <Link href={`/rounds/${item.roundId}`} className={ACTION_LINK}>
        Voir le round
      </Link>
    );
  }
  // Une lecture en cours ne se supprime pas (spec « Suppression d'un import »).
  if (item.status === "reading") return null;
  return (
    <span className="flex flex-wrap items-center gap-x-3">
      {/* Sans round, un import lu ou en échec se recadre (spec « Nouvelle lecture après recadrage »). */}
      {item.status === "ready" ? (
        <>
          <Link href={`/imports/${item.id}`} className={ACTION_LINK}>
            Vérifier
          </Link>
          <RecropLink id={item.id} />
        </>
      ) : null}
      {item.status === "failed" ? (
        <>
          <RecropLink id={item.id} />
          <Link href={`/imports/${item.id}`} className={ACTION_LINK}>
            Ouvrir l'écran de correction vide
          </Link>
        </>
      ) : null}
      <DeleteImport importId={item.id} onDone={reload} />
    </span>
  );
}

/**
 * Liste des imports avec leur état. `refreshKey` change quand un import vient d'être mis
 * en file, et `deletions` après une demande de suppression : la liste se recharge tout de
 * suite, puis toutes les 2 s tant qu'un import attend.
 */
export function ImportList({
  initial,
  refreshKey = 0,
}: {
  initial: ImportListItem[];
  refreshKey?: number;
}) {
  const [items, setItems] = useState(initial);
  const [deletions, setDeletions] = useState(0);
  const pending = items.some(isPending);

  useEffect(() => {
    if (refreshKey === 0 && deletions === 0) return;
    return keepLoading(setItems, { repeat: false });
  }, [refreshKey, deletions]);

  useEffect(() => {
    if (!pending) return;
    return keepLoading(setItems, { repeat: true });
  }, [pending]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="imports-title" className="flex flex-col gap-3">
      <h2 id="imports-title" className="font-heading text-lg font-semibold">
        Imports
      </h2>
      <ul aria-labelledby="imports-title" className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-sm"
          >
            <h3 className="font-medium">Import n°{item.id}</h3>
            <time
              dateTime={item.createdAt}
              className="text-muted-foreground"
              suppressHydrationWarning
            >
              {formatDateTime(new Date(item.createdAt))}
            </time>
            {/* Orbe seule, sans `role="status"` : le badge change déjà à chaque rafraîchissement. */}
            <ImportOrb item={item} />
            {/* Badge et action vont à la ligne ensemble, l'action toujours à droite. */}
            <span className="flex flex-auto flex-nowrap items-center gap-x-3">
              <Badge
                data-testid="import-status"
                variant={item.status === "failed" ? "destructive" : "secondary"}
              >
                {item.label}
              </Badge>
              <span className="ml-auto min-w-0">
                <ImportAction item={item} reload={() => setDeletions((count) => count + 1)} />
              </span>
            </span>
            {/* Ligne à part, sous le badge : la raison de l'échec quand aucun cadrage n'est trouvé. */}
            {item.panelNotFound ? (
              <p className="basis-full text-muted-foreground">Panneau introuvable sur la photo</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
