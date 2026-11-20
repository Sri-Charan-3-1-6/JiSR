import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic, Noto_Sans_Devanagari, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Header } from "@/components/header";
import { LocaleEffects } from "@/components/locale-effects";
import { MotionProvider } from "@/components/motion-provider";
import { ToastProvider } from "@/components/ui/toast";
import { DemoProvider } from "@/components/demo/demo-provider";
import { DemoGuide } from "@/components/demo/demo-guide";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const latin = Plus_Jakarta_Sans({
  variable: "--font-latin",
  subsets: ["latin"],
  // optional: never swap-repaint after first paint, so LCP cannot jitter with font arrival
  display: "optional",
});

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  preload: false,
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "JISR — earlier, safer mental wellbeing support",
  description:
    "Prototype bridging a positive mental-health screen to real human follow-up. Synthetic data only.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#246454",
};

// Applies the saved theme before first paint; keeps the root layout static.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )jisr_theme=(dark|light)/);if(m)document.documentElement.dataset.theme=m[1];}catch(e){}})();`;

async function IntlShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <NextIntlClientProvider>
      <MotionProvider>
        <ToastProvider>
          <DemoProvider>
            <LocaleEffects locale={locale} />
            <a href="#main-content" className="skip-link">{t("skipToContent")}</a>
            <Header />
            <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
            <footer className="border-t border-border px-6 py-6 pb-24 text-center text-xs leading-relaxed text-muted md:pb-6">
              {t("footer")}{" "}
              <Link href="/about" className="font-semibold text-primary underline-offset-2 hover:underline">
                {t("aboutLink")}
              </Link>
            </footer>
            <DemoGuide />
            <ServiceWorkerRegister />
          </DemoProvider>
        </ToastProvider>
      </MotionProvider>
    </NextIntlClientProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${latin.variable} ${arabic.variable} ${devanagari.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <IntlShell>{children}</IntlShell>
        </Suspense>
      </body>
    </html>
  );
}