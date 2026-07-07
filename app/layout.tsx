import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mill Valley Townstir — Community Calendar",
  description: "Everything happening in Mill Valley, CA — all in one place.",
  verification: {
    google: "uf1jmebJXluc-pzzJqJq5Cz5atYEV2jY06YcJGGwgF4",
  },
  openGraph: {
    title: "Mill Valley Townstir — Community Calendar",
    description: "Everything happening in Mill Valley, CA — all in one place.",
    url: "https://www.townstir.com",
    siteName: "Townstir Mill Valley",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mill Valley Townstir — Community Calendar",
    description: "Everything happening in Mill Valley, CA — all in one place.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a3d2b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Townstir" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
        {children}
      </body>
    </html>
  );
}