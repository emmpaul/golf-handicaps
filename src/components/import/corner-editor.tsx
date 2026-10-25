"use client";

import { type PointerEvent, useRef } from "react";
import type { Corners } from "@/ocr/corners";

type Corner = keyof Corners;

const HANDLES: { corner: Corner; label: string }[] = [
  { corner: "topLeft", label: "Coin haut gauche" },
  { corner: "topRight", label: "Coin haut droit" },
  { corner: "bottomRight", label: "Coin bas droit" },
  { corner: "bottomLeft", label: "Coin bas gauche" },
];

/** Poignées pré-placées un peu à l'intérieur de la photo. */
export const INITIAL_CORNERS: Corners = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
const KEY_STEP = 0.002;
const KEY_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-KEY_STEP, 0],
  ArrowRight: [KEY_STEP, 0],
  ArrowUp: [0, -KEY_STEP],
  ArrowDown: [0, KEY_STEP],
};

/**
 * Éditeur des 4 coins du panneau : poignées de 44 px déplaçables au doigt, au stylet ou à la
 * souris (pointer events), et aux flèches du clavier. Coordonnées normalisées entre 0 et 1.
 */
export function CornerEditor({
  photoUrl,
  corners,
  onChange,
}: {
  photoUrl: string;
  corners: Corners;
  onChange: (corners: Corners) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  // Écart entre le pointeur et le centre de la poignée saisie, pour qu'elle ne saute pas.
  const grab = useRef<{ corner: Corner; dx: number; dy: number } | null>(null);

  function pointAt(event: PointerEvent) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }

  function start(corner: Corner, event: PointerEvent<HTMLButtonElement>) {
    const point = pointAt(event);
    if (!point) return;
    try {
      // La capture garde le suivi du doigt hors de la poignée ; sans elle, le glisser marche.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointeur inconnu du navigateur (WebKit refuse alors la capture).
    }
    grab.current = { corner, dx: point.x - corners[corner].x, dy: point.y - corners[corner].y };
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const point = pointAt(event);
    if (!grab.current || !point) return;
    const { corner, dx, dy } = grab.current;
    onChange({ ...corners, [corner]: { x: clamp(point.x - dx), y: clamp(point.y - dy) } });
  }

  function nudge(corner: Corner, key: string) {
    const step = KEY_MOVES[key];
    if (!step) return false;
    const { x, y } = corners[corner];
    onChange({ ...corners, [corner]: { x: clamp(x + step[0]), y: clamp(y + step[1]) } });
    return true;
  }

  const outline = HANDLES.map(
    ({ corner }) => `${corners[corner].x * 100},${corners[corner].y * 100}`,
  );

  return (
    <div className="w-fit max-w-full rounded-lg bg-muted p-[22px]">
      <div ref={frame} className="relative w-fit max-w-full touch-none select-none">
        {/* biome-ignore lint/performance/noImgElement: photo locale (blob), pas d'optimisation Next. */}
        <img
          src={photoUrl}
          alt="Carte à cadrer"
          draggable={false}
          className="block max-h-[70vh] w-auto max-w-full"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <polygon
            points={outline.join(" ")}
            className="fill-primary/10 stroke-primary"
            strokeWidth={0.4}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {HANDLES.map(({ corner, label }) => (
          <button
            key={corner}
            type="button"
            aria-label={label}
            data-corner={corner}
            className="absolute size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-primary bg-background/40 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring active:cursor-grabbing"
            style={{ left: `${corners[corner].x * 100}%`, top: `${corners[corner].y * 100}%` }}
            onPointerDown={(event) => start(corner, event)}
            onPointerMove={move}
            onPointerUp={() => {
              grab.current = null;
            }}
            onPointerCancel={() => {
              grab.current = null;
            }}
            onKeyDown={(event) => {
              if (nudge(corner, event.key)) event.preventDefault();
            }}
          >
            <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
