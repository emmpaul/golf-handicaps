import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { courseRatings, roundPlayers, rounds } from "@/db/schema";
import { COURSE_RATING_JOB, type CourseRatingPayload } from "@/jobs/course-rating";
import { enqueueJob } from "@/jobs/queue";
import { courseViewUrl, sgtScorecardUrl } from "@/server/courses/sgt";
import { knownCourses } from "@/server/rounds/courses";
import { recomputeStats, type Tx } from "@/server/rounds/stats";

/**
 * Actions de la page Parcours (design `add-course-rating`, décision 6) : confirmer une
 * proposition, choisir un tee ou un candidat SGT, saisir à la main, relancer la recherche.
 */

/** Saisie ou choix refusé, avec le message affiché sur la page Parcours. */
export class CourseRatingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseRatingInputError";
  }
}

const RATING_RANGE = "Rating entre 40,0 et 90,0";
const SLOPE_RANGE = "Slope entre 55 et 155";

type CourseRatingRow = typeof courseRatings.$inferSelect;
type ReadTee = NonNullable<CourseRatingRow["teesRead"]>[number];

function findRow(db: Db | Tx, id: number): CourseRatingRow {
  const row = db.select().from(courseRatings).where(eq(courseRatings.id, id)).get();
  if (!row) throw new CourseRatingInputError("Parcours introuvable");
  return row;
}

const sameText = (column: typeof rounds.courseName | typeof rounds.tees, value: string) =>
  sql`lower(trim(${column})) = lower(trim(${value}))`;

/** Joueurs qui ont au moins un round sur la paire (nom, tees), sans tenir compte de la casse. */
function playersOnCourse(tx: Tx, row: CourseRatingRow): number[] {
  return tx
    .selectDistinct({ playerId: roundPlayers.playerId })
    .from(roundPlayers)
    .innerJoin(rounds, eq(rounds.id, roundPlayers.roundId))
    .where(and(sameText(rounds.courseName, row.courseName), sameText(rounds.tees, row.tees)))
    .all()
    .map(({ playerId }) => playerId);
}

/**
 * Écrit une rating confirmée et recalcule, dans la même transaction, l'historique de tous les
 * joueurs du parcours (spec `handicap-index`, « Recalcul complet »).
 */
function writeConfirmed(
  db: Db,
  id: number,
  values: Pick<CourseRatingRow, "ratingT" | "slope" | "source"> & { proposedTee?: string },
  now: Date,
) {
  db.transaction((tx) => {
    const row = findRow(tx, id);
    tx.update(courseRatings)
      .set({ ...values, status: "confirmed", note: null, updatedAt: now })
      .where(eq(courseRatings.id, id))
      .run();
    recomputeStats(tx, playersOnCourse(tx, row));
  });
}

const readTee = (row: CourseRatingRow, name: string | null): ReadTee | undefined =>
  name === null ? undefined : row.teesRead?.find((tee) => tee.name === name);

/** Confirme la proposition (tee `proposed_tee` lu sur la carte SGT). */
export function confirmProposal(db: Db, id: number, now = new Date()) {
  const row = findRow(db, id);
  const tee = readTee(row, row.proposedTee);
  if (!tee) throw new CourseRatingInputError("Aucune proposition à confirmer");
  writeConfirmed(db, id, { ratingT: tee.ratingT, slope: tee.slope, source: "sgt" }, now);
}

/** Retient l'un des tees lus sur la carte SGT, qui devient la rating confirmée. */
export function chooseTee(db: Db, id: number, teeName: string, now = new Date()) {
  const tee = readTee(findRow(db, id), teeName);
  if (!tee) throw new CourseRatingInputError("Tee absent de la carte SGT");
  writeConfirmed(
    db,
    id,
    { ratingT: tee.ratingT, slope: tee.slope, source: "sgt", proposedTee: tee.name },
    now,
  );
}

/** « 71,4 » ou « 71.4 » vers 714 : une décimale au plus, de 40,0 à 90,0. */
function parseRatingT(text: string): number {
  const match = /^(\d{2})(?:[.,](\d))?$/.exec(text.trim());
  const ratingT = match ? Number(match[1]) * 10 + Number(match[2] ?? 0) : Number.NaN;
  if (!(ratingT >= 400 && ratingT <= 900)) throw new CourseRatingInputError(RATING_RANGE);
  return ratingT;
}

/** Slope entier de 55 à 155. */
function parseSlope(text: string): number {
  const slope = /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
  if (!(slope >= 55 && slope <= 155)) throw new CourseRatingInputError(SLOPE_RANGE);
  return slope;
}

