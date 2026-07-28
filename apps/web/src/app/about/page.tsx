'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import MarketingNav from '@/components/MarketingNav';
import BackgroundParticles from '@/components/BackgroundParticles';
import { Shield, Eye, ShieldAlert, Cpu } from 'lucide-react';

const fFadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } }
};

const fStagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};


export default function About() {
  return (
    <div className="relative min-h-screen bg-[#03050a] text-slate-100 selection:bg-[#7eb8f7]/20 selection:text-[#7eb8f7] overflow-x-hidden">
      <BackgroundParticles />
      <MarketingNav />

      <section className="relative pt-32 pb-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto flex flex-col items-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fStagger}
          className="max-w-3xl flex flex-col gap-8 text-center"
        >
          <motion.div
            variants={fFadeUp}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7eb8f7]/5 border border-[#7eb8f7]/15 text-xs text-[#7eb8f7] font-semibold w-max uppercase tracking-wider font-mono-data mx-auto"
          >
            <Shield className="w-3.5 h-3.5" /> platform intelligence
          </motion.div>

          <motion.h1
            variants={fFadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight font-mono-data"
          >
            modular surveillance <br />
            <span className="text-gradient">engineered for accuracy</span>
          </motion.h1>

          <motion.p
            variants={fFadeUp}
            className="text-slate-400 text-base sm:text-lg leading-relaxed"
          >
            Madad Vision is built on a distributed Edge-to-Cloud architecture. Our python processing nodes run lightweight YOLO models directly at the camera subnet, ensuring zero network latency and perfect data privacy.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-10%' }}
          variants={fStagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-16"
        >
          <motion.div variants={fFadeUp} className="p-6 rounded-2xl glass glass-hover">
            <Cpu className="w-8 h-8 text-[#7eb8f7] mb-4" />
            <h3 className="text-lg font-bold mb-2 font-mono-data lowercase">edge computing</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Inference is run directly on localized devices. Original RTSP feeds never leave your secure firewall.
            </p>
          </motion.div>

          <motion.div variants={fFadeUp} className="p-6 rounded-2xl glass glass-hover">
            <Eye className="w-8 h-8 text-[#7eb8f7] mb-4" />
            <h3 className="text-lg font-bold mb-2 font-mono-data lowercase">centroid tracker</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              High-accuracy bounding box projection maintains tracking integrity during camera switches or temporary blocks.
            </p>
          </motion.div>

          <motion.div variants={fFadeUp} className="p-6 rounded-2xl glass glass-hover">
            <ShieldAlert className="w-8 h-8 text-[#7eb8f7] mb-4" />
            <h3 className="text-lg font-bold mb-2 font-mono-data lowercase">intrusion rules</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Define polygons of any shape and construct complex logic gates to eliminate common wind and animal triggers.
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mt-16 text-center"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#7eb8f7] hover:bg-[#4a9fe0] text-[#03050a] font-semibold transition-all shadow-[0_0_24px_rgba(126,184,247,0.25)]"
          >
            Launch Console
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
