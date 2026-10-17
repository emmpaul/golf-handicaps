import { seedInitialPlayers } from "@/server/players/seed";
import { seedReferenceRound } from "@/server/rounds/seed";
import type { Db } from "./client";

export type Seeder = (db: Db) => void;

/** Données d'une base locale recréée par `pnpm db:reset`, appliquées dans cet ordre. */
export const localSeeders: readonly Seeder[] = [seedInitialPlayers, seedReferenceRound];
