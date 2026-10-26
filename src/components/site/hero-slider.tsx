"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextReveal } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

export function HeroSlider({ images, title, subtitle }: { images: string[]; title: string; subtitle: string }) {
  const t = useTranslations("site");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = images.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count, paused, reduce]);

  return (
    <section className="relative -mt-16 overflow-hidden bg-foreground md:-mt-20" aria-roledescription="carousel">
      <motion.div className="relative h-[88vh] min-h-[560px] w-full bg-primary"
        initial={reduce ? false : { clipPath: "inset(6% 4% 6% 4%)" }} animate={{ clipPath: "inset(0% 0% 0% 0%)" }} transition={{ duration: 1.4, ease: [0.76, 0, 0.24, 1] }}>
        <AnimatePresence initial={false}>
          {count > 0 && (
            <motion.img key={images[index]} src={images[index]} alt="" aria-hidden
              initial={{ opacity: 0, scale: reduce ? 1 : 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 1.2 }, scale: { duration: 7, ease: "linear" } }}
              className="absolute inset-0 h-full w-full object-cover" />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(320_25%_8%/0.88)] via-[hsl(320_25%_8%/0.35)] to-[hsl(320_25%_8%/0.2)]" />
        <div className="container relative flex h-full flex-col justify-end pb-24 pt-40 text-white md:pb-28">
          <div className="max-w-4xl space-y-6">
            <motion.span initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="tag">{t("heroEyebrow")}</motion.span>
            <TextReveal as="h1" inView={false} delay={0.6} text={title} className="block font-serif text-4xl font-bold leading-[1.05] text-balance sm:text-5xl lg:text-7xl" />
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.1 }} className="max-w-2xl text-lg text-white/85 md:text-xl">{subtitle}</motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.3 }} className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" variant="lemon"><Link href="/recettes">{t("heroCta")}<ArrowRight className="flip-rtl" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white before:bg-white hover:text-primary">
                <Link href="/commander">{t("heroCtaSecondary")}</Link>
              </Button>
            </motion.div>
          </div>
        </div>
        {count > 1 && (
          <div className="absolute inset-x-0 bottom-6 z-10">
            <div className="container flex items-center justify-between">
              <div className="flex gap-2" role="tablist">
                {images.map((_, i) => (
                  <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={t("slide", { n: i + 1 })} onClick={() => go(i)}
                    className={cn("h-1.5 rounded-full bg-white/50 transition-all duration-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white", i === index ? "w-10 bg-white" : "w-4")} />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? t("play") : t("pause")} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30">
                  {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => go(index - 1)} aria-label={t("previous")} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30">
                  <ChevronLeft className="h-5 w-5 flip-rtl" />
                </button>
                <button type="button" onClick={() => go(index + 1)} aria-label={t("next")} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30">
                  <ChevronRight className="h-5 w-5 flip-rtl" />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
