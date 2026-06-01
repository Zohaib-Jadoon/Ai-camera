'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <title>Madad Vision AI — AI-Powered Surveillance Platform</title>
        <meta name="description" content="Enterprise-grade AI CCTV surveillance platform with real-time detection, face recognition, and smart alerts." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.className} h-full bg-[#020817]`}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
