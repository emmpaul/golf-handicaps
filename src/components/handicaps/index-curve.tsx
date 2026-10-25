"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIndexTick, indexAxis } from "./index-axis";

export type CurvePoint = { label: string; index: number };

const TICK = { fontSize: 12, fill: "var(--muted-foreground)" };

/**
 * Courbe de l'index d'un joueur : un point par round, l'index juste après ce round. Trait d'encre
 * de 2 px en segments droits (aucune valeur inventée entre deux rounds), graduations rondes au
 * dixième avec virgule, grille en filets pleins.
 */
export function IndexCurve({ name, points }: { name: string; points: CurvePoint[] }) {
  const axis = indexAxis(points.map((point) => point.index));
  return (
    <figure
      aria-label={`Courbe de l'index de ${name}`}
      className="h-48 w-full min-w-0 lg:h-full lg:min-h-48"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-rule)" />
          <XAxis
            dataKey="label"
            tick={TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--color-ink)" }}
          />
          <YAxis
            tick={TICK}
            tickLine={false}
            axisLine={false}
            domain={axis.domain}
            ticks={axis.ticks}
            interval={0}
            tickFormatter={formatIndexTick}
          />
          <Tooltip
            formatter={(value) => [formatIndexTick(Number(value)), "Index"]}
            labelClassName="text-foreground"
            cursor={{ stroke: "var(--color-ink-3)" }}
            contentStyle={{
              background: "var(--popover)",
              borderColor: "var(--border)",
              borderRadius: 0,
              color: "var(--popover-foreground)",
            }}
          />
          <Line
            type="linear"
            dataKey="index"
            stroke="var(--color-ink)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 3, fill: "var(--color-paper)", stroke: "var(--color-ink)", strokeWidth: 2 }}
            activeDot={{ r: 4, fill: "var(--color-ink)", stroke: "var(--color-paper)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
