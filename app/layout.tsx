import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SkyQuest",
  description: "Découvre quoi observer dans le ciel maintenant.",
  applicationName: "SkyQuest",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SkyQuest",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070911",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} antialiased`}>
        <div className="star-field" aria-hidden="true" />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
