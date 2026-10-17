export type PlayerCandidate = { id: number; name: string; aliases: readonly string[] };

/** `exact` : associée directement ; `close` : pré-associée, l'utilisateur peut changer. */
export type PlayerMatch = { playerId: number; match: "exact" | "close" };

const MAX_CLOSE_DISTANCE = 1;

export const normalizePlayerName = (value: string) => value.trim().toUpperCase();

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Associe un nom lu sur une carte à un joueur (spec `players`) : nom ou alias identique,
 * sans casse ni espaces autour ; sinon le seul joueur à au plus 1 caractère ; sinon `null`.
 */
export function matchPlayerName(
  read: string,
  candidates: readonly PlayerCandidate[],
): PlayerMatch | null {
  const wanted = normalizePlayerName(read);
  const distances = candidates.map((candidate) => ({
    playerId: candidate.id,
    distance: Math.min(
      ...[candidate.name, ...candidate.aliases].map((label) =>
        levenshtein(wanted, normalizePlayerName(label)),
      ),
    ),
  }));
  const exact = distances.find((d) => d.distance === 0);
  if (exact) return { playerId: exact.playerId, match: "exact" };
  const close = distances.filter((d) => d.distance <= MAX_CLOSE_DISTANCE);
  return close.length === 1 ? { playerId: close[0].playerId, match: "close" } : null;
}
