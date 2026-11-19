import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";
import { Header } from "@/components/header";
import { LocaleEffects } from "@/components/locale-effects";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JISR — earlier, safer mental wellbeing support",
  description:
    "Prototype bridging a positive mental-health screen to real human follow-up. Synthetic data only.",
};

async function IntlShell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <NextIntlClientProvider>
      <LocaleEffects locale={locale} />
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border bg-card px-4 py-3 text-center text-xs text-muted">
        {t("footer")}
      </footer>
    </NextIntlClientProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <IntlShell>{children}</IntlShell>
        </Suspense>
      </body>
    </html>
  );
}