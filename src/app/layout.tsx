import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anchor",
  description: "A dignity-preserving memory companion for people with MCI / early dementia and their caregivers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
