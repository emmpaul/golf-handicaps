import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** Valeurs de handicap : dixièmes entiers (17,4 → 174), colonnes suffixées `_t`. */

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const players = sqliteTable(
  "players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("players_name_nocase_unique").on(sql`lower(${t.name})`)],
);

export const playerAliases = sqliteTable(
  "player_aliases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [
    uniqueIndex("player_aliases_alias_nocase_unique").on(sql`lower(${t.alias})`),
    index("player_aliases_player_idx").on(t.playerId),
  ],
);

export const rounds = sqliteTable(
  "rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courseName: text("course_name").notNull(),
    tees: text("tees").notNull(),
    /** Date de jeu au format ISO `YYYY-MM-DD`. */
    playedOn: text("played_on").notNull(),
    createdAt: createdAt(),
    photoPath: text("photo_path"),
  },
  (t) => [index("rounds_played_on_idx").on(t.playedOn, t.createdAt)],
);

/** Clés étrangères communes aux tables d'un round : supprimer un round supprime ses lignes. */
const roundRef = () =>
  integer("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" });

const playerRef = () =>
  integer("player_id")
    .notNull()
    .references(() => players.id);

export const roundHoles = sqliteTable(
  "round_holes",
  {
    roundId: roundRef(),
    hole: integer("hole").notNull(),
    par: integer("par").notNull(),
    strokeIndex: integer("stroke_index").notNull(),
    distance: integer("distance"),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.hole] })],
);

export const roundPlayers = sqliteTable(
  "round_players",
  {
    roundId: roundRef(),
    playerId: playerRef(),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roundId, t.playerId] }),
    index("round_players_player_idx").on(t.playerId),
  ],
);

export const scores = sqliteTable(
  "scores",
  {
    roundId: roundRef(),
    playerId: playerRef(),
    hole: integer("hole").notNull(),
    strokes: integer("strokes").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.playerId, t.hole] })],
);

/** Table dérivée, recalculée après toute écriture de round (design, décision 3). */
export const playerRoundStats = sqliteTable(
  "player_round_stats",
  {
    roundId: roundRef(),
    playerId: playerRef(),
    gross: integer("gross").notNull(),
    adjusted: integer("adjusted").notNull(),
    differentialT: integer("differential_t").notNull(),
    indexBeforeT: integer("index_before_t"),
    indexAfterT: integer("index_after_t").notNull(),
    countsInCurrent: integer("counts_in_current", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.roundId, t.playerId] }),
    index("player_round_stats_player_idx").on(t.playerId),
  ],
);

export const importStatuses = ["queued", "reading", "ready", "failed"] as const;

export const cornersSources = ["auto", "ai", "manual"] as const;

export const imports = sqliteTable("imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: importStatuses }).notNull().default("queued"),
  photoPath: text("photo_path").notNull(),
  /**
   * Coins du panneau, coordonnées normalisées entre 0 et 1 (JSON) ; `null` tant que le cadrage
   * n'est pas trouvé (« Panneau introuvable » quand l'import est en échec).
   */
  corners: text("corners", { mode: "json" }),
  /** Brouillon lu par l'OCR (JSON), `null` tant que la lecture n'est pas finie. */
  draft: text("draft", { mode: "json" }),
  roundId: integer("round_id").references(() => rounds.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  /** Clés des cases complétées par l'IA (JSON), `null` sans complétion. */
  aiCells: text("ai_cells", { mode: "json" }).$type<string[]>(),
  /** Message sur la complétion IA (budget atteint, indisponible), `null` sinon. */
  aiNote: text("ai_note"),
  /** État de l'écran de correction enregistré automatiquement (JSON), `null` sans correction. */
  correction: text("correction", { mode: "json" }),
  /** Provenance des coins : détection locale, IA ou main ; `null` inconnue (traitée comme main). */
  cornersSource: text("corners_source", { enum: cornersSources }),
});

/** Un appel à l'IA par ligne ; coûts en micro-dollars (design, décision 6). */
export const aiUsage = sqliteTable("ai_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: createdAt(),
  /** Mois civil `YYYY-MM`, à l'heure de Montréal. */
  month: text("month").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costMicroUsd: integer("cost_micro_usd").notNull(),
});

export const jobStatuses = ["queued", "running", "done", "failed"] as const;

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    status: text("status", { enum: jobStatuses }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: integer("run_after", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_status_run_after_idx").on(t.status, t.runAfter)],
);

export const courseRatingStatuses = [
  "pending",
  "proposed",
  "choose_course",
  "choose_tee",
  "manual",
  "not_found",
  "failed",
  "confirmed",
] as const;

export const courseRatingSources = ["sgt", "manual"] as const;

/**
 * Course rating et slope d'un parcours, une ligne par paire (nom, tees) sans tenir compte de
 * la casse ni des espaces (design `add-course-rating`, décision 2). Seuls `rating_t` et `slope`,
 * écrits à la confirmation, entrent dans les calculs ; la proposition vit dans `tees_read`.
 */
export const courseRatings = sqliteTable(
  "course_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Nom et tees tels que vus sur le premier round de la paire. */
    courseName: text("course_name").notNull(),
    tees: text("tees").notNull(),
    /** Rating confirmée en dixièmes (71,4 → 714), `null` tant que rien n'est confirmé. */
    ratingT: integer("rating_t"),
    slope: integer("slope"),
    source: text("source", { enum: courseRatingSources }),
    status: text("status", { enum: courseRatingStatuses }).notNull().default("pending"),
    /** Parcours SGT retenu : id, nom et lieu (lien The Course View, confirmation). */
    sgtCourseId: integer("sgt_course_id"),
    sgtCourseName: text("sgt_course_name"),
    sgtCourseLocation: text("sgt_course_location"),
    /** Parcours SGT possibles (`choose_course`). */
    candidates: text("candidates", { mode: "json" }).$type<
      { id: number; name: string; location: string; par: number }[]
    >(),
    /** Tees lus sur la carte SGT. */
    teesRead: text("tees_read", { mode: "json" }).$type<
      { name: string; ratingT: number; slope: number }[]
    >(),
    /** Tee de `tees_read` qui correspond aux tees du round. */
    proposedTee: text("proposed_tee"),
    /** Raison affichée (« Budget IA du mois atteint », « SGT injoignable »…). */
    note: text("note"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("course_ratings_course_tees_unique").on(
      sql`lower(trim(${t.courseName}))`,
      sql`lower(trim(${t.tees}))`,
    ),
  ],
);
