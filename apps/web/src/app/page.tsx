'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useSpring } from 'framer-motion';
import MarketingNav from '@/components/MarketingNav';
import BackgroundParticles from '@/components/BackgroundParticles';
import Scene3D from '@/components/Scene3D';
import AIVideoDemo from '@/components/AIVideoDemo';
import {
  ArrowRight, Shield, Cpu, Zap, Activity, Eye, Car,
  Siren, ShieldAlert, Sparkles, Fingerprint, Users, CheckCircle2
} from 'lucide-react';

const fFadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } }
};

const fStagger = {
  visible: { transition: { staggerChildren: 0.1 } }
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
    <div ref={containerRef} className="relative min-h-screen bg-[#050814] text-slate-100 selection:bg-sky-500/20 selection:text-sky-300 overflow-x-hidden">
      {/* Ambient background layers */}
      <BackgroundParticles />
      <Scene3D scrollProgress={scrollProgressRef} />
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-28 pb-20 z-10 px-6 sm:px-10 max-w-7xl mx-auto">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fStagger}
            className="lg:col-span-7 flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/20 text-xs text-sky-400 font-bold w-max uppercase tracking-wider font-mono-data shadow-lg shadow-sky-500/5"
            >
              <Shield className="w-4 h-4 text-sky-400" />
              <span>ENTERPRISE AI SURVEILLANCE PLATFORM</span>
              <Sparkles className="w-3.5 h-3.5 text-sky-300 animate-pulse" />
            </motion.div>

            <motion.h1
              variants={fFadeUp}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] font-mono-data text-white"
            >
              CYBERNETIC VISION <br />
              <span className="text-gradient">FOR CITY-WIDE SAFETY</span>
            </motion.h1>

            <motion.p
              variants={fFadeUp}
              className="text-sm sm:text-lg text-slate-300 max-w-xl leading-relaxed font-sans"
            >
              Madad Vision orchestrates enterprise CCTV networks into real-time threat-detection hubs using edge computing, deep learning, weapon recognition & instantaneous alert dispatch.
            </motion.p>

            <motion.div variants={fFadeUp} className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login"
                className="group px-7 py-3.5 rounded-xl bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2.5 transition-all duration-300 shadow-xl shadow-sky-500/20 hover:shadow-2xl hover:shadow-sky-500/35 hover:scale-105 font-mono-data"
              >
                <span>ACCESS COMMAND CONSOLE</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/about"
                className="px-7 py-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-sky-400/30 transition-all font-bold text-xs sm:text-sm text-slate-200 font-mono-data"
              >
                PLATFORM OVERVIEW
              </Link>
            </motion.div>

            {/* Quick Metrics Bar */}
            <motion.div variants={fFadeUp} className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.08] max-w-lg mt-2">
              <div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono-data">0.5ms</p>
                <p className="text-[10px] text-sky-400 uppercase font-mono-data tracking-wider font-semibold">REACTION TIME</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-data">99.8%</p>
                <p className="text-[10px] text-emerald-400 uppercase font-mono-data tracking-wider font-semibold">ACCURACY RATE</p>
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-black text-indigo-400 font-mono-data">30+ FPS</p>
                <p className="text-[10px] text-indigo-400 uppercase font-mono-data tracking-wider font-semibold">EDGE STREAMING</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Hero Feature Preview Frame */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="lg:col-span-5 relative rounded-2xl overflow-hidden glass-panel p-2 border border-sky-500/30 shadow-2xl group"
          >
            <Image
              src="/images/hero_surveillance_3d.png"
              alt="Madad Vision 3D AI Command Center HUD"
              width={700}
              height={450}
              className="rounded-xl object-cover w-full group-hover:scale-105 transition-transform duration-700"
              priority
            />
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-sky-400/40 text-xs font-bold text-sky-300 font-mono-data flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
              <span>COMMAND CORE ONLINE</span>
            </div>
          </motion.div>

        </div>
      </section>

      {/* Feature 1: AI Traffic & Congestion Monitoring */}
      <section className="relative py-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="relative rounded-2xl overflow-hidden glass-panel p-2 border border-sky-500/30 shadow-2xl group">
            <Image
              src="/images/traffic_congestion_3d.png"
              alt="AI Smart Traffic & Congestion Line Detection"
              width={700}
              height={440}
              className="rounded-xl object-cover w-full group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-sky-400/40 text-xs font-bold text-sky-300 font-mono-data flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 live-indicator" />
              <span>LIVE TRAFFIC THRESHOLD DETECTOR</span>
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 font-bold w-max uppercase tracking-wider font-mono-data"
            >
              <Car className="w-4 h-4" /> TRAFFIC & CONGESTION THRESHOLDS
            </motion.div>

            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight text-white">
              SMART BOUNDARY LINE <br />
              <span className="text-gradient">CONGESTION DETECTOR</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-300 leading-relaxed text-sm sm:text-base font-sans">
              Set custom polygon boundary lines across highways or city intersections. When vehicle queues stack behind the threshold line, receive instant high-priority alerts with automated vehicle volume counters.
            </motion.p>

            <motion.div variants={fFadeUp} className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-4 rounded-xl glass-card border border-white/[0.06]">
                <p className="text-lg font-bold text-amber-400 font-mono-data">AUTO QUEUE</p>
                <p className="text-xs text-slate-400 mt-1">Detects stopped traffic behind boundary line</p>
              </div>
              <div className="p-4 rounded-xl glass-card border border-white/[0.06]">
                <p className="text-lg font-bold text-sky-400 font-mono-data">SPEED TELEMETRY</p>
                <p className="text-xs text-slate-400 mt-1">Real-time km/h tracking per lane</p>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* Feature 2: Biometric Facial ReID & Identity Scanner */}
      <section className="relative py-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="flex flex-col gap-6 order-2 lg:order-1"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 font-bold w-max uppercase tracking-wider font-mono-data"
            >
              <Fingerprint className="w-4 h-4" /> BIOMETRIC & REID ENGINE
            </motion.div>

            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight text-white">
              PERSISTENT CROSS-CAM <br />
              <span className="text-gradient">IDENTITY MATCHING</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-300 leading-relaxed text-sm sm:text-base font-sans">
              Identify known vs unregistered individuals across multi-camera subnets. Deep 128-d facial feature embeddings enable zero-collision matching even under heavy shadows or low resolution.
            </motion.p>

            <motion.div variants={fFadeUp} className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-4 rounded-xl glass-card border border-white/[0.06]">
                <p className="text-lg font-bold text-indigo-400 font-mono-data">128-D MESH</p>
                <p className="text-xs text-slate-400 mt-1">Landmark Feature Extraction</p>
              </div>
              <div className="p-4 rounded-xl glass-card border border-white/[0.06]">
                <p className="text-lg font-bold text-emerald-400 font-mono-data">REID GRAPH</p>
                <p className="text-xs text-slate-400 mt-1">Multi-Camera Trajectory Sync</p>
              </div>
            </motion.div>
          </motion.div>

          <div className="relative rounded-2xl overflow-hidden glass-panel p-2 border border-indigo-500/30 shadow-2xl group order-1 lg:order-2">
            <Image
              src="/images/facial_reid_3d.png"
              alt="3D Biometric Facial Scanner & ReID HUD"
              width={700}
              height={440}
              className="rounded-xl object-cover w-full group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-indigo-400/40 text-xs font-bold text-indigo-300 font-mono-data flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>FACIAL LANDMARK MATCH ACTIVE</span>
            </div>
          </div>

        </div>
      </section>

      {/* Feature 3: Instant Weapon & Threat Alerts */}
      <section className="relative py-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="relative rounded-2xl overflow-hidden glass-panel p-2 border border-red-500/40 shadow-2xl group">
            <Image
              src="/images/threat_detection_3d.png"
              alt="Instant Weapon & Threat Detection Red Vignette HUD"
              width={700}
              height={440}
              className="rounded-xl object-cover w-full group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-red-950/90 border border-red-500 text-xs font-bold text-red-300 font-mono-data flex items-center gap-2 animate-pulse">
              <Siren className="w-4 h-4 text-red-400" />
              <span>INSTANT THREAT VIGNETTE FLASH [0.5MS]</span>
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-bold w-max uppercase tracking-wider font-mono-data"
            >
              <ShieldAlert className="w-4 h-4" /> ZERO-LATENCY THREAT RESPONSE
            </motion.div>

            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight text-white">
              0.5ms WEAPON & FIGHT <br />
              <span className="text-red-400">INSTANT ALERTS</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-300 leading-relaxed text-sm sm:text-base font-sans">
              Detect weapons, firearms, knives, physical altercations, accidents, and break-ins in real-time. Immediate red screen vignette flashes alert command center operators the moment a weapon is visible in frame.
            </motion.p>

            <motion.div variants={fFadeUp} className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-4 rounded-xl glass-card border border-red-500/30 bg-red-950/20">
                <p className="text-lg font-bold text-red-400 font-mono-data">RED VIGNETTE</p>
                <p className="text-xs text-slate-400 mt-1">Full-screen visual alert blink</p>
              </div>
              <div className="p-4 rounded-xl glass-card border border-red-500/30 bg-red-950/20">
                <p className="text-lg font-bold text-red-400 font-mono-data">SHADOW PICKUP</p>
                <p className="text-xs text-slate-400 mt-1">High sensitivity weapon recognition</p>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* Feature 4: Interactive AI Stream Demo */}
      <section className="relative py-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto border-t border-white/[0.06]">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20%' }}
            variants={fStagger}
            className="lg:col-span-5 flex flex-col gap-6"
          >
            <motion.div
              variants={fFadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-bold w-max uppercase tracking-wider font-mono-data"
            >
              <Activity className="w-4 h-4" /> LIVE NEURAL INFERENCE ENGINE
            </motion.div>

            <motion.h2 variants={fFadeUp} className="text-3xl sm:text-4xl font-bold font-mono-data leading-tight text-white">
              INTERACTIVE AI <br />
              <span className="text-emerald-400">STREAM TRACKER</span>
            </motion.h2>

            <motion.p variants={fFadeUp} className="text-slate-300 leading-relaxed text-sm sm:text-base font-sans">
              Experience the live edge pipeline in action. Multi-class object classification, real-time confidence scores, and sub-50ms bounding box tracking rendered directly on stream frames.
            </motion.p>

            <motion.div variants={fFadeUp} className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-mono-data">
                <CheckCircle2 className="w-4 h-4" /> SUB-50MS LATENCY
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 font-mono-data">
                <CheckCircle2 className="w-4 h-4" /> RTSP ACCELERATED
              </div>
            </motion.div>
          </motion.div>

          <div className="lg:col-span-7 w-full">
            <AIVideoDemo />
          </div>

        </div>
      </section>

      {/* Call To Action Console */}
      <section className="relative py-28 z-10 px-6 sm:px-10 max-w-7xl mx-auto justify-center text-center border-t border-white/[0.06]">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-15%' }}
          variants={fStagger}
          className="max-w-2xl flex flex-col gap-8 items-center mx-auto"
        >
          <motion.div
            variants={fFadeUp}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 font-bold uppercase tracking-wider font-mono-data"
          >
            <Activity className="w-4 h-4" /> ALL SYSTEMS OPERATIONAL
          </motion.div>

          <motion.h2 variants={fFadeUp} className="text-4xl sm:text-5xl font-extrabold font-mono-data text-white leading-tight">
            DEPLOY MADAD VISION <br />
            <span className="text-gradient">IN YOUR NETWORK</span>
          </motion.h2>

          <motion.p variants={fFadeUp} className="text-slate-300 leading-relaxed text-sm sm:text-base font-sans">
            Connect existing RTSP camera streams instantly and experience real-time neural surveillance, traffic boundary analysis, and automated threat dispatching.
          </motion.p>

          <motion.div variants={fFadeUp} className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="group px-8 py-4 rounded-xl bg-gradient-to-r from-sky-400 to-indigo-600 text-white font-bold text-xs sm:text-sm flex items-center gap-3 transition-all duration-300 hover:scale-105 shadow-xl shadow-sky-500/25 font-mono-data"
            >
              <span>CREATE OPERATOR ACCOUNT</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 border-t border-white/10 bg-[#050814]">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-mono-data">
          <p>© {new Date().getFullYear()} MADAD VISION AI. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-sky-400 transition-colors">ABOUT</Link>
            <Link href="/contact" className="hover:text-sky-400 transition-colors">CONTACT</Link>
            <Link href="/login" className="hover:text-sky-400 transition-colors">CONSOLE LOGIN</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}


