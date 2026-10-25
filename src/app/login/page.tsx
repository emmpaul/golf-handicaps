import type { Metadata } from "next";
import { AppVersion } from "@/components/app-version";
import { BrandMark } from "@/components/brand-mark";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Handicaps golf" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-8">
      {/* Formulaire centré dans la hauteur restante, version en bas de page. */}
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col gap-3 border-t-2 border-foreground pt-4">
          <p className="flex items-center gap-2 font-heading text-xl leading-none font-extrabold">
            <BrandMark /> Golf
          </p>
          <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-(--tracking-display)">
            Handicaps golf
          </h1>
        </div>
        <LoginForm />
      </div>
      <AppVersion version={APP_VERSION} commit={APP_COMMIT} />
    </main>
  );
}
