import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "payrail — USDC payouts on Arc",
  description:
    "Batch USDC and EURC payouts on Arc with maker/checker approval, sub-second settlement and predictable fees.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "payrail — USDC payouts on Arc",
    description: "Payroll and vendor payouts, settled in one transaction on Arc.",
    images: ["/og.png"],
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
