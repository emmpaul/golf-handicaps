import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    { media: "(prefers-color-scheme: light)", color: "#F7F5EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1713" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
