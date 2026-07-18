import type { Metadata } from "next";
import { VivaDraftProvider } from "@/components/viva-draft-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viva",
  description: "Evidence of understanding, not accusations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><VivaDraftProvider>{children}</VivaDraftProvider></body>
    </html>
  );
}
