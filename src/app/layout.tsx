import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rally",
  description: "Rallye low-poly dans le navigateur",
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
