/** GSPro "ROUND SETTINGS" band: `DATE: mm/dd/yyyy` (US order) and `TEES: <name> <length>yd`. */
const DATE = /DATE:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const TEES = /TEES:\s*(\w+)/;

/** ISO date `yyyy-mm-dd` read from the settings text, or null when absent or not a real date. */
export function parsePlayedOn(text: string): string | null {
  const match = DATE.exec(text);
  if (!match) return null;
  const [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!isRealDate) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseTees(text: string): string | null {
  return TEES.exec(text)?.[1] ?? null;
}
