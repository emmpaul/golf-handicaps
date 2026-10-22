"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/instance";
import {
  CourseRatingInputError,
  chooseCandidate,
  chooseTee,
  confirmProposal,
  relaunchSearch,
  saveManualRating,
} from "@/server/courses/manage";

export type CourseFormState = { error: string | null; done: number };

const text = (formData: FormData, field: string) => String(formData.get(field) ?? "");
const courseId = (formData: FormData) => Number(formData.get("id"));

/**
 * Exécute une action de la page Parcours et traduit un refus (`CourseRatingInputError`) en
 * message. Une rating écrite change les index : tout le layout est revalidé.
 */
function attempt(previous: CourseFormState, write: () => void): CourseFormState {
  try {
    write();
  } catch (error) {
    if (error instanceof CourseRatingInputError) return { ...previous, error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { error: null, done: previous.done + 1 };
}

export async function confirmProposalAction(
  previous: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  return attempt(previous, () => confirmProposal(getDb(), courseId(formData)));
}

export async function chooseTeeAction(
  previous: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  return attempt(previous, () => chooseTee(getDb(), courseId(formData), text(formData, "tee")));
}

export async function chooseCandidateAction(
  previous: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  return attempt(previous, () =>
    chooseCandidate(getDb(), courseId(formData), Number(formData.get("sgtCourseId"))),
  );
}

export async function saveManualRatingAction(
  previous: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  return attempt(previous, () =>
    saveManualRating(getDb(), courseId(formData), {
      rating: text(formData, "rating"),
      slope: text(formData, "slope"),
    }),
  );
}

export async function relaunchSearchAction(
  previous: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  return attempt(previous, () => relaunchSearch(getDb(), courseId(formData)));
}
