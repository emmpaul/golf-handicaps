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
    <div className="flex flex-col gap-1 text-sm">
      {sgtCourseName === null ? null : (
        // Nom et lieu du parcours SGT en deux éléments, sans point médian.
        <span
          data-testid="course-sgt"
          className="flex min-w-0 flex-wrap gap-x-3 break-words text-muted-foreground"
        >
          <span>SGT : {sgtCourseName}</span>
          {sgtCourseLocation ? <span>{sgtCourseLocation}</span> : null}
        </span>
      )}
      <span className="flex flex-wrap gap-x-4">
        <a href={course.scorecardUrl} target="_blank" rel="noreferrer" className={ACTION_LINK}>
          Carte SGT
        </a>
        {course.courseViewUrl ? (
          <a href={course.courseViewUrl} target="_blank" rel="noreferrer" className={ACTION_LINK}>
            The Course View
          </a>
        ) : null}
      </span>
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
          <li
            key={tee.name}
            className="flex flex-wrap items-center justify-between gap-2 border-t py-1.5"
          >
            <span className="flex gap-x-3 text-sm">
              <span className="font-medium">{tee.name}</span>
              <span className="tabular-nums">{ratingText(tee.ratingT, tee.slope)}</span>
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
          <li
            key={candidate.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t py-1.5"
          >
            <span className="flex min-w-0 flex-col text-sm">
              <span className="font-medium">{candidate.name}</span>
              <span className="flex flex-wrap gap-x-3 text-muted-foreground">
                <span>{candidate.location}</span>
                <span>Par {candidate.par}</span>
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

/**
 * Colonnes de la table à partir de 1 024 px : parcours et tees, rating et état, carte SGT et
 * propositions, saisie à la main. En dessous, chaque rangée empile ces parties. L'état de la
 * recherche et sa note vont sous la rating ; quand aucune rangée n'a de carte, de proposition, de
 * tees ou de candidats SGT, la colonne SGT disparaît et la saisie à la main se pose à côté.
 */
const COURSE_COLUMNS = {
  sgt: "lg:grid lg:grid-cols-[minmax(0,1.1fr)_10rem_minmax(0,1.3fr)_minmax(0,1.2fr)] lg:items-start lg:gap-x-6",
  plain: "lg:grid lg:grid-cols-[minmax(0,1.1fr)_10rem_minmax(0,2.5fr)] lg:items-start lg:gap-x-6",
};

/** Le parcours a-t-il quelque chose à montrer dans la colonne SGT (`Links`, `SearchOutcome`) ? */
function hasSgtContent(course: CourseOverview): boolean {
  if (course.scorecardUrl !== null) return true;
  if (course.id === null) return false;
  return (
    (course.status === "proposed" && Boolean(course.proposal)) ||
    (course.status === "choose_tee" && course.teesRead.length > 0) ||
    (course.status === "choose_course" && course.candidates.length > 0)
  );
}

/** Un parcours : rating confirmée ou « sans rating », état de la recherche et actions. */
function CourseRow({ course, sgt }: { course: CourseOverview; sgt: boolean }) {
  const label = courseLabel(course);
  const { id, ratingT, slope } = course;
  return (
    <li
      aria-label={label}
      className={cn(
        "flex min-w-0 flex-col gap-3 border-b px-2 py-3",
        sgt ? COURSE_COLUMNS.sgt : COURSE_COLUMNS.plain,
      )}
    >
      {/* Parcours et tees en deux éléments, sans point médian ; le par à côté. */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="font-heading text-xl leading-tight font-bold [overflow-wrap:anywhere]">
          {course.courseName}
        </h2>
        <span className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          <span>Tees {course.tees}</span>
          <span>Par {course.par}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 lg:flex-col">
        <span data-testid="course-rating" className="font-heading text-xl font-bold tabular-nums">
          {ratingT !== null && slope !== null ? ratingText(ratingT, slope) : "sans rating"}
        </span>
        <Badge variant="secondary" data-testid="course-status">
          {STATUS_LABELS[course.status]}
        </Badge>
        {course.note ? (
          <p data-testid="course-note" className="basis-full text-sm text-muted-foreground">
            {course.note}
          </p>
        ) : null}
      </div>
      {sgt ? (
        <div className="flex min-w-0 flex-col gap-2 max-lg:empty:hidden">
          <Links course={course} />
          {id === null ? null : <SearchOutcome course={course} id={id} />}
        </div>
      ) : null}
      {id === null ? null : (
        <div className="flex min-w-0 flex-col items-start gap-2">
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
        </div>
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
  const sgt = courses.some(hasSgtContent);
  return (
    <>
      <div className="flex flex-col gap-1">
        <PageTitle>Parcours</PageTitle>
        <p className="text-sm text-muted-foreground">
          Course rating et slope par parcours et tees. Une valeur ne compte dans les index qu’une
          fois confirmée.
        </p>
      </div>
      {courses.length === 0 ? (
        <p className="border-t-2 border-foreground pt-3 text-muted-foreground">
          Aucun parcours : enregistrez d’abord un round.
        </p>
      ) : (
        <div className="min-w-0">
          <div
            aria-hidden
            className={cn(
              "hidden bg-band px-2 py-1.5 text-sm font-medium text-band-ink",
              sgt ? COURSE_COLUMNS.sgt : COURSE_COLUMNS.plain,
            )}
          >
            <span>Parcours</span>
            <span>Rating / slope</span>
            {sgt ? <span>Simulator Golf Tour</span> : null}
            <span>Saisie à la main</span>
          </div>
          <ul aria-label="Parcours" className="max-lg:border-t-2 max-lg:border-foreground">
            {courses.map((course) => (
              <CourseRow key={courseLabel(course)} course={course} sgt={sgt} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
