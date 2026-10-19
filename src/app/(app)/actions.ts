"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Ferme la session de ce navigateur seulement : le jeton est sans état, les autres appareils
 * restent connectés. Fermer toutes les sessions, c'est changer `SESSION_SECRET`.
 */
export async function logout() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
