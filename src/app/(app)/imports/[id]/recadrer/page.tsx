import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RecropImport } from "@/components/import/recrop-import";
import { PageTitle } from "@/components/page-title";
import { parseCorners } from "@/jobs/imports";
import { requestDb } from "@/lib/request-db";
import { getImport } from "@/server/imports/correction";

export const metadata: Metadata = { title: "Recadrer la photo · Handicaps golf" };

/** Recadrage d'un import en « Échec » (spec « Échec de la lecture ») ; sinon, retour aux imports. */
export default async function RecropPage({ params }: PageProps<"/imports/[id]/recadrer">) {
  const { id } = await params;
  const row = /^\d+$/.test(id) ? getImport(await requestDb(), Number(id)) : undefined;
  if (!row) notFound();
  if (row.status !== "failed") redirect("/import");
  return (
    <>
      <PageTitle>Recadrer la photo</PageTitle>
      <RecropImport id={row.id} corners={parseCorners(JSON.stringify(row.corners))} />
    </>
  );
}
