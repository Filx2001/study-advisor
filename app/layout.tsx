import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Advisor",
  description: "Find a summer programme, in Arabic or English.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
