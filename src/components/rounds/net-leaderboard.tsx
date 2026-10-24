import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NO_INDEX, NO_VALUE } from "@/lib/format";
import type { roundDetail } from "@/server/rounds/detail";

type Entry = NonNullable<ReturnType<typeof roundDetail>>["leaderboard"][number];

const orDash = (value: number | null) => (value === null ? NO_VALUE : value);

/** Brut, handicap de jeu, net et rang net de chaque joueur (spec `rounds`). */
export function NetLeaderboard({ entries }: { entries: Entry[] }) {
  return (
    <Table aria-label="Classement net">
      <TableHeader>
        <TableRow>
          <TableHead>Joueur</TableHead>
          <TableHead className="text-right">Brut</TableHead>
          <TableHead className="text-right">Hcp de jeu</TableHead>
          <TableHead className="text-right">Net</TableHead>
          <TableHead className="text-right">Rang</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.playerId}>
            <TableCell className="font-medium">{entry.name}</TableCell>
            <TableCell className="text-right">{entry.gross}</TableCell>
            <TableCell className="text-right">{orDash(entry.playingHandicap)}</TableCell>
            <TableCell className="text-right">
              {entry.net === null ? (
                <>
                  {`${NO_VALUE} `}
                  <span className="text-xs text-muted-foreground">{NO_INDEX}</span>
                </>
              ) : (
                entry.net
              )}
            </TableCell>
            <TableCell className="text-right">{orDash(entry.rank)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
