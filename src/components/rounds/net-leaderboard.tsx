import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NO_INDEX, NO_VALUE } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { roundDetail } from "@/server/rounds/detail";

type Entry = NonNullable<ReturnType<typeof roundDetail>>["leaderboard"][number];

const orDash = (value: number | null) => (value === null ? NO_VALUE : value);

/** Cellule de chiffre : police condensée, alignée à droite, resserrée sous 768 px. */
const FIGURE = "text-right font-heading text-base font-semibold max-md:px-1.5";
/** En-tête de colonne de chiffre, aligné à droite sur ses valeurs. */
const FIGURE_HEAD = "text-right text-band-ink max-md:px-1.5";

/**
 * Brut, handicap de jeu, net et rang net de chaque joueur (spec `rounds`), en-tête sur le bandeau
 * d'encre. Toutes les colonnes tiennent à 320 px (spec « Classement lisible sur téléphone ») :
 * en-têtes et mention « pas encore d'index » passent à la ligne plutôt que d'élargir la table.
 * Le nom du gagnant net (rang 1) est en rouge « sous le par ».
 */
export function NetLeaderboard({ entries }: { entries: Entry[] }) {
  return (
    <Table aria-label="Classement net">
      <TableHeader className="bg-band">
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-band-ink max-md:px-1.5">Joueur</TableHead>
          <TableHead className={FIGURE_HEAD}>Brut</TableHead>
          <TableHead className={FIGURE_HEAD}>
            Hcp<span className="max-md:sr-only"> de jeu</span>
          </TableHead>
          <TableHead className={FIGURE_HEAD}>Net</TableHead>
          <TableHead className={FIGURE_HEAD}>Rang</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.playerId}>
            <TableCell
              className={cn(
                "font-heading text-lg font-semibold whitespace-normal max-md:px-1.5",
                entry.rank === 1 && "text-signal",
              )}
            >
              {entry.name}
              {entry.net === null ? (
                <span className="block font-sans text-sm leading-tight font-normal text-muted-foreground">
                  {` ${NO_INDEX}`}
                </span>
              ) : null}
            </TableCell>
            <TableCell className={FIGURE}>{entry.gross}</TableCell>
            <TableCell className={FIGURE}>{orDash(entry.playingHandicap)}</TableCell>
            <TableCell className={cn(FIGURE, entry.net !== null && "font-extrabold")}>
              {orDash(entry.net)}
            </TableCell>
            <TableCell className={FIGURE}>{orDash(entry.rank)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
