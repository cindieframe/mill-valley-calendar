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
    google: "kdNDYphQewhkfrLIxkmlo4J9UOnjPirwgu6fL9WEYZU",
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
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}