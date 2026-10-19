import { AppNav } from "@/components/app-nav";
import { AppVersion } from "@/components/app-version";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";

/**
 * Même largeur de contenu sur toutes les pages, navigation comprise (`max-w-7xl`). Le bas de
 * `main` laisse la place de la barre d'onglets et de la barre d'accueil (`--bottom-chrome`) : la
 * ligne de version, dernier enfant de `main`, reste donc visible au-dessus de la barre d'onglets.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppNav />
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-4 pt-4 pb-[calc(--spacing(4)+var(--bottom-chrome))] lg:pt-5 lg:pb-[calc(--spacing(5)+var(--bottom-chrome))]">
        {children}
        <AppVersion version={APP_VERSION} commit={APP_COMMIT} />
      </main>
    </div>
  );
}
