import type { Metadata } from "next";
import "./globals.css";
import DevLogin from "@/components/DevLogin";

export const metadata: Metadata = {
  title: "BharatGrowth — Speed Billing for Indian SMBs",
  description: "Desktop-first billing and WhatsApp loyalty marketing for Tyre Shops, Sweet Stalls, and Garment Stores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DevLogin />
        {children}
      </body>
    </html>
  );
}
