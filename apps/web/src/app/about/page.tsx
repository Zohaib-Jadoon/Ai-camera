'use client';

import { motion } from 'framer-motion';
import { Target, Users, Zap, ShieldCheck } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';

export default function AboutPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 max-w-3xl mx-auto">
          <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-white">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Madad Vision</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
            We are revolutionizing the physical security industry by bringing state-of-the-art computer vision models directly to existing CCTV infrastructure, enabling proactive threat response instead of reactive video forensics.
          </motion.p>
        </motion.div>
      </section>

      {/* Values Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          {[
            { icon: Target, title: 'Our Mission', text: 'To democratize advanced AI security, making enterprise-grade surveillance capabilities accessible without requiring expensive proprietary hardware upgrades.' },
            { icon: Zap, title: 'Real-Time Edge Processing', text: 'We believe security decisions must happen in milliseconds. Our optimized pipeline ensures detections and alerts are delivered instantaneously.' },
            { icon: ShieldCheck, title: 'Privacy by Design', text: 'We strictly adhere to data privacy standards. All video processing happens locally or in your secure cloud enclave, and biometric data is strongly encrypted.' },
            { icon: Users, title: 'For Security Operators', text: 'We design our interfaces for the people who use them every day—minimizing cognitive load and alert fatigue so operators can focus on real threats.' }
          ].map((item, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-8 rounded-2xl border border-slate-800/60 flex flex-col items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <item.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Team / Closing */}
      <section className="py-20 text-center px-4">
        <div className="max-w-2xl mx-auto glass-card p-10 rounded-3xl border border-blue-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/5" />
          <h2 className="text-3xl font-bold text-white mb-4 relative z-10">Join the Future of Security</h2>
          <p className="text-slate-400 mb-8 relative z-10">
            Backed by leading researchers in computer vision and artificial intelligence, Madad Vision is constantly pushing the boundaries of what's possible in automated surveillance.
          </p>
        </div>
      </section>
    </div>
  );
}
