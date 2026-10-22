import { desc, eq, sql, sum } from "drizzle-orm";
import type { AiBudget } from "@/ai/budget";
import { AiCompletionError } from "@/ai/claude-call";
import { MAX_RATING_COST } from "@/ai/pricing";
import type { RatingReader, SgtCard } from "@/ai/rating-reader";
import type { Db } from "@/db/client";
import { courseRatings, roundHoles, rounds } from "@/db/schema";
import { matchSgtCourse, matchTee, type SgtClient, type SgtCourse } from "@/server/courses/sgt";
import { recordUsage } from "./locate-panel";
import type { JobHandler } from "./runner";

export const COURSE_RATING_JOB = "course-rating";

export type CourseRatingPayload = { courseRatingId: number };

/** Lecture de la carte SGT par l'IA ; absente (`null`) sans `ANTHROPIC_API_KEY`. */
export type RatingAi = { reader: RatingReader; budget: AiBudget };

export type CourseRatingOptions = {
  sgt: Pick<SgtClient, "courses" | "scorecard">;
  ai: RatingAi | null;
  /** `SGT_LOOKUP=on` : à `false`, aucune requête vers SGT. */
  lookup: boolean;
  now?: () => Date;
};

type RatingValues = Partial<
  Pick<
    typeof courseRatings.$inferInsert,
    | "status"
    | "note"
    | "sgtCourseId"
    | "sgtCourseName"
    | "sgtCourseLocation"
    | "candidates"
    | "teesRead"
    | "proposedTee"
  >
>;

/**
 * Par total du round le plus récent sur la paire (nom, tees), sans tenir compte de la casse
 * ni des espaces, comme `knownCourses`.
 */
function roundPar(db: Db, courseName: string, tees: string): number | null {
  const latest = db
    .select({ id: rounds.id })
    .from(rounds)
    .where(
      sql`lower(trim(${rounds.courseName})) = lower(trim(${courseName})) and lower(trim(${rounds.tees})) = lower(trim(${tees}))`,
    )
    .orderBy(desc(rounds.playedOn), desc(rounds.createdAt), desc(rounds.id))
    .limit(1)
    .get();
  if (!latest) return null;
  const row = db
    .select({ par: sum(roundHoles.par) })
    .from(roundHoles)
    .where(eq(roundHoles.roundId, latest.id))
    .get();
  return row?.par == null ? null : Number(row.par);
}

/**
 * Recherche de rating d'un parcours (design `add-course-rating`, décision 3) : liste SGT,
 * correspondance au même par, lecture de la carte SGT par l'IA, puis association du tee.
 * Le job n'écrit jamais `rating_t` ni `slope` : seule une confirmation le fait. Une erreur
 * SGT (réseau, HTTP, format) remonte : le runner réessaie une fois, puis `onFailed` met la
 * ligne en `failed` (« SGT injoignable »). Un échec de l'IA, lui, finit en `manual`.
 */
export function createCourseRatingHandler(
  db: Db,
  { sgt, ai, lookup, now = () => new Date() }: CourseRatingOptions,
): JobHandler {
  /** Écrit l'issue de la recherche ; les champs de la recherche précédente sont effacés. */
  function finish(id: number, values: RatingValues) {
    db.update(courseRatings)
      .set({
        note: null,
        candidates: null,
        teesRead: null,
        proposedTee: null,
        ...values,
        updatedAt: now(),
      })
      .where(eq(courseRatings.id, id))
      .run();
  }

  /** Carte lue par l'IA, ou la note qui explique pourquoi il faut saisir à la main. */
  async function readCard(sgtCourseId: number): Promise<SgtCard | { note: string }> {
    if (!ai) return { note: "Lecture IA désactivée" };
    if (!ai.budget.canSpend(now(), MAX_RATING_COST)) return { note: "Budget IA du mois atteint" };
    const scorecard = await sgt.scorecard(sgtCourseId);
    try {
      const { card, usage } = await ai.reader.read(scorecard);
      recordUsage(ai.budget, usage, now());
      return card ?? { note: "Lecture IA impossible" };
    } catch (error) {
      if (error instanceof AiCompletionError) recordUsage(ai.budget, error.usage, now());
      return { note: "Lecture IA impossible" };
    }
  }

  /**
   * Étape 2 : parcours SGT retenu (id, nom et lieu, écrits avec l'issue), ou l'issue
   * `not_found` / `choose_course`.
   */
  async function findSgtCourse(courseName: string, par: number): Promise<SgtCourse | RatingValues> {
    const match = matchSgtCourse(await sgt.courses(), courseName, par);
    if (match.kind === "match") return match.course;
    const noCourse = { sgtCourseId: null, sgtCourseName: null, sgtCourseLocation: null };
    if (match.kind === "none") return { status: "not_found", ...noCourse };
    return { status: "choose_course", ...noCourse, candidates: match.candidates };
  }

  /** Étapes 3 à 5 : lecture de la carte du parcours SGT, puis proposition du tee du round. */
  async function propose(sgtCourseId: number, par: number, tees: string): Promise<RatingValues> {
    const card = await readCard(sgtCourseId);
    if ("note" in card) return { status: "manual", sgtCourseId, note: card.note };
    if (card.par !== par)
      return { status: "manual", sgtCourseId, note: "Par de la carte SGT différent" };
    const tee = matchTee(card.tees, tees);
    return {
      status: tee ? "proposed" : "choose_tee",
      sgtCourseId,
      teesRead: card.tees,
      proposedTee: tee?.name ?? null,
    };
  }

  async function search(row: typeof courseRatings.$inferSelect): Promise<RatingValues> {
    if (!lookup) return { status: "manual", note: "Recherche SGT désactivée" };
    const par = roundPar(db, row.courseName, row.tees);
    // Round supprimé ou renommé depuis : ni panne SGT, ni raison de réessayer.
    if (par === null) return { status: "manual", note: "Aucun round sur ce parcours" };
    // Un candidat choisi par l'utilisateur saute la correspondance : son nom et son lieu
    // sont déjà écrits par le choix.
    if (row.sgtCourseId !== null) return propose(row.sgtCourseId, par, row.tees);
    const found = await findSgtCourse(row.courseName, par);
    if (!("id" in found)) return found;
    return {
      ...(await propose(found.id, par, row.tees)),
      sgtCourseName: found.name,
      sgtCourseLocation: found.location,
    };
  }

  return {
    async run(payload) {
      const { courseRatingId: id } = payload as CourseRatingPayload;
      const row = db.select().from(courseRatings).where(eq(courseRatings.id, id)).get();
      if (!row) throw new Error(`Rating de parcours introuvable : ${id}`);
      finish(id, await search(row));
    },
    onFailed(payload) {
      finish((payload as CourseRatingPayload).courseRatingId, {
        status: "failed",
        note: "SGT injoignable",
      });
    },
  };
}
