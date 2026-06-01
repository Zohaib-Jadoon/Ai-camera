import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AlertToast from "@/components/AlertToast";
import AlertSound from "@/components/alert-sound";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Madad Vision AI — Dashboard",
  description: "AI-Powered Smart CCTV Surveillance Platform",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} h-full flex bg-[#020817]`}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
      <AlertToast />
      <AlertSound />
    </div>
  );
}
