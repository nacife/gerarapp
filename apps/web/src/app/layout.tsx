import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import ImpersonationBanner from './ImpersonationBanner';
import { MeshBackground } from '../components/MeshBackground';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduForge — Estúdio do Criador',
  description: 'De um PDF a um app de aprendizagem publicado em menos de 30 minutos.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="font-sans">
        <MeshBackground />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ImpersonationBanner />
          <main className="relative z-10">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
