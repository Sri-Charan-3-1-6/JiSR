import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans, IBM_Plex_Sans_Arabic, Noto_Sans_Devanagari, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Header } from "@/components/header";
import { LocaleEffects } from "@/components/locale-effects";
import { MotionProvider } from "@/components/motion-provider";
import { ToastProvider } from "@/components/ui/toast";

const latin = Plus_Jakarta_Sans({
  variable: "--font-latin",
  subsets: ["latin"],
});

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JISR — earlier, safer mental wellbeing support",
  description:
    "Prototype bridging a positive mental-health screen to real human follow-up. Synthetic data only.",
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
          <LocaleEffects locale={locale} />
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">{children}</main>
          <footer className="border-t border-border bg-card px-4 py-3 pb-20 text-center text-xs text-muted md:pb-3">
            {t("footer")}
          </footer>
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