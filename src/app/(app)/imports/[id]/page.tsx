import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { emptyEditorState, readEditorState, todayIso } from "@/components/round-editor/form-state";
import { RoundEditor } from "@/components/round-editor/round-editor";
import { requestDb } from "@/lib/request-db";
import type { ScorecardDraft } from "@/scorecard/draft";
import { formFromDraft, getImport } from "@/server/imports/correction";
import { listPlayers } from "@/server/players/players";

export const metadata: Metadata = { title: "Vérifier la carte · Handicaps golf" };

/**
 * Écran de correction d'un import : pré-rempli si la lecture a abouti, vide sinon, la
 * photo restant visible. Un import déjà enregistré renvoie vers son round.
 */
export default async function ImportCorrectionPage({ params }: PageProps<"/imports/[id]">) {
  const { id } = await params;
  const db = await requestDb();
  const row = /^\d+$/.test(id) ? getImport(db, Number(id)) : undefined;
  if (!row) notFound();
  if (row.roundId !== null) redirect(`/rounds/${row.roundId}`);
  const draft = row.draft as ScorecardDraft | null;
  const today = todayIso();
  const initial = draft
    ? readEditorState({ ...formFromDraft(db, draft), playedOn: draft.playedOn ?? today }, true)
    : emptyEditorState(today);
  return (
    <>
      <PageTitle>Vérifier la carte</PageTitle>
      <RoundEditor
        initial={initial}
        players={listPlayers(db)}
        photoUrl={`/api/imports/${row.id}/photo`}
        target={{ kind: "create", importId: row.id }}
      />
    </>
  );
}
