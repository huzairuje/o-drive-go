import type { Metadata } from "next";
import "@/styles/globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "ODrive: Storage Gateway and Relay",
  description: "Provider-agnostic cloud storage relay and streaming gateway.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
