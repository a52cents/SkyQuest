import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { AppRouteShell } from "@/components/navigation/AppRouteShell";

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
  themeColor: "#0a0a0b",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "!function(){try{var e=localStorage.getItem('skyquest.night-mode.v1')==='1',t=document.documentElement;t.classList.toggle('night-mode',e);var n=document.querySelector('meta[name=\"theme-color\"]');n&&(n.content=e?'#1a0000':'#0a0a0b')}catch(e){}}();",
          }}
        />
      </head>
      <body className="antialiased">
        <div className="star-field" aria-hidden="true" />
        <AppRouteShell>{children}</AppRouteShell>
        <PwaRegister />
      </body>
    </html>
  );
}
