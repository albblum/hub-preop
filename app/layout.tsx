import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HubChrome } from "@/components/hub-chrome";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hub pre-op — Phase 5",
  description: "Pre-operational Hub prototype — registry, audit export, access control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <HubChrome>{children}</HubChrome>
        </Providers>
      </body>
    </html>
  );
}
