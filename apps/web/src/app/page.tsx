'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Shield, Activity, Video, Users, Lock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 max-w-4xl mx-auto">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold mb-6">
            <span className="flex h-2 w-2 rounded-full bg-blue-500" />
            Madad Vision AI 2.0 is now live
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight text-white">
            Enterprise Surveillance, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Powered by AI.</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Transform ordinary CCTV cameras into intelligent monitoring systems. Detect humans, vehicles, and unrecognized faces with real-time analytics and alerts.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] flex items-center justify-center gap-2 group">
              Get Started Now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/contact" className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold transition-all flex items-center justify-center gap-2">
              Contact Sales
            </Link>
          </motion.div>
        </motion.div>

        {/* Dashboard Preview Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 100 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1, delay: 0.5, type: "spring" }}
          className="relative mt-20 w-full max-w-5xl rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl glass-card"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10" />
          <div className="h-8 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="aspect-video bg-slate-950 p-6 flex flex-col gap-4 relative">
            <div className="flex justify-between items-center opacity-50">
              <div className="h-6 w-48 bg-slate-800 rounded-md" />
              <div className="h-6 w-24 bg-slate-800 rounded-md" />
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 opacity-50">
              <div className="md:col-span-2 bg-slate-800 rounded-lg border border-slate-700 min-h-[120px]" />
              <div className="md:col-span-1 grid grid-rows-3 gap-4 min-h-[120px]">
                <div className="bg-slate-800 rounded-lg border border-slate-700" />
                <div className="bg-slate-800 rounded-lg border border-slate-700" />
                <div className="bg-slate-800 rounded-lg border border-slate-700" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[#040b1c] border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Complete Security Arsenal</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Everything you need to secure your premises, monitor activities, and respond to threats instantly.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Activity, title: "Real-time Detection", desc: "Instant detection of humans, vehicles, and objects with 99% accuracy.", color: "text-blue-400", bg: "bg-blue-500/10" },
              { icon: Users, title: "Face Recognition", desc: "Identify authorized personnel and alert on unknown faces instantly.", color: "text-purple-400", bg: "bg-purple-500/10" },
              { icon: Shield, title: "Boundary Intrusion", desc: "Draw custom virtual tripwires and polygons to protect secure zones.", color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { icon: Video, title: "Multi-Camera Streaming", desc: "Monitor unlimited RTSP streams seamlessly on a single unified dashboard.", color: "text-amber-400", bg: "bg-amber-500/10" },
              { icon: Lock, title: "Encrypted Storage", desc: "All snapshots and event logs are stored securely using AES-256 encryption.", color: "text-red-400", bg: "bg-red-500/10" },
              { icon: ChevronRight, title: "Instant Alerts", desc: "Receive mobile push notifications and WebSocket alerts within milliseconds.", color: "text-cyan-400", bg: "bg-cyan-500/10" },
            ].map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 rounded-2xl border border-slate-800/60 hover:border-slate-700 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.bg}`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/60 bg-[#020617] text-center text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-slate-600" />
          <span className="font-bold text-slate-400 tracking-tight">Madad Vision AI</span>
        </div>
        <p className="text-sm">© {new Date().getFullYear()} Madad Vision AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
