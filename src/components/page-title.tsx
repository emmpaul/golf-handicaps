import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-heading text-xl font-semibold">{children}</h1>;
}
