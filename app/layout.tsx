import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
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
  themeColor: "#070816",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${outfit.variable} antialiased`}>
        <div className="star-field" aria-hidden="true" />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
