import type { Metadata } from "next";
import { CourseAction } from "@/components/courses/course-action";
import { ManualRatingForm } from "@/components/courses/manual-rating-form";
import { PageTitle } from "@/components/page-title";
import { courseLabel } from "@/components/round-editor/form-state";
import { Badge } from "@/components/ui/badge";
import { formatTenths } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { ACTION_LINK, cn } from "@/lib/utils";
import { type CourseOverview, courseRatingOverview } from "@/server/courses/manage";
import { sgtScorecardUrl } from "@/server/courses/sgt";
import {
  chooseCandidateAction,
  chooseTeeAction,
  confirmProposalAction,
  relaunchSearchAction,
} from "./actions";

export const metadata: Metadata = { title: "Parcours · Handicaps golf" };

/** État de la recherche SGT, tel qu'affiché (design `add-course-rating`, décision 2). */
const STATUS_LABELS: Record<CourseOverview["status"], string> = {
  pending: "Recherche en cours",
  proposed: "Proposition à confirmer",
  choose_course: "Parcours SGT à choisir",
  choose_tee: "Tee à choisir",
  manual: "Saisie manuelle",
  not_found: "Introuvable sur SGT",
  failed: "Recherche échouée",
  confirmed: "Confirmé",
};

const ratingText = (ratingT: number, slope: number) => `${formatTenths(ratingT)} / ${slope}`;

/** Parcours SGT retenu (nom et lieu, design, Risks : homonymes) et ses liens d'aide. */
function Links({ course }: { course: CourseOverview }) {
  if (course.scorecardUrl === null) return null;
  const { sgtCourseName, sgtCourseLocation } = course;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 text-sm">
      {sgtCourseName === null ? null : (
        <span data-testid="course-sgt" className="min-w-0 break-words text-muted-foreground">
          SGT : {[sgtCourseName, sgtCourseLocation].filter(Boolean).join(" · ")}
        </span>
      )}
      <a href={course.scorecardUrl} target="_blank" rel="noreferrer" className={ACTION_LINK}>
        Carte SGT
      </a>
      {course.courseViewUrl ? (
        <a href={course.courseViewUrl} target="_blank" rel="noreferrer" className={ACTION_LINK}>
          The Course View
        </a>
      ) : null}
    </div>
  );
}

/** Proposition, tees lus ou candidats SGT, selon l'état de la recherche. */
function SearchOutcome({ course, id }: { course: CourseOverview; id: number }) {
  const label = courseLabel(course);
  if (course.status === "proposed" && course.proposal) {
    const { name, ratingT, slope } = course.proposal;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p data-testid="course-proposal" className="text-sm">
          Proposition : tee {name}, {ratingText(ratingT, slope)}
        </p>
        <CourseAction
          action={confirmProposalAction}
          courseId={id}
          label="Confirmer"
          accessibleName={`Confirmer ${ratingText(ratingT, slope)} pour ${label}`}
          variant="default"
        />
      </div>
    );
  }
  if (course.status === "choose_tee" && course.teesRead.length > 0) {
    return (
      <ul aria-label={`Tees lus pour ${label}`} className="flex flex-col gap-2">
        {course.teesRead.map((tee) => (
          <li key={tee.name} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              {tee.name} · {ratingText(tee.ratingT, tee.slope)}
            </span>
            <CourseAction
              action={chooseTeeAction}
              courseId={id}
              fields={{ tee: tee.name }}
              label="Retenir"
              accessibleName={`Retenir le tee ${tee.name}`}
            />
          </li>
        ))}
      </ul>
    );
  }
  if (course.status === "choose_course" && course.candidates.length > 0) {
    return (
      <ul aria-label={`Parcours SGT possibles pour ${label}`} className="flex flex-col gap-2">
        {course.candidates.map((candidate) => (
          <li key={candidate.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col text-sm">
              <span className="font-medium">{candidate.name}</span>
              <span className="text-muted-foreground">
                {candidate.location} · par {candidate.par}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <a
                href={sgtScorecardUrl(candidate.id)}
                target="_blank"
                rel="noreferrer"
                className={cn(ACTION_LINK, "text-sm")}
              >
                Carte SGT
              </a>
              <CourseAction
                action={chooseCandidateAction}
                courseId={id}
                fields={{ sgtCourseId: candidate.id }}
                label="Choisir"
                accessibleName={`Choisir ${candidate.name} (${candidate.location})`}
              />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

/** Un parcours : rating confirmée ou « sans rating », état de la recherche et actions. */
function CourseCard({ course }: { course: CourseOverview }) {
  const label = courseLabel(course);
  const { id, ratingT, slope } = course;
  return (
    <li aria-label={label} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="font-heading font-semibold break-words">
          {course.courseName} · {course.tees}
        </h2>
        <span className="text-sm text-muted-foreground">Par {course.par}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span data-testid="course-rating" className="font-medium">
          {ratingT !== null && slope !== null ? ratingText(ratingT, slope) : "sans rating"}
        </span>
        <Badge variant="secondary" data-testid="course-status">
          {STATUS_LABELS[course.status]}
        </Badge>
      </div>
      {course.note ? (
        <p data-testid="course-note" className="text-sm text-muted-foreground">
          {course.note}
        </p>
      ) : null}
      <Links course={course} />
      {id === null ? null : (
        <>
          <SearchOutcome course={course} id={id} />
          <ManualRatingForm
            courseId={id}
            course={label}
            defaultRating={ratingT === null ? "" : formatTenths(ratingT)}
            defaultSlope={slope === null ? "" : String(slope)}
          />
          {course.status === "pending" ? null : (
            <CourseAction
              action={relaunchSearchAction}
              courseId={id}
              label="Relancer la recherche"
              accessibleName={`Relancer la recherche pour ${label}`}
            />
          )}
        </>
      )}
    </li>
  );
}

/**
 * Parcours connus avec leur course rating et leur slope (spec `course-rating`) : valeur
 * confirmée ou « sans rating », état de la recherche SGT, confirmation, choix, saisie à la
 * main et relance. Hors de la navigation principale : « Rounds » reste la section courante.
 */
export default async function CoursesPage() {
  const courses = courseRatingOverview(await requestDb());
  return (
    <>
      <div className="flex flex-col gap-1">
        <PageTitle>Parcours</PageTitle>
        <p className="text-sm text-muted-foreground">
          Course rating et slope par parcours et tees. Une valeur ne compte dans les index qu'une
          fois confirmée.
        </p>
      </div>
      {courses.length === 0 ? (
        <p className="text-muted-foreground">Aucun parcours : enregistrez d'abord un round.</p>
      ) : null}
      <ul
        aria-label="Parcours"
        className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        {courses.map((course) => (
          <CourseCard key={courseLabel(course)} course={course} />
        ))}
      </ul>
    </>
  );
}
