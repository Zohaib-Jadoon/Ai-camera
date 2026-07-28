'use client';

import { motion } from 'framer-motion';
import MarketingNav from '@/components/MarketingNav';
import BackgroundParticles from '@/components/BackgroundParticles';
import { Send, MapPin, Phone, Mail } from 'lucide-react';

const fFadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } }
};


const fStagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

export default function Contact() {
  return (
    <div className="relative min-h-screen bg-[#03050a] text-slate-100 selection:bg-[#7eb8f7]/20 selection:text-[#7eb8f7] overflow-x-hidden">
      <BackgroundParticles />
      <MarketingNav />

      <section className="relative pt-32 pb-24 z-10 px-6 sm:px-10 max-w-7xl mx-auto flex flex-col items-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fStagger}
          className="max-w-3xl flex flex-col gap-6 text-center mb-16"
        >
          <motion.h1
            variants={fFadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight font-mono-data"
          >
            connect with our <span className="text-gradient">engineering team</span>
          </motion.h1>

          <motion.p
            variants={fFadeUp}
            className="text-slate-400 text-base max-w-xl mx-auto leading-relaxed"
          >
            Have technical questions about edge deployment, camera integration protocols, or customized AI model training? Let's talk.
          </motion.p>
        </motion.div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-start max-w-5xl">
          {/* Contact Details */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
            className="flex flex-col gap-8"
          >
            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-lg bg-[#7eb8f7]/5 border border-[#7eb8f7]/10 text-[#7eb8f7]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 font-mono-data lowercase">headquarters</h4>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Surveillance Technology Park, Suite 402<br />
                  Silicon Valley, CA 94025
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-lg bg-[#7eb8f7]/5 border border-[#7eb8f7]/10 text-[#7eb8f7]">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 font-mono-data lowercase">email support</h4>
                <p className="text-sm text-slate-400 mt-1 font-mono-data">
                  engineering@madadvision.ai
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="p-3 rounded-lg bg-[#7eb8f7]/5 border border-[#7eb8f7]/10 text-[#7eb8f7]">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-300 font-mono-data lowercase">direct phone</h4>
                <p className="text-sm text-slate-400 mt-1 font-mono-data">
                  +1 (555) 304-2024
                </p>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
            onSubmit={(e) => e.preventDefault()}
            className="p-8 rounded-2xl glass flex flex-col gap-5 w-full"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono-data">full name</label>
              <input
                type="text"
                placeholder="John Doe"
                className="w-full bg-[#03050a]/40 border border-white/[0.04] focus:border-[#7eb8f7]/30 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono-data">email address</label>
              <input
                type="email"
                placeholder="john@company.com"
                className="w-full bg-[#03050a]/40 border border-white/[0.04] focus:border-[#7eb8f7]/30 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors font-mono-data"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 font-mono-data">message</label>
              <textarea
                rows={4}
                placeholder="Describe your CCTV network scale..."
                className="w-full bg-[#03050a]/40 border border-white/[0.04] focus:border-[#7eb8f7]/30 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full py-3 rounded-lg bg-[#7eb8f7] hover:bg-[#4a9fe0] text-[#03050a] font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(126,184,247,0.15)]"
            >
              Send Message <Send className="w-4 h-4" />
            </button>
          </motion.form>
        </div>
      </section>
    </div>
  );
}
