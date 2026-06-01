'use client';

import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, ArrowRight, Shield } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';
import { useState } from 'react';

export default function ContactPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setLoading(false);
    alert('Thank you for contacting us. Our sales team will be in touch shortly.');
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
      <MarketingNav />

      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} 
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Get in Touch
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Ready to upgrade your physical security? Contact our enterprise sales team to schedule a demo and technical consultation.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Contact Form */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="glass-card p-8 rounded-2xl border border-slate-800/80"
          >
            <h2 className="text-2xl font-semibold text-white mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">First Name</label>
                  <input type="text" required className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Last Name</label>
                  <input type="text" required className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Company Email</label>
                <input type="email" required className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">How can we help you?</label>
                <textarea rows={4} required className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/70 focus:bg-slate-900 transition-all" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-semibold py-3 rounded-lg text-sm transition-all mt-4"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Submit Request <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </motion.div>

          {/* Contact Info */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="space-y-8 lg:pl-8"
          >
            <div>
              <h3 className="text-xl font-semibold text-white mb-6">Contact Information</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Sales Inquiries</h4>
                    <p className="text-slate-500">sales@madadvision.ai</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Global Support</h4>
                    <p className="text-slate-500">+1 (800) 555-0199</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-300">Headquarters</h4>
                    <p className="text-slate-500">100 Innovation Drive<br/>San Francisco, CA 94103</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <h4 className="font-semibold text-white">Enterprise SLA</h4>
              </div>
              <p className="text-sm text-slate-400">Our enterprise clients receive 24/7 priority support with a guaranteed 1-hour response time for critical incidents.</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