/** Saisie ou correction à la main (spec `course-rating`, bornes 40,0–90,0 et 55–155). */
export function saveManualRating(
  db: Db,
  id: number,
  input: { rating: string; slope: string },
  now = new Date(),
) {
  const ratingT = parseRatingT(input.rating);
  const slope = parseSlope(input.slope);
  findRow(db, id);
  writeConfirmed(db, id, { ratingT, slope, source: "manual" }, now);
}

type SgtCourseRef = Pick<CourseRatingRow, "sgtCourseId" | "sgtCourseName" | "sgtCourseLocation">;

/** Remet la ligne en `pending`, avec le parcours SGT `sgtCourse`, et met son job en file. */
function requeue(tx: Tx, id: number, sgtCourse: SgtCourseRef, now: Date) {
  tx.update(courseRatings)
    .set({ status: "pending", ...sgtCourse, note: null, updatedAt: now })
    .where(eq(courseRatings.id, id))
    .run();
  const payload: CourseRatingPayload = { courseRatingId: id };
  enqueueJob(tx, COURSE_RATING_JOB, payload, now);
}

/**
 * Retient un candidat SGT, avec son nom et son lieu : le job lit directement sa carte, sans
 * refaire la correspondance par nom (`sgt_course_id` déjà posé).
 */
export function chooseCandidate(db: Db, id: number, sgtCourseId: number, now = new Date()) {
  db.transaction((tx) => {
    const row = findRow(tx, id);
    const candidate = row.candidates?.find((course) => course.id === sgtCourseId);
    if (!candidate) throw new CourseRatingInputError("Parcours SGT absent des candidats");
    requeue(
      tx,
      id,
      {
        sgtCourseId: candidate.id,
        sgtCourseName: candidate.name,
        sgtCourseLocation: candidate.location,
      },
      now,
    );
  });
}

/**
 * Relance la recherche depuis la liste SGT (parcours SGT retenu effacé : id, nom et lieu). Les
 * valeurs confirmées restent en place jusqu'à une nouvelle confirmation.
 */
export function relaunchSearch(db: Db, id: number, now = new Date()) {
  db.transaction((tx) => {
    findRow(tx, id);
    requeue(tx, id, { sgtCourseId: null, sgtCourseName: null, sgtCourseLocation: null }, now);
  });
}

const courseKey = (courseName: string, tees: string) =>
  `${courseName.trim().toLowerCase()}\u0000${tees.trim().toLowerCase()}`;

/**
 * Parcours connus pour la page Parcours (spec `course-rating`) : par du round le plus récent,
 * rating confirmée, état de la recherche, proposition et liens SGT / The Course View quand un
 * parcours SGT est retenu. Un parcours sans ligne (balayage pas encore passé) a `id` null.
 */
export function courseRatingOverview(db: Db) {
  const rows = new Map(
    db
      .select()
      .from(courseRatings)
      .all()
      .map((row) => [courseKey(row.courseName, row.tees), row]),
  );
  return knownCourses(db).map(({ courseName, tees, pars }) => ({
    courseName,
    tees,
    par: pars.reduce((total, par) => total + par, 0),
    ...searchState(rows.get(courseKey(courseName, tees))),
  }));
}

/** Rating, état de la recherche et liens d'une ligne, ou une recherche à venir sans ligne. */
function searchState(row: CourseRatingRow | undefined) {
  if (!row) {
    return {
      id: null,
      ratingT: null,
      slope: null,
      source: null,
      status: "pending" as const,
      note: null,
      sgtCourseName: null,
      sgtCourseLocation: null,
      proposal: null,
      teesRead: [],
      candidates: [],
      scorecardUrl: null,
      courseViewUrl: null,
    };
  }
  const { sgtCourseId, sgtCourseName } = row;
  return {
    id: row.id,
    ratingT: row.ratingT,
    slope: row.slope,
    source: row.source,
    status: row.status,
    note: row.note,
    sgtCourseName,
    sgtCourseLocation: row.sgtCourseLocation,
    proposal: readTee(row, row.proposedTee) ?? null,
    teesRead: row.teesRead ?? [],
    candidates: row.candidates ?? [],
    scorecardUrl: sgtCourseId === null ? null : sgtScorecardUrl(sgtCourseId),
    // Slug tiré du nom SGT (« Sanctuary »), pas du nom du round (« THE SANCTUARY »).
    courseViewUrl: sgtCourseName === null ? null : courseViewUrl(sgtCourseName),
  };
}

export type CourseOverview = ReturnType<typeof courseRatingOverview>[number];
