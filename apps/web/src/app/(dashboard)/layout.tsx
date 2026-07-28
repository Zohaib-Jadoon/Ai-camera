import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

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
    <div
      className="min-h-screen bg-[#03050a] text-slate-100 flex flex-col md:flex-row overflow-hidden"
      style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      <Sidebar />
      <main className="flex-1 p-4 md:p-6 overflow-y-auto h-screen min-w-0">
        {children}
      </main>
    </div>
  );
}
