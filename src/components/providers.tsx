"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/primitives";

export function Providers({ children, dir }: { children: React.ReactNode; dir: "ltr" | "rtl" }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster position={dir === "rtl" ? "top-left" : "top-right"} richColors closeButton dir={dir} toastOptions={{ className: "font-sans" }} />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
