import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: URL.canParse(siteUrl) ? new URL(siteUrl) : undefined,
  title: "Road to Rally",
  description: "Trace ta spéciale sur la carte de France, roule au chrono, partage le lien.",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      {/* Certaines extensions, comme ColorZilla, ajoutent des attributs à <body> avant React. */}
      <body
        className="h-full overflow-hidden bg-neutral-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
