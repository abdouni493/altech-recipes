"use client";
// Reusable Framer Motion helpers. MotionConfig(reducedMotion="user") in Providers honours prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform, type Variants } from "framer-motion";
import { useLocale } from "next-intl";
import { intlLocale } from "@/i18n/config";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className, stagger = 0.06 }: { children: React.ReactNode; className?: string; stagger?: number }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={fadeUp}>{children}</motion.div>;
}

export function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const locale = useLocale();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.1, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value]);
  return <span ref={ref}>{new Intl.NumberFormat(intlLocale(locale)).format(display)}</span>;
}

/* ---- Cinematic motion (inspired by wearefrantic.com): masked text, clip-path curtains, parallax, scroll progress. ---- */

const cinema = [0.76, 0, 0.24, 1] as const;

/** Splits text into words that slide up from behind a mask, staggered. */
export function TextReveal({ text, className, delay = 0, as: Tag = "span", inView = true }: {
  text: string; className?: string; delay?: number; as?: "span" | "h1" | "h2" | "p"; inView?: boolean;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const trigger = inView ? { whileInView: "show", viewport: { once: true, margin: "-40px" } } : { animate: "show" };
  const MotionTag = motion[Tag];
  return (
    <MotionTag className={className} initial="hidden" {...trigger} aria-label={text}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: delay } } }}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom -mb-[0.12em]">
          <motion.span className="inline-block will-change-transform"
            variants={{ hidden: reduce ? { opacity: 0 } : { y: "110%", rotate: 4 }, show: { y: "0%", rotate: 0, opacity: 1, transition: { duration: 0.9, ease: cinema } } }}>
            {w}{i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/** Image that is uncovered by a sliding curtain, then settles from a slight zoom. */
export function CurtainImage({ src, alt, className, imgClassName }: { src: string; alt: string; className?: string; imgClassName?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? { opacity: 0 } : { clipPath: "inset(100% 0% 0% 0%)" }}
      whileInView={reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0%)" }} viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.1, ease: cinema }}>
      <motion.img src={src} alt={alt} loading="lazy" className={imgClassName}
        initial={reduce ? false : { scale: 1.25 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: cinema }} />
    </motion.div>
  );
}

/** Moves its children against the scroll for depth. */
export function Parallax({ children, className, offset = 60 }: { children: React.ReactNode; className?: string; offset?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [offset, -offset]);
  return <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>;
}

/** Thin gold bar at the top of the viewport tracking page scroll. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return <motion.div aria-hidden style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-lemon rtl:origin-right" />;
}

/** Infinite horizontal ticker. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className={className} aria-hidden>
      <div className="marquee-track flex w-max">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((it, i) => (
              <span key={i} className="flex items-center gap-8 px-8 font-serif text-3xl italic md:text-5xl">
                {it}<span className="text-lemon">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
