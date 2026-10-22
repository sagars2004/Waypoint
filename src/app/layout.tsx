import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waypoint — Multimodal NYC/NJ Commute Agent",
  description: "Waypoint tells NYC/NJ commuters when to leave with confidence-rated journey risk, Plan B fallbacks, and real-time transit intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-white text-zinc-900 antialiased light">
      <body className="min-h-full flex flex-col bg-white text-zinc-900">{children}</body>
    </html>
  );
}
