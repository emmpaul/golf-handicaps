import { z } from "zod";
import { MAX_PLAYERS, type RoundForm } from "./checks";

/** Valeur d'une case : un entier, ou `null` quand la case est vide. */
export const value = z.number().int().nullable();

/** 18 trous et les totaux OUT, IN et TOT. */
export const holeRow = z.object({
  holes: z.array(value).length(18),
  out: value,
  in: value,
  total: value,
});

/** Carte sans ses lignes de joueur : parcours, tees, date, par, index et distance. */
export const cardSchema = z.object({
  courseName: z.string().nullable(),
  tees: z.string().nullable(),
  playedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  par: holeRow,
  strokeIndex: z.array(value).length(18),
  distance: holeRow,
}) satisfies z.ZodType<Omit<RoundForm, "players">>;

/**
 * Correction enregistrée d'un import : l'état de l'éditeur sans la `key` locale des lignes.
 * Validée à l'écriture (corps invalide : 400) et à la lecture (illisible : on repart de la lecture).
 */
export const savedCorrectionSchema = z.object({
  version: z.literal(1),
  card: cardSchema,
  readCardTotals: z.boolean(),
  lines: z
    .array(
      z.object({
        name: z.string().nullable(),
        playerId: value,
        scores: holeRow,
        readTotals: z.boolean(),
      }),
    )
    .max(MAX_PLAYERS),
  aiCells: z.array(z.string()).max(100),
});

export type SavedCorrection = z.infer<typeof savedCorrectionSchema>;
