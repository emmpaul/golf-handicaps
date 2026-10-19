import { releaseUrl, shortCommit } from "@/lib/version";

/**
 * Ligne discrète en bas de page : « v0.6.0 · 4794e1b », liée à la release GitHub. Sans commit
 * connu au build, la version seule. Version et commit arrivent en props pour qu'un test couvre le
 * cas avec commit, que les e2e (build sans `GIT_COMMIT`) ne voient pas. Texte petit, mais zone de
 * toucher de 44 px sous 768 px comme tout contrôle de `main`.
 */
export function AppVersion({ version, commit }: { version: string; commit: string | null }) {
  const label = commit === null ? `v${version}` : `v${version} · ${shortCommit(commit)}`;
  return (
    <footer className="mt-auto text-center text-xs text-muted-foreground">
      <a
        href={releaseUrl(version)}
        className="inline-flex items-center px-2 hover:underline max-md:min-h-11"
      >
        {label}
      </a>
    </footer>
  );
}
