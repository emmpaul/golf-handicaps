import type { Metadata } from "next";
import Link from "next/link";
import { ImportWorkspace } from "@/components/import/import-workspace";
import { PageTitle } from "@/components/page-title";
import { requestDb } from "@/lib/request-db";
import { ACTION_LINK, cn } from "@/lib/utils";
import { listImports } from "@/server/imports/list";

export const metadata: Metadata = { title: "Importer · Handicaps golf" };

export default async function ImportPage() {
  const imports = listImports(await requestDb());
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Importer une carte</PageTitle>
        <Link href="/rounds/new" className={cn(ACTION_LINK, "text-sm")}>
          Saisir un round à la main
        </Link>
      </div>
      <ImportWorkspace imports={imports} />
    </>
  );
}
