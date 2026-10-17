import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const UNREADABLE_PHOTO = "Format de photo non lisible, exporte-la en JPEG";

export function UnreadablePhoto() {
  return (
    <Alert variant="destructive">
      <AlertTitle>{UNREADABLE_PHOTO}</AlertTitle>
      <AlertDescription>
        <p>
          Ou saisis le round à la main : <Link href="/rounds/new">Saisie manuelle</Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}
