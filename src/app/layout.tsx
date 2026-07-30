import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { X_HANDLE } from "@/lib/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pay-rail.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "payrail — USDC payouts on Arc", template: "%s" },
  description:
    "Batch USDC and EURC payouts on Arc with maker/checker approval, sub-second settlement and predictable fees.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "payrail — USDC payouts on Arc",
    description: "Payroll and vendor payouts, settled in one transaction on Arc.",
    images: ["/og.png"],
    siteName: "payrail",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: X_HANDLE,
    creator: X_HANDLE,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} bg-white font-sans text-navy antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
