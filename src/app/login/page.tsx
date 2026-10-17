import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion · Handicaps golf" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Handicaps golf</h1>
      <LoginForm />
    </main>
  );
}
