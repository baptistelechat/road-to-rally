import type { Metadata } from "next";
import { Manrope, Michroma, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-michroma",
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: URL.canParse(siteUrl) ? new URL(siteUrl) : undefined,
  title: "Road to Rally",
  description:
    "Trace ta spéciale sur la carte de France, roule au chrono, partage le lien.",
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`dark ${michroma.variable} ${manrope.variable} ${shareTechMono.variable} h-full antialiased`}
    >
      {/* Certaines extensions, comme ColorZilla, ajoutent des attributs à <body> avant React. */}
      <body
        className="h-full overflow-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
