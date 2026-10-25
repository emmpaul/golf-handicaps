import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Sofia_Sans_Condensed } from "next/font/google";
import { BRAND_COLORS } from "./brand-colors";
import "./globals.css";

// Polices variables auto-hébergées ; `tokens.css` les nomme `--font-display` et `--font-body`.
// Sofia Sans Condensed porte les noms, les index et les scores (chiffres tabulaires) ;
// IBM Plex Sans le texte, les libellés et les boutons.
const display = Sofia_Sans_Condensed({
  variable: "--font-sofia-sans-condensed",
  subsets: ["latin", "latin-ext"],
});

const body = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Handicaps golf",
  description: "Index simulateur et coups à donner pour le groupe",
  // Barre d'état opaque : le contenu ne passe pas dessous, l'en-tête n'a rien à compenser.
  appleWebApp: { capable: true, title: "Golf", statusBarStyle: "default" },
};

// `viewport-fit=cover` : en plein écran, la page va jusque sous l'encoche et la barre d'accueil,
// les marges de zone sûre (`env(safe-area-inset-*)`) font le reste.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_COLORS.paper },
    { media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.paperDark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
