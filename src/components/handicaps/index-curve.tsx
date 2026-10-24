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

export type CurvePoint = { label: string; index: number };

/** Courbe de l'index d'un joueur : un point par round, l'index juste après ce round. */
export function IndexCurve({ name, points }: { name: string; points: CurvePoint[] }) {
  return (
    <figure
      aria-label={`Courbe de l'index de ${name}`}
      className="h-48 w-full min-w-0 lg:h-full lg:min-h-48"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value) => [String(value).replace(".", ","), "Index"]}
            labelClassName="text-foreground"
            contentStyle={{
              background: "var(--popover)",
              borderColor: "var(--border)",
              color: "var(--popover-foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey="index"
            stroke="var(--color-primary)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
