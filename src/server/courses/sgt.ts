import { z } from "zod";

/**
 * Liste des parcours de Simulator Golf Tour et correspondance avec les parcours du groupe
 * (design `add-course-rating`, décision 4). SGT ne publie pas la rating dans sa liste : elle
 * se lit sur l'image de carte de chaque parcours.
 */

const SGT_ORIGIN = "https://simulatorgolftour.com";
const SGT_COURSES_URL = `${SGT_ORIGIN}/courses`;
const SGT_USER_AGENT = "golf-handicaps (+https://github.com/emmpaul/golf-handicaps)";
const FETCH_TIMEOUT_MS = 20_000;
const LIST_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CANDIDATES = 10;

/** Parcours de la liste SGT : son id sert aux liens de la carte. */
export type SgtCourse = { id: number; name: string; location: string; par: number };

/** Liste ou image SGT indisponible : réseau, statut HTTP, délai, ou page d'un autre format. */
export class SgtUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SgtUnavailableError";
  }
}

/** Ligne de `courses` : `[id, nom, lieu, par, difficulté, …]`, seuls les 4 premiers champs servent. */
const courseRow = z
  .tuple([z.number().int(), z.string(), z.string(), z.number().int()])
  .rest(z.unknown())
  .transform(([id, name, location, par]) => ({ id, name, location, par }));

const coursesData = z.object({
  cardUrl: z.string().includes("{COURSEID}"),
  courses: z.array(courseRow),
});

const COURSES_DATA = /<script id=['"]courses-data['"][^>]*>([\s\S]*?)<\/script>/;

/** Parcours du bloc JSON `courses-data` de la page `/courses` de SGT. */
export function parseSgtCourses(html: string): SgtCourse[] {
  const block = COURSES_DATA.exec(html);
  if (!block) throw new SgtUnavailableError("Liste SGT absente de la page");
  let json: unknown;
  try {
    json = JSON.parse(block[1]);
  } catch (error) {
    throw new SgtUnavailableError("Liste SGT illisible", { cause: error });
  }
  const parsed = coursesData.safeParse(json);
  if (!parsed.success)
    throw new SgtUnavailableError("Liste SGT illisible", { cause: parsed.error });
  return parsed.data.courses;
}

/**
 * Nom comparable : minuscules, sans accents, `&` → `and`, ponctuation → espace, espaces
 * réduits, sans « the » en tête. « THE SANCTUARY » → `sanctuary`.
 */
export function normalizeCourseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

export type SgtMatch =
  | { kind: "match"; course: SgtCourse }
  | { kind: "candidates"; candidates: SgtCourse[] }
  | { kind: "none" };

/**
 * Parcours SGT du round : un seul nom égal au même par est retenu. Plusieurs noms égaux, ou
 * à défaut les noms qui se contiennent au même par (10 au plus), sont à choisir.
 */
export function matchSgtCourse(
  courses: readonly SgtCourse[],
  courseName: string,
  par: number,
): SgtMatch {
  const wanted = normalizeCourseName(courseName);
  const samePar = courses
    .filter((course) => course.par === par)
    .map((course) => ({ course, name: normalizeCourseName(course.name) }));
  const exact = samePar.filter(({ name }) => name === wanted).map(({ course }) => course);
  if (exact.length === 1) return { kind: "match", course: exact[0] };
  const candidates =
    exact.length > 1
      ? exact
      : samePar
          .filter(({ name }) => name.includes(wanted) || wanted.includes(name))
          .map(({ course }) => course);
  if (candidates.length === 0) return { kind: "none" };
  return { kind: "candidates", candidates: candidates.slice(0, MAX_CANDIDATES) };
}

/** Tees comparables : sans distance en fin (« White 6023yd » → `white`), casse ni espaces. */
export function teeKey(tees: string): string {
  return tees
    .trim()
    .replace(/\s*\d+\s*(yd|yds|y|m)$/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** Tee lu sur la carte SGT qui porte le nom des tees du round, ou `null`. */
export function matchTee<T extends { name: string }>(
  teesRead: readonly T[],
  tees: string,
): T | null {
  const wanted = teeKey(tees);
  return teesRead.find(({ name }) => teeKey(name) === wanted) ?? null;
}

/** Image de carte SGT d'un parcours, où se lisent la rating et le slope de chaque tee. */
export function sgtScorecardUrl(sgtCourseId: number): string {
  return `${SGT_ORIGIN}/public/assets/courseImages/scorecards/scorecard_${sgtCourseId}.jpg`;
}

/**
 * Page The Course View du parcours, slug tiré du nom SGT (« Diamond Hawk Golf Course & Pub »
 * → `diamond-hawk-golf-course-pub`). Une aide : la page peut ne pas exister.
 */
export function courseViewUrl(sgtName: string): string {
  const slug = sgtName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://thecourseview.com/courses/${slug}`;
}

type SgtClientOptions = { fetch?: typeof fetch; now?: () => number };

/**
 * Accès à SGT depuis le worker : `User-Agent` de l'app, délai de 20 s, liste gardée 24 h en
 * mémoire pour que le balayage de démarrage ne la télécharge qu'une fois.
 */
export class SgtClient {
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private cached: { courses: SgtCourse[]; at: number } | null = null;

  constructor(options: SgtClientOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  async courses(): Promise<SgtCourse[]> {
    if (this.cached && this.now() - this.cached.at < LIST_TTL_MS) return this.cached.courses;
    const courses = parseSgtCourses(await this.get(SGT_COURSES_URL, (response) => response.text()));
    this.cached = { courses, at: this.now() };
    return courses;
  }

  async scorecard(sgtCourseId: number): Promise<Buffer> {
    const bytes = await this.get(sgtScorecardUrl(sgtCourseId), (response) =>
      response.arrayBuffer(),
    );
    return Buffer.from(bytes);
  }

  /** GET avec le délai sur la réponse et son corps ; toute erreur devient `SgtUnavailableError`. */
  private async get<T>(url: string, read: (response: Response) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error(`délai de ${FETCH_TIMEOUT_MS / 1000} s dépassé`)),
      FETCH_TIMEOUT_MS,
    );
    try {
      const response = await this.fetch(url, {
        headers: { "User-Agent": SGT_USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) throw new SgtUnavailableError(`SGT : HTTP ${response.status}`);
      return await read(response);
    } catch (error) {
      if (error instanceof SgtUnavailableError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new SgtUnavailableError(`SGT injoignable : ${reason}`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}
