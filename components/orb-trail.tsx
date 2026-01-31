"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

export function OrbTrail() {
  const orbRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastParticleTime = useRef<number>(0);
  const particleIdCounter = useRef<number>(0);

  const updateParticles = useCallback(() => {
    const now = Date.now();
    const container = containerRef.current;
    if (!container) return;

    // Remove old particles
    particlesRef.current = particlesRef.current.filter((p) => {
      const age = now - p.createdAt;
      if (age > 800) {
        const el = container.querySelector(`[data-particle-id="${p.id}"]`);
        if (el) el.remove();
        return false;
      }
      return true;
    });

    rafRef.current = requestAnimationFrame(updateParticles);
  }, []);

  useEffect(() => {
    const orb = orbRef.current;
    const container = containerRef.current;
    if (!orb || !container) return;

    let mouseX = 0;
    let mouseY = 0;
    let orbX = 0;
    let orbY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Create particles with throttling
      const now = Date.now();
      if (now - lastParticleTime.current > 50) {
        lastParticleTime.current = now;
        const id = particleIdCounter.current++;

        const particle = document.createElement("div");
        particle.className = "orb-particle";
        particle.setAttribute("data-particle-id", String(id));
        particle.style.left = `${mouseX}px`;
        particle.style.top = `${mouseY}px`;
        container.appendChild(particle);

        particlesRef.current.push({ id, x: mouseX, y: mouseY, createdAt: now });
      }
    };

    const animateOrb = () => {
      // Smooth follow with easing
      const dx = mouseX - orbX;
      const dy = mouseY - orbY;
      orbX += dx * 0.15;
      orbY += dy * 0.15;

      orb.style.left = `${orbX}px`;
      orb.style.top = `${orbY}px`;

      requestAnimationFrame(animateOrb);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animateOrb();
    rafRef.current = requestAnimationFrame(updateParticles);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateParticles]);

  return (
    <>
      <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[9998]" />
      <div ref={orbRef} className="orb-trail" />
    </>
  );
}
