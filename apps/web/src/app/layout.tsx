'use client';

import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import CustomCursor from "@/components/CustomCursor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <title>Madad Vision AI — Enterprise Surveillance Suite</title>
        <meta name="description" content="Enterprise-grade AI CCTV surveillance platform with real-time face detection, perimeter intrusion, and PPE compliance monitoring." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#03050a" />
      </head>
      <body className="h-full bg-[#03050a] text-slate-100" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
        <QueryProvider>
          <CustomCursor />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
