"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Préfixes d'URL rattachés à une section en plus du sien : un import ouvert relève d'« Importer ». */
const SECTION_PREFIXES: Record<string, readonly string[]> = { "/import": ["/imports"] };

/** Vrai si `pathname` est la page de la section `href` ou l'une de ses sous-pages. */
function inSection(pathname: string, href: string) {
  return [href, ...(SECTION_PREFIXES[href] ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Lien de section qui porte `aria-current="page"` sur sa section et ses sous-pages. Le style
 * du lien courant passe par la variante `aria-[current=page]:` de `className`.
 */
export function NavLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      aria-current={inSection(pathname, href) ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
