import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { imports, playerRoundStats } from "@/db/schema";
import { homeSummary } from "@/server/home/summary";
import { saveRound } from "@/server/rounds/save";
import { referenceForm, seededTestDbPerTest } from "../../factories";

const testDb = seededTestDbPerTest();

function round(date: string, index: number) {
  const { db, ids } = testDb;
  const form = referenceForm([ids.Gab]);
  const id = saveRound(db, { ...form, playedOn: date, players: [form.players[0]] });
  return { id, index };
}

it("reads the latest two indexes and the latest round by playing date", () => {
  const { db, ids } = testDb;
  const rounds = [round("2026-10-17", 158), round("2026-10-01", 170), round("2026-10-10", 155)];
  // Persisted snapshots isolate the summary from WHS rules, which have their own tests.
  for (const { id, index } of rounds)
    db.update(playerRoundStats)
      .set({ indexAfterT: index })
      .where(and(eq(playerRoundStats.roundId, id), eq(playerRoundStats.playerId, ids.Gab)))
      .run();
  // Mutation: at(-2) → at(0) gives -12 instead of +3 with these three snapshots.
  const summary = homeSummary(db);
  expect(summary.players.find((p) => p.id === ids.Gab)).toMatchObject({
    indexT: 158,
    deltaT: 3,
    provisional: false,
  });
  expect(summary.latestRound).toMatchObject({ id: rounds[0].id, playedOn: "2026-10-17" });
  expect(summary.players.find((p) => p.id === ids.Sean)).toMatchObject({
    indexT: null,
    deltaT: null,
  });
});

it("has no delta for the first round and uses the previous index with two rounds", () => {
  const { db, ids } = testDb;
  const first = round("2026-10-01", 155);
  expect(homeSummary(db).players.find((p) => p.id === ids.Gab)).toMatchObject({
    deltaT: null,
    provisional: true,
  });
  const second = round("2026-10-10", 158);
  for (const { id, index } of [first, second])
    db.update(playerRoundStats)
      .set({ indexAfterT: index })
      .where(eq(playerRoundStats.roundId, id))
      .run();
  expect(homeSummary(db).players.find((p) => p.id === ids.Gab)).toMatchObject({
    indexT: 158,
    deltaT: 3,
  });
});

it("counts only ready, unrecorded imports and links the newest", () => {
  const { db } = testDb;
  const saved = round("2026-10-17", 10);
  const ready = db
    .insert(imports)
    .values([
      { photoPath: "a.jpg", status: "ready" },
      { photoPath: "b.jpg", status: "ready" },
    ])
    .returning()
    .all();
  db.insert(imports)
    .values([
      { photoPath: "c.jpg", status: "ready", roundId: saved.id },
      { photoPath: "d.jpg", status: "reading" },
    ])
    .run();
  expect(homeSummary(db).pendingImports).toEqual({ count: 2, latestId: ready[1].id });
});

it("returns empty states", () => {
  expect(homeSummary(testDb.db)).toMatchObject({
    latestRound: null,
    pendingImports: { count: 0, latestId: null },
  });
});

it("counts pending imports older than the import page's 20 entries", () => {
  const { db } = testDb;
  const oldest = db
    .insert(imports)
    .values({ photoPath: "old.jpg", status: "ready" })
    .returning()
    .get();
  db.insert(imports)
    .values(Array.from({ length: 21 }, () => ({ photoPath: "new.jpg", status: "failed" as const })))
    .run();
  expect(homeSummary(db).pendingImports).toEqual({ count: 1, latestId: oldest.id });
});
