const playedOnFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Date de jeu ISO vers « 17 octobre 2026 ». */
export function formatPlayedOn(playedOn: string): string {
  return playedOnFormat.format(new Date(`${playedOn}T00:00:00Z`));
}

/** Valeur en dixièmes entiers vers « 17,4 ». */
export function formatTenths(tenths: number): string {
  return (tenths / 10).toFixed(1).replace(".", ",");
}

export const NO_VALUE = "—";
export const NO_INDEX = "pas encore d'index";

/** Index affiché : « 10,0 », « 14,5 (provisoire) » ou « — » sans round. */
export function formatIndex(indexT: number | null, provisional: boolean): string {
  if (indexT === null) return NO_VALUE;
  return provisional ? `${formatTenths(indexT)} (provisoire)` : formatTenths(indexT);
}
