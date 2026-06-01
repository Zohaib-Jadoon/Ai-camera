'use client';

import Link from 'next/link';
import { Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">Madad Vision AI</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Home</Link>
            <Link href="/about" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">About Us</Link>
            <Link href="/contact" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Contact</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)]">
              Get Started
            </Link>
          </div>

          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-300 hover:text-white p-2"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#020617] border-b border-slate-800/60 absolute top-16 left-0 right-0 py-4 px-4 flex flex-col gap-4 shadow-xl">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-slate-300 hover:text-white transition-colors py-2 border-b border-slate-800/60">Home</Link>
          <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-slate-300 hover:text-white transition-colors py-2 border-b border-slate-800/60">About Us</Link>
          <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-slate-300 hover:text-white transition-colors py-2 border-b border-slate-800/60">Contact</Link>
          
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-center text-slate-300 hover:text-white transition-colors py-2.5 rounded-lg border border-slate-700/60">
              Sign In
            </Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="text-sm font-semibold text-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg transition-all">
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
