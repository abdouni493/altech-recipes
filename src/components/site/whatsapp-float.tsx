"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { whatsappLink } from "@/lib/utils";
import { WhatsAppIcon } from "./social-icons";

export function WhatsAppFloat({ number }: { number: string }) {
  const t = useTranslations("site");
  if (!number) return null;
  return (
    <motion.a
      href={whatsappLink(number, t("whatsappHello"))}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappFloat")}
      title={t("whatsappFloat")}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      className="fixed bottom-5 end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40 motion-reduce:hidden" style={{ animationDuration: "2.5s" }} />
      <WhatsAppIcon className="relative h-7 w-7" />
    </motion.a>
  );
}
