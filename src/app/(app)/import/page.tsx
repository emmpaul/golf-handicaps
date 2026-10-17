import type { Metadata } from "next";
import Link from "next/link";
import { ImportWorkspace } from "@/components/import/import-workspace";
import { PageTitle } from "@/components/page-title";
import { requestDb } from "@/lib/request-db";
import { listImports } from "@/server/imports/list";

export const metadata: Metadata = { title: "Importer · Handicaps golf" };

export default async function ImportPage() {
  const imports = listImports(await requestDb());
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Importer une carte</PageTitle>
        <Link href="/rounds/new" className="text-sm underline underline-offset-3">
          Saisir un round à la main
        </Link>
      </div>
      <ImportWorkspace imports={imports} />
    </>
  );
}
