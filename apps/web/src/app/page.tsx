'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useSpring } from 'framer-motion';
import MarketingNav from '@/components/MarketingNav';
import BackgroundParticles from '@/components/BackgroundParticles';
import Scene3D from '@/components/Scene3D';
import { ArrowRight, Shield, Cpu, Zap, Activity } from 'lucide-react';

const fFadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const fStagger = {
  visible: { transition: { staggerChildren: 0.12 } }
};

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<number>(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end']
  });

  const smoothProgress = useSpring(scrollYProgress, {
    damping: 25,
    stiffness: 80,
    restDelta: 0.001
  });

  useEffect(() => {
    return smoothProgress.on('change', (latest) => {
      scrollProgressRef.current = latest;
    });
  }, [smoothProgress]);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#03050a] text-slate-100 selection:bg-[#7eb8f7]/20 selection:text-[#7eb8f7] overflow-x-hidden">
      {/* Visual background layers */}
      <BackgroundParticles />
      <Scene3D scrollProgress={scrollProgressRef} />
      <MarketingNav />

      {/* Hero section */}
      <section className="relative min-h-screen flex items-center pt-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fStagger}
          className="max-w-2xl flex flex-col gap-6"
        >
          <motion.div
            variants={fFadeUp}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7eb8f7]/5 border border-[#7eb8f7]/15 text-xs text-[#7eb8f7] font-semibold w-max uppercase tracking-wider font-mono-data"
          >
            <Shield className="w-3.5 h-3.5" /> next-generation surveillance
          </motion.div>
          
          <motion.h1
            variants={fFadeUp}
            className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] font-mono-data"
          >
            cybernetic vision <br />
            <span className="text-gradient">for enterprise security</span>
          </motion.h1>

          <motion.p
            variants={fFadeUp}
            className="text-base sm:text-lg text-slate-400 max-w-lg leading-relaxed"
          >
            Madad Vision transforms standard CCTV networks into real-time threat-detection hubs using edge computing, deep learning, and advanced tracking.
          </motion.p>

          <motion.div variants={fFadeUp} className="flex flex-wrap items-center gap-4 mt-2">
            <Link
              href="/login"
              className="group px-6 py-3 rounded-lg bg-[#7eb8f7] hover:bg-[#4a9fe0] text-[#03050a] font-semibold flex items-center gap-2 transition-all duration-300 shadow-[0_0_24px_rgba(126,184,247,0.25)] hover:shadow-[0_0_32px_rgba(126,184,247,0.4)]"
            >
              Access Console <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/about"
              className="px-6 py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold"
            >
              Platform Overview
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Section 1: Real-time Stats & Performance */}
      <section className="relative min-h-screen flex items-center z-10 px-6 sm:px-10 max-w-7xl mx-auto">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="hidden md:block" /> {/* WebGL placeholder space */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-400 font-semibold w-max uppercase tracking-wider font-mono-data"
            >
              <Activity className="w-3.5 h-3.5" /> optimized inference latency
            </motion.div>
            
            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight">
              millisecond precision <br />
              <span className="text-slate-400">at the edge</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-400 leading-relaxed">
              Our decoupled processing pipeline processes frame rates at a constant 15 FPS without blockages. Detections are evaluated concurrently on optimized YOLO weights, speeding up inference by 300% on standard CPUs.
            </motion.p>

            <motion.div variants={fFadeUp} className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm">
                <p className="text-2xl font-bold text-[#7eb8f7] font-mono-data">&lt; 45ms</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">inference delay</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] backdrop-blur-sm">
                <p className="text-2xl font-bold text-[#7eb8f7] font-mono-data">99.2%</p>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">accuracy rate</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Centroid Tracking */}
      <section className="relative min-h-screen flex items-center z-10 px-6 sm:px-10 max-w-7xl mx-auto">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7eb8f7]/5 border border-[#7eb8f7]/15 text-xs text-[#7eb8f7] font-semibold w-max uppercase tracking-wider font-mono-data"
            >
              <Cpu className="w-3.5 h-3.5" /> smart centroids
            </motion.div>
            
            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight">
              persistent tracking <br />
              <span className="text-slate-400">across cameras</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-400 leading-relaxed">
              With integrated CentroidTracker and appearance-based ReID matching, objects retain their unique ID even when crossing blind zones or encountering temporal occlusions.
            </motion.p>
          </motion.div>
          <div className="hidden md:block" />
        </div>
      </section>

      {/* Section 3: Virtual Perimeter Protection */}
      <section className="relative min-h-screen flex items-center z-10 px-6 sm:px-10 max-w-7xl mx-auto">
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="hidden md:block" />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/5 border border-red-500/15 text-xs text-red-400 font-semibold w-max uppercase tracking-wider font-mono-data"
            >
              <Zap className="w-3.5 h-3.5" /> laser boundaries
            </motion.div>
            
            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight">
              active intrusion <br />
              <span className="text-slate-400">boundaries</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-400 leading-relaxed">
              Draw virtual zones of any complexity on your camera feed. Detections are matched against crossing trajectories to prevent false-positives while guaranteeing 0ms reaction triggers on genuine breaches.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Section 4: Call to action */}
      <section className="relative min-h-screen flex items-center z-10 px-6 sm:px-10 max-w-7xl mx-auto justify-center text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-15%' }}
          variants={fStagger}
          className="max-w-xl flex flex-col gap-8 items-center"
        >
          <motion.h2 variants={fFadeUp} className="text-4xl sm:text-5xl font-bold font-mono-data">
            experience the future of <span className="text-gradient">smart security</span>
          </motion.h2>

          <motion.p variants={fFadeUp} className="text-slate-400 leading-relaxed">
            Deploy Madad Vision AI on your existing infrastructure and access real-time metrics, face tracking, and smart notifications inside our premium web control panel.
          </motion.p>

          <motion.div variants={fFadeUp}>
            <Link
              href="/register"
              className="group px-8 py-4 rounded-xl bg-white text-[#03050a] font-bold flex items-center gap-3 transition-all duration-300 hover:scale-105 hover:bg-slate-100"
            >
              Create Operator Account <ArrowRight className="w-4.5 h-4.5" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 border-t border-white/[0.04] bg-[#03050a]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-mono-data">
          <p>© {new Date().getFullYear()} madad vision ai. all rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-slate-300">About</Link>
            <Link href="/contact" className="hover:text-slate-300">Contact</Link>
            <Link href="/login" className="hover:text-slate-300">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
