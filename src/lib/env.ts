import { z } from "zod";

const schema = z.object({
  APP_PASSCODE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  DATA_DIR: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
});

export type Env = { APP_PASSCODE: string; SESSION_SECRET: string; DATA_DIR: string };

/**
 * Valide les variables d'environnement partagées par le web et le worker.
 * Lève une erreur qui nomme chaque variable manquante ou invalide.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join(".")} (${issue.message})`,
    );
    throw new Error(`Variables d'environnement invalides : ${problems.join(", ")}`);
  }
  const { APP_PASSCODE, SESSION_SECRET, DATA_DIR, NODE_ENV } = result.data;
  return {
    APP_PASSCODE,
    SESSION_SECRET,
    DATA_DIR: DATA_DIR ?? (NODE_ENV === "production" ? "/data" : "./data"),
  };
}

let cached: Env | undefined;

/** Lit et valide `process.env` une seule fois par processus. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
