import type { Metadata } from "next";
import { PageTitle } from "@/components/page-title";
import { emptyEditorState, todayIso } from "@/components/round-editor/form-state";
import { RoundEditor } from "@/components/round-editor/round-editor";
import { requestDb } from "@/lib/request-db";
import { listPlayers } from "@/server/players/players";
import { knownCourses } from "@/server/rounds/courses";

export const metadata: Metadata = { title: "Saisie manuelle · Handicaps golf" };

/** Round saisi entièrement à la main, sur l'écran de correction vide (spec `scorecard-import`). */
export default async function NewRoundPage() {
  const db = await requestDb();
  return (
    <>
      <PageTitle>Saisie manuelle</PageTitle>
      <RoundEditor
        initial={emptyEditorState(todayIso())}
        players={listPlayers(db)}
        courses={knownCourses(db)}
        target={{ kind: "create" }}
      />
    </>
  );
}
