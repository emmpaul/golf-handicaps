import type { Metadata } from "next";
import { PageTitle } from "@/components/page-title";
import { StrokesPlanner } from "@/components/strokes/strokes-planner";
import { requestDb } from "@/lib/request-db";
import { ratingFor } from "@/server/courses/ratings";
import { playerOverviews } from "@/server/players/overview";
import { knownCourses } from "@/server/rounds/courses";

export const metadata: Metadata = { title: "Coups à donner · Handicaps golf" };

export default async function StrokesPage() {
  const db = await requestDb();
  const players = playerOverviews(db).map(({ id, name, indexT }) => ({ id, name, indexT }));
  // Rating confirmée de chaque parcours connu, ou repli par / 113 (spec `match-strokes`).
  const courses = knownCourses(db).map((course) => {
    const par = course.pars.reduce((total, holePar) => total + holePar, 0);
    return { ...course, par, rating: ratingFor(db, course.courseName, course.tees, par) };
  });
  return (
    <>
      <PageTitle>Coups à donner</PageTitle>
      <StrokesPlanner players={players} courses={courses} />
    </>
  );
}
