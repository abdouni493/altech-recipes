"use client";
// Cinematic route transition: a blue curtain wipes off the page on every navigation.
import { motion, useReducedMotion } from "framer-motion";

export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <>
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[70] origin-top bg-primary"
        initial={{ scaleY: 1 }} animate={{ scaleY: 0 }} transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }} />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </motion.div>
    </>
  );
}
