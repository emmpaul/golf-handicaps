import Link from "next/link";

/** Sections de l'app, reprises par la navigation et la page d'accueil. */
export const LINKS = [
  { href: "/import", label: "Importer", description: "Envoyer la photo d'une carte de score." },
  { href: "/rounds", label: "Rounds", description: "Rounds enregistrés et classement net." },
  { href: "/handicaps", label: "Handicaps", description: "Index simulateur et son évolution." },
  { href: "/strokes", label: "Coups", description: "Coups à donner avant une partie." },
  { href: "/players", label: "Joueurs", description: "Joueurs du groupe et leurs alias." },
] as const;

/** Barre de navigation, d'abord pensée pour le téléphone : défile seule si trop large. */
export function AppNav() {
  return (
    <header className="border-b">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2"
      >
        <Link href="/" className="mr-2 shrink-0 font-heading font-semibold">
          ⛳ Golf
        </Link>
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="shrink-0 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
