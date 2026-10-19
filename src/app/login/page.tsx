import type { Metadata } from "next";
import { AppVersion } from "@/components/app-version";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Handicaps golf" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      {/* Formulaire centré dans la hauteur restante, version en bas de page. */}
      <div className="flex flex-1 flex-col justify-center gap-6">
        <h1 className="font-heading text-2xl font-semibold">Handicaps golf</h1>
        <LoginForm />
      </div>
      <AppVersion version={APP_VERSION} commit={APP_COMMIT} />
    </main>
  );
}
