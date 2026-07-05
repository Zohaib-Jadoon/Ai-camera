'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export default function BackgroundParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles only on the client to avoid hydration mismatch
    const generated: Particle[] = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage x-axis
      y: Math.random() * 100, // percentage y-axis
      size: Math.random() * 2.5 + 0.5, // size in pixels
      duration: Math.random() * 20 + 15, // movement duration
      delay: Math.random() * -20 // negative delay to spread animations immediately
    }));
    setParticles(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#03050a]">
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#14161f_1px,transparent_1px),linear-gradient(to_bottom,#14161f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.25]" />
      
      {/* Ambient glows */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] bg-slate-900/10 rounded-full blur-[140px]" />
      <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-neutral-900/15 rounded-full blur-[120px]" />

      {/* Floating particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-slate-400/30"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -150],
            x: [0, Math.random() * 40 - 20],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
