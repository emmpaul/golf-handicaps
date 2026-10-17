import { AppNav } from "@/components/app-nav";

/** Même largeur de contenu sur toutes les pages, navigation comprise (`max-w-7xl`). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppNav />
      <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-4 py-4 lg:py-5">
        {children}
      </main>
    </div>
  );
}
