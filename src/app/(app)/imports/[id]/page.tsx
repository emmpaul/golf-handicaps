import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { todayIso } from "@/components/round-editor/form-state";
import { RoundEditor } from "@/components/round-editor/round-editor";
import { requestDb } from "@/lib/request-db";
import { getImport, initialEditorState } from "@/server/imports/correction";
import { listPlayers } from "@/server/players/players";

export const metadata: Metadata = { title: "Vérifier la carte · Handicaps golf" };

/**
 * Écran de correction d'un import : la correction enregistrée s'il y en a une, sinon la
 * lecture si elle a abouti, vide sinon, la photo restant visible. Un import déjà
 * enregistré renvoie vers son round.
 */
export default async function ImportCorrectionPage({ params }: PageProps<"/imports/[id]">) {
  const { id } = await params;
  const db = await requestDb();
  const row = /^\d+$/.test(id) ? getImport(db, Number(id)) : undefined;
  if (!row) notFound();
  if (row.roundId !== null) redirect(`/rounds/${row.roundId}`);
  const initial = initialEditorState(db, row, todayIso());
  return (
    <>
      <PageTitle>Vérifier la carte</PageTitle>
      <RoundEditor
        initial={initial}
        players={listPlayers(db)}
        photoUrl={`/api/imports/${row.id}/photo`}
        aiNote={row.aiNote}
        target={{ kind: "create", importId: row.id }}
      />
    </>
  );
}
