import Link from "next/link";
import { LINKS } from "@/components/app-nav";
import { PageTitle } from "@/components/page-title";

export default function Home() {
  return (
    <>
      <PageTitle>Handicaps golf</PageTitle>
      <ul aria-label="Sections" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {LINKS.map(({ href, label, description }) => (
          <li key={href} className="flex rounded-lg border hover:bg-muted/50">
            <Link href={href} className="flex flex-1 flex-col gap-1 p-4">
              <span className="font-heading font-semibold">{label}</span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
