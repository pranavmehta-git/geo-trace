import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResiDues — Figure out where you were, without being tracked",
  description:
    "Privacy-first forensic timeline builder for taxes, visas, and residency compliance. Reconstruct your location history from photo metadata — entirely in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
