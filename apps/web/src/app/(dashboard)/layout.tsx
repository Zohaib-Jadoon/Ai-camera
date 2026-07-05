import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Madad Vision AI",
  description: "Enterprise Security Control Room.",
};

export default function DashboardRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#03050a] text-slate-100 flex flex-col md:flex-row" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
