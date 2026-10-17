/**
 * Scorecard draft: what the OCR read (or the user typed), before validation.
 * Shared between the server (OCR worker, save action) and the correction screen.
 * Every cell is a number, or `null` when it could not be read / is still empty.
 */
export type DraftValue = number | null;

/** 18 hole values plus the OUT, IN and TOT totals printed on the card. */
export type DraftHoleRow = {
  holes: DraftValue[];
  out: DraftValue;
  in: DraftValue;
  total: DraftValue;
};

export type DraftPlayerRow = {
  /** Name as read on the card (e.g. "MANU"), before alias matching. */
  name: string | null;
  scores: DraftHoleRow;
};

export type ScorecardDraft = {
  courseName: string | null;
  tees: string | null;
  /** ISO date `yyyy-mm-dd`, or `null` when the card shows none. */
  playedOn: string | null;
  par: DraftHoleRow;
  /** The INDEX row has no totals. */
  strokeIndex: DraftValue[];
  distance: DraftHoleRow;
  players: DraftPlayerRow[];
};
