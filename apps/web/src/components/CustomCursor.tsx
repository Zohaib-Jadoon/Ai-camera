'use client';

import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Disable on touch devices
    if (window.matchMedia('(hover: none)').matches) return;

    const dot = dotRef.current;
    if (!dot) return;

    let mouseX = 0;
    let mouseY = 0;
    let dotX = 0;
    let dotY = 0;
    let started = false;
    const LERP = 0.15;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!started) {
        dotX = mouseX;
        dotY = mouseY;
        started = true;
        dot.classList.add('is-visible');
      }
    };

    const onMouseLeave = () => {
      dot.classList.remove('is-visible');
      started = false;
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const onCard = target.closest('.project-card, .featured-card, .glass-card, .interactive-card');
      const onLink = target.closest('a, button, input, select, textarea, [role="button"]');

      if (onCard) {
        dot.classList.add('is-expanded');
        dot.classList.remove('is-hidden');
      } else if (onLink) {
        dot.classList.add('is-hidden');
        dot.classList.remove('is-expanded');
      } else {
        dot.classList.remove('is-expanded', 'is-hidden');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseover', onMouseOver);

    let animationFrameId: number;
    const animate = () => {
      dotX += (mouseX - dotX) * LERP;
      dotY += (mouseY - dotY) * LERP;
      if (dot) {
        dot.style.left = `${dotX}px`;
        dot.style.top = `${dotY}px`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseover', onMouseOver);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      id="custom-cursor"
      style={{
        position: 'fixed',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 99999,
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        backgroundColor: '#7eb8f7',
        opacity: 0,
        boxShadow: '0 0 10px rgba(126,184,247,0.8)',
        transition: 'width 0.2s, height 0.2s, background-color 0.2s, opacity 0.2s',
      }}
    />
  );
}
