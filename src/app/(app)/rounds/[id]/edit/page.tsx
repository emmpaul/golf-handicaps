import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { readEditorState } from "@/components/round-editor/form-state";
import { RoundEditor } from "@/components/round-editor/round-editor";
import { requestDb } from "@/lib/request-db";
import { listPlayers } from "@/server/players/players";
import { knownCourses } from "@/server/rounds/courses";
import { roundDetail } from "@/server/rounds/detail";
import { getRoundForm, RoundNotFoundError } from "@/server/rounds/edit";

export const metadata: Metadata = { title: "Modifier le round · Handicaps golf" };

function loadForm(db: Awaited<ReturnType<typeof requestDb>>, id: string) {
  if (!/^\d+$/.test(id)) return undefined;
  try {
    return getRoundForm(db, Number(id));
  } catch (error) {
    if (error instanceof RoundNotFoundError) return undefined;
    throw error;
  }
}

/** Correction d'un round enregistré : même écran et mêmes contrôles que l'import. */
export default async function EditRoundPage({ params }: PageProps<"/rounds/[id]/edit">) {
  const { id } = await params;
  const db = await requestDb();
  const form = loadForm(db, id);
  if (!form) notFound();
  return (
    <>
      <PageTitle>Modifier le round</PageTitle>
      <RoundEditor
        initial={readEditorState(form, false)}
        players={listPlayers(db)}
        courses={knownCourses(db)}
        photoUrl={roundDetail(db, Number(id))?.photoPath ? `/api/rounds/${id}/photo` : undefined}
        target={{ kind: "update", roundId: Number(id) }}
      />
    </>
  );
}
