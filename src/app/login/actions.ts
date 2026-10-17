"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { attemptLogin, clientIp, createLoginGuard } from "@/lib/auth/login";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export type LoginState = { error: string | null };

const guard = createLoginGuard();

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const env = getEnv();
  const result = attemptLogin(
    {
      passcode: String(formData.get("passcode") ?? ""),
      ip: clientIp(await headers()),
      now: Date.now(),
    },
    { appPasscode: env.APP_PASSCODE, sessionSecret: env.SESSION_SECRET, guard },
  );
  if (!result.ok) {
    return { error: result.error };
  }
  (await cookies()).set(
    SESSION_COOKIE_NAME,
    result.token,
    sessionCookieOptions(process.env.NODE_ENV),
  );
  redirect("/");
}
