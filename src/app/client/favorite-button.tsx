"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActionFeedback } from "@/components/shared/use-action-feedback";
import { toggleFavoriteAction } from "@/actions/portal";
import { cn } from "@/lib/utils";

export function FavoriteButton({ recipeId, initial, withLabel = false, className }: { recipeId: string; initial: boolean; withLabel?: boolean; className?: string }) {
  const t = useTranslations("portal");
  const router = useRouter();
  const feedback = useActionFeedback();
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !fav;
    setFav(next);
    start(async () => {
      const res = await toggleFavoriteAction(recipeId);
      if (!res.ok) {
        setFav(!next);
        return feedback.error(res);
      }
      toast.success(res.data!.favorite ? t("favoriteAdded") : t("favoriteRemoved"));
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size={withLabel ? "sm" : "icon"} onClick={toggle} disabled={pending} aria-pressed={fav}
      aria-label={fav ? t("removeFavorite") : t("addFavorite")} title={fav ? t("removeFavorite") : t("addFavorite")} className={className}>
      <motion.span key={String(fav)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="inline-flex">
        <Heart className={cn(fav && "fill-destructive text-destructive")} />
      </motion.span>
      {withLabel && t("favorite")}
    </Button>
  );
}
