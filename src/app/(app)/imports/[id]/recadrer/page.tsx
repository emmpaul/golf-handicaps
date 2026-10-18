import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecropImport } from "@/components/import/recrop-import";
import { PageTitle } from "@/components/page-title";
import { isRecroppable, parseCorners } from "@/jobs/imports";
import { requestDb } from "@/lib/request-db";
import { getImport } from "@/server/imports/correction";

export const metadata: Metadata = { title: "Recadrer la photo · Handicaps golf" };

/**
 * Recadrage d'un import recadrable : en « Échec », ou « Prêt à vérifier » sans round (spec
 * « Nouvelle lecture après recadrage ») ; sinon, retour aux imports. Les poignées partent des
 * coins enregistrés, ou à 10 % et 90 % de la photo sans coins.
 */
export default async function RecropPage({ params }: PageProps<"/imports/[id]/recadrer">) {
  const { id } = await params;
  const row = /^\d+$/.test(id) ? getImport(await requestDb(), Number(id)) : undefined;
  if (!row) notFound();
  if (!isRecroppable(row)) redirect("/import");
  return (
    <>
      <PageTitle>Recadrer la photo</PageTitle>
      <RecropImport
        id={row.id}
        corners={parseCorners(JSON.stringify(row.corners))}
        hasCorrection={row.correction !== null}
      />
    </>
  );
}
