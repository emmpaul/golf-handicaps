import type { Metadata } from "next";
import { PageTitle } from "@/components/page-title";
import { StrokesPlanner } from "@/components/strokes/strokes-planner";
import { requestDb } from "@/lib/request-db";
import { playerOverviews } from "@/server/players/overview";
import { knownCourses } from "@/server/rounds/courses";

export const metadata: Metadata = { title: "Coups à donner · Handicaps golf" };

export default async function StrokesPage() {
  const db = await requestDb();
  const players = playerOverviews(db).map(({ id, name, indexT }) => ({ id, name, indexT }));
  return (
    <>
      <PageTitle>Coups à donner</PageTitle>
      <StrokesPlanner players={players} courses={knownCourses(db)} />
    </>
  );
}
