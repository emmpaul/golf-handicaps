import * as z from "zod/v4";

/** Valeur d'une case, `null` quand l'IA ne la lit pas. */
const value = z.number().int().nullable();

/**
 * 18 valeurs par trou. La sortie structurée de l'API n'applique pas `minItems`/`maxItems`
 * au-delà de 0 ou 1 : le SDK les passe dans la description du schéma, et c'est `parse`
 * (zod) qui rejette une ligne d'une autre longueur.
 */
const holes = z.array(value).length(18);

/** 18 valeurs plus les totaux OUT, IN et TOT imprimés sur la carte. */
const holeRow = z.object({ holes, out: value, in: value, total: value });

/** Carte complète lue par l'IA (design, décision 3), sans la date. */
export const aiCardSchema = z.object({
  courseName: z.string().nullable(),
  tees: z.string().nullable(),
  par: holeRow,
  strokeIndex: holes,
  distance: holeRow,
  players: z.array(z.object({ name: z.string().nullable(), scores: holeRow })),
});

export type AiCard = z.infer<typeof aiCardSchema>;
