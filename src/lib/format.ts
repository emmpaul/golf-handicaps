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

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Instant vers « 17 octobre 2026, 19:32 », en heure locale : la date comme une date de jeu. */
export function formatDateTime(date: Date): string {
  return `${formatPlayedOn(localDateToIso(date))}, ${timeFormat.format(date)}`;
}

/** Date ISO « 2026-10-17 » vers le 17 octobre à minuit, heure locale. */
export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Date locale vers « 2026-10-17 », sans passer par UTC. */
export function localDateToIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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

/** Écart en dixièmes : signe explicite, ou égalité. */
export function formatSignedTenths(tenths: number): string {
  if (tenths === 0) return "=";
  return `${tenths < 0 ? "−" : "+"}${formatTenths(Math.abs(tenths))}`;
}
