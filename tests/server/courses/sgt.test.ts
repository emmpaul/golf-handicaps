import { afterEach, describe, expect, it, vi } from "vitest";
import {
  courseViewUrl,
  matchSgtCourse,
  matchTee,
  normalizeCourseName,
  parseSgtCourses,
  SgtClient,
  type SgtCourse,
  SgtUnavailableError,
  sgtScorecardUrl,
  teeKey,
} from "@/server/courses/sgt";
import { BETHPAGE_TEES, SGT_COURSES_HTML, SGT_SCORECARD_30 } from "../../sgt";

const sgtCourses = parseSgtCourses(SGT_COURSES_HTML);

describe("parseSgtCourses", () => {
  // Mutation : lieu et par inversés, ou id lu comme texte.
  it("lit chaque ligne du bloc courses-data en { id, nom, lieu, par }", () => {
    expect(sgtCourses.find(({ id }) => id === 30)).toEqual({
      id: 30,
      name: "Bethpage Black",
      location: "Farmingdale, NY",
      par: 71,
    });
  });

  // Mutation : lignes à difficulté ou coordonnées `null` rejetées, ou expression régulière
  // gourmande qui avale le bloc `courses-ratings` (la lecture de la page échoue alors au
  // chargement du fichier).
  it("garde les 14 parcours de la page réduite, dans l'ordre de la page", () => {
    expect(sgtCourses.map(({ id }) => id)).toEqual([
      2341, 1841, 30, 3216, 3222, 573, 574, 477, 3291, 1873, 1969, 1951, 3466, 2184,
    ]);
  });

  // Mutation : bloc absent rendu comme une liste vide au lieu d'une erreur.
  it("refuse une page sans bloc courses-data", () => {
    expect(() => parseSgtCourses("<html><body>Maintenance</body></html>")).toThrow(
      new SgtUnavailableError("Liste SGT absente de la page"),
    );
  });

  // Mutation : par non validé (zod retiré).
  it("refuse une ligne dont le par n'est pas un entier", () => {
    const html = SGT_COURSES_HTML.replace(
      '[30,"Bethpage Black","Farmingdale, NY",71,',
      '[30,"Bethpage Black","Farmingdale, NY","71",',
    );
    expect(() => parseSgtCourses(html)).toThrow(new SgtUnavailableError("Liste SGT illisible"));
  });
});

describe("normalizeCourseName", () => {
  // Mutation : préfixe `the ` gardé.
  it("ramène « THE SANCTUARY » à « sanctuary »", () => {
    expect(normalizeCourseName("THE SANCTUARY")).toBe("sanctuary");
  });

  // Mutation : accents gardés, `&` retiré sans devenir `and`, ponctuation gardée.
  it("retire accents et ponctuation, remplace & par and", () => {
    expect(normalizeCourseName("  Golf  de Saint-Cloud  ")).toBe("golf de saint cloud");
    expect(normalizeCourseName("Diamond Hawk Golf Course & Pub")).toBe(
      "diamond hawk golf course and pub",
    );
    expect(normalizeCourseName("Château d'Augerville")).toBe("chateau d augerville");
  });

  // Mutation : « the » retiré partout et non seulement en tête.
  it("ne retire « the » qu'en tête du nom", () => {
    expect(normalizeCourseName("The Pines Sanctuary Cove")).toBe("pines sanctuary cove");
    expect(normalizeCourseName("Over The Hill")).toBe("over the hill");
  });
});

