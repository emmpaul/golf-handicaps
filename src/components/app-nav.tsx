import { Camera, Flag, ListOrdered, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";

/** Sections de l'app, reprises par la navigation et la page d'accueil (qui ignore `icon`). */
export const LINKS = [
  {
    href: "/import",
    label: "Importer",
    description: "Envoyer la photo d'une carte de score.",
    icon: Camera,
  },
  {
    href: "/rounds",
    label: "Rounds",
    description: "Rounds enregistrés et classement net.",
    icon: ListOrdered,
  },
  {
    href: "/handicaps",
    label: "Handicaps",
    description: "Index simulateur et son évolution.",
    icon: TrendingUp,
  },
  {
    href: "/strokes",
    label: "Coups",
    description: "Coups à donner avant une partie.",
    icon: Flag,
  },
  {
    href: "/players",
    label: "Joueurs",
    description: "Joueurs du groupe et leurs alias.",
    icon: Users,
  },
] as const;

/**
 * Navigation entre sections : liens en haut à partir de `md`, barre d'onglets fixée en bas
 * en dessous. Les deux sont rendues, l'une ou l'autre masquée en CSS. Les marges de zone sûre
 * viennent des variables de `globals.css`.
 */
export function AppNav() {
  return (
    <>
      <header className="border-b pt-(--safe-top)">
        <nav
          aria-label="Navigation principale"
          className="mx-auto flex w-full max-w-7xl items-center gap-1 px-4 py-2"
        >
          <Link href="/" className="mr-2 shrink-0 font-heading font-semibold">
            ⛳ Golf
          </Link>
          {LINKS.map(({ href, label }) => (
            <NavLink
              key={href}
              href={href}
              className="hidden shrink-0 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground md:flex"
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 flex h-(--bottom-chrome) flex-col border-t bg-background pb-(--safe-bottom) md:hidden"
      >
        {/* Bordure comprise dans `--bottom-chrome` : la barre « Enregistrer » se pose au ras. */}
        <ul className="grid flex-1 grid-cols-5">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href} className="flex">
              <NavLink
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
