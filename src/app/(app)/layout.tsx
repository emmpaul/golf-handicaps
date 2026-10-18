import { AppNav } from "@/components/app-nav";

/**
 * Même largeur de contenu sur toutes les pages, navigation comprise (`max-w-7xl`). Le bas de
 * `main` laisse la place de la barre d'onglets et de la barre d'accueil (`--bottom-chrome`).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppNav />
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-4 pt-4 pb-[calc(--spacing(4)+var(--bottom-chrome))] lg:pt-5 lg:pb-[calc(--spacing(5)+var(--bottom-chrome))]">
        {children}
      </main>
    </div>
  );
}