describe("matchSgtCourse", () => {
  const ids = (result: ReturnType<typeof matchSgtCourse>) =>
    result.kind === "candidates" ? result.candidates.map(({ id }) => id) : result;

  // Mutation : comparaison des noms bruts (casse prise en compte).
  it("retient Bethpage Black (30) pour « BETHPAGE BLACK », par 71", () => {
    expect(matchSgtCourse(sgtCourses, "BETHPAGE BLACK", 71)).toEqual({
      kind: "match",
      course: { id: 30, name: "Bethpage Black", location: "Farmingdale, NY", par: 71 },
    });
  });

  // Mutation : par ignoré avec un nom comparé par son début (« paynes valley 19th » commence
  // par « paynes valley »), ou noms comparés sans normalisation.
  it("retient Paynes Valley (573) et non Paynes Valley 19th (574)", () => {
    expect(matchSgtCourse(sgtCourses, "PAYNES VALLEY", 72)).toEqual({
      kind: "match",
      course: { id: 573, name: "Paynes Valley", location: "Hollister, MO", par: 72 },
    });
  });

  // Mutation : préfixe `the` gardé (le nom ne serait plus égal à « sanctuary »).
  it("retient Sanctuary (477) pour « THE SANCTUARY », par 72", () => {
    expect(matchSgtCourse(sgtCourses, "THE SANCTUARY", 72)).toEqual({
      kind: "match",
      course: { id: 477, name: "Sanctuary", location: "Sedalia, CO", par: 72 },
    });
  });

  // Mutation : par ignoré (574, par 3, serait retenu pour un round en par 72).
  it("ne retient pas un parcours de même nom mais d'un autre par", () => {
    expect(ids(matchSgtCourse(sgtCourses, "PAYNES VALLEY 19TH", 72))).toEqual([573]);
  });

  // Mutation : par ignoré dans les candidats (Sanctuary Lake, par 71, en ferait partie), ou
  // sens unique de l'inclusion (« sanctuary » contenu dans le nom du round serait oublié).
  it("propose les noms qui se contiennent, au même par", () => {
    expect(ids(matchSgtCourse(sgtCourses, "Pines Sanctuary", 72))).toEqual([477, 1951]);
  });

  // Mutation : un candidat unique en sous-chaîne retenu d'office.
  it("propose au choix un candidat unique en sous-chaîne", () => {
    expect(ids(matchSgtCourse(sgtCourses, "DIAMOND HAWK", 72))).toEqual([3222]);
  });

  // Mutation : premier des homonymes retenu d'office.
  it("propose au choix plusieurs parcours de même nom et de même par", () => {
    const twins: SgtCourse[] = [
      { id: 1, name: "Pebble Creek", location: "Ohio", par: 72 },
      { id: 2, name: "PEBBLE CREEK", location: "Texas", par: 72 },
    ];
    expect(ids(matchSgtCourse(twins, "Pebble Creek", 72))).toEqual([1, 2]);
  });

  // Mutation : liste de candidats non bornée.
  it("garde 10 candidats au plus", () => {
    const many: SgtCourse[] = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `Lakeside ${index + 1}`,
      location: "",
      par: 72,
    }));
    expect(ids(matchSgtCourse(many, "Lakeside", 72))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  // Mutation : liste vide de candidats rendue au lieu de « none ».
  it("ne trouve rien pour un parcours absent de SGT", () => {
    expect(matchSgtCourse(sgtCourses, "AUGUSTA NATIONAL", 72)).toEqual({ kind: "none" });
  });
});

describe("tees", () => {
  // Mutation : distance gardée en fin de tees.
  it("ramène « White 6023yd » à « white »", () => {
    expect(teeKey("White 6023yd")).toBe("white");
    expect(teeKey("Blue 6212 yds")).toBe("blue");
    expect(teeKey("Red 5400m")).toBe("red");
  });

  // Mutation : espaces gardés (« par 3 » ne vaudrait plus « par3 »).
  it("compare sans casse ni espaces", () => {
    expect(teeKey(" Par 3 ")).toBe("par3");
  });

  // Mutation : comparaison sensible à la distance ou à la casse.
  it("associe « White 6023yd » au tee White de la carte", () => {
    expect(matchTee(BETHPAGE_TEES, "White 6023yd")).toEqual({
      name: "White",
      ratingT: 742,
      slope: 148,
    });
    expect(matchTee(BETHPAGE_TEES, "red")).toEqual({ name: "Red", ratingT: 714, slope: 144 });
  });

  // Mutation : premier tee rendu à défaut.
  it("ne trouve rien pour des tees absents de la carte", () => {
    expect(matchTee(BETHPAGE_TEES, "Gold")).toBeNull();
  });
});

