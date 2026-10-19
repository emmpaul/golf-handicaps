import { z } from "zod";

/** Fuseau IANA reconnu par `Intl` ; `supportedValuesOf` ignorerait les liens comme America/Montreal. */
function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  APP_PASSCODE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  DATA_DIR: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Une variable vide (fréquent dans Dokploy) vaut absente, et non 0.
  AI_MONTHLY_BUDGET_USD: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().positive().default(1),
  ),
  // Noms séparés par des virgules ; absente ou vide : aucun joueur créé (spec `players`).
  INITIAL_PLAYERS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== ""),
    )
    .superRefine((names, ctx) => {
      const seen = new Set<string>();
      for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key)) ctx.addIssue({ code: "custom", message: `nom en double : ${name}` });
        seen.add(key);
      }
    }),
  // Fuseau du mois civil du plafond IA (spec `scorecard-ai-completion`) ; vide vaut absent.
  AI_BUDGET_TIME_ZONE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().default("America/Montreal").refine(isTimeZone, "fuseau IANA inconnu"),
  ),
});

export type Env = {
  APP_PASSCODE: string;
  SESSION_SECRET: string;
  DATA_DIR: string;
  /** Clé de l'API Anthropic, lue par le worker seul (cadrage et complétion par IA) ; `null` : aucun appel à l'IA. */
  ANTHROPIC_API_KEY: string | null;
  /** Plafond de dépense IA par mois calendaire, en dollars US. */
  AI_MONTHLY_BUDGET_USD: number;
  /** Joueurs créés au démarrage du web sur une base sans joueur ; vide : aucun. */
  INITIAL_PLAYERS: readonly string[];
  /** Fuseau IANA dans lequel se compte le mois civil du plafond IA. */
  AI_BUDGET_TIME_ZONE: string;
};

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
  const {
    APP_PASSCODE,
    SESSION_SECRET,
    DATA_DIR,
    NODE_ENV,
    ANTHROPIC_API_KEY,
    AI_MONTHLY_BUDGET_USD,
    INITIAL_PLAYERS,
    AI_BUDGET_TIME_ZONE,
  } = result.data;
  return {
    APP_PASSCODE,
    SESSION_SECRET,
    DATA_DIR: DATA_DIR ?? (NODE_ENV === "production" ? "/data" : "./data"),
    ANTHROPIC_API_KEY: ANTHROPIC_API_KEY || null,
    AI_MONTHLY_BUDGET_USD,
    INITIAL_PLAYERS,
    AI_BUDGET_TIME_ZONE,
  };
}

let cached: Env | undefined;

/** Lit et valide `process.env` une seule fois par processus. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