describe("liens", () => {
  // Mutation : id absent du chemin, ou `?v=1.1` ajouté.
  it("donne l'image de carte SGT d'un parcours", () => {
    expect(sgtScorecardUrl(30)).toBe(
      "https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_30.jpg",
    );
  });

  // Mutation : `&` gardé, ou tirets en bord gardés.
  it("donne la page The Course View par le slug du nom SGT", () => {
    expect(courseViewUrl("Diamond Hawk Golf Course & Pub")).toBe(
      "https://thecourseview.com/courses/diamond-hawk-golf-course-pub",
    );
    expect(courseViewUrl("Zoar Village G.C.")).toBe(
      "https://thecourseview.com/courses/zoar-village-g-c",
    );
  });
});

describe("SgtClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const DAY_MS = 24 * 60 * 60 * 1000;

  /** `fetch` simulé : la page réduite pour la liste, la carte pour l'image. */
  const fakeFetch = () =>
    vi.fn(async (url: string | URL | Request, _init?: RequestInit) =>
      String(url).endsWith(".jpg")
        ? new Response(SGT_SCORECARD_30)
        : new Response(SGT_COURSES_HTML),
    );

  // Mutation : `User-Agent` absent, ou autre URL.
  it("télécharge la liste avec le User-Agent de l'app", async () => {
    const fetch = fakeFetch();
    const client = new SgtClient({ fetch });
    await expect(client.courses()).resolves.toHaveLength(14);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://simulatorgolftour.com/courses");
    expect(new Headers(init?.headers).get("User-Agent")).toBe(
      "golf-handicaps (+https://github.com/emmpaul/golf-handicaps)",
    );
  });

  // Mutation : cache absent, ou durée de 24 h changée.
  it("garde la liste 24 h", async () => {
    const fetch = fakeFetch();
    let now = 1_000_000;
    const client = new SgtClient({ fetch, now: () => now });
    await client.courses();
    now += DAY_MS - 1;
    await client.courses();
    expect(fetch).toHaveBeenCalledTimes(1);
    now += 1;
    await client.courses();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // Mutation : statut HTTP non vérifié (la page d'erreur serait lue comme une liste).
  it("refuse une réponse HTTP en erreur", async () => {
    const client = new SgtClient({
      fetch: async () => new Response("Service Unavailable", { status: 503 }),
    });
    await expect(client.courses()).rejects.toThrow(new SgtUnavailableError("SGT : HTTP 503"));
  });

  // Mutation : erreur réseau propagée telle quelle au lieu de l'erreur typée.
  it("rend une erreur réseau comme SGT injoignable", async () => {
    const client = new SgtClient({
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(client.courses()).rejects.toThrow(
      new SgtUnavailableError("SGT injoignable : fetch failed"),
    );
  });

  // Mutation : échec gardé en cache.
  it("retente après un échec", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response(SGT_COURSES_HTML));
    const client = new SgtClient({ fetch });
    await expect(client.courses()).rejects.toBeInstanceOf(SgtUnavailableError);
    await expect(client.courses()).resolves.toHaveLength(14);
  });

  // Mutation : délai absent, ou différent de 20 s.
  it("abandonne la requête après 20 s", async () => {
    vi.useFakeTimers();
    const client = new SgtClient({
      fetch: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    });
    let settled = false;
    const result = client.courses().finally(() => {
      settled = true;
    });
    result.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(19_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).rejects.toBeInstanceOf(SgtUnavailableError);
  });

  // Mutation : image demandée sans User-Agent, ou octets altérés.
  it("télécharge l'image de carte d'un parcours", async () => {
    const fetch = fakeFetch();
    const client = new SgtClient({ fetch });
    const image = await client.scorecard(30);
    expect(image.equals(SGT_SCORECARD_30)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_30.jpg",
    );
    expect(new Headers(init?.headers).get("User-Agent")).toBe(
      "golf-handicaps (+https://github.com/emmpaul/golf-handicaps)",
    );
  });
});
