"use client";

import { motion } from "framer-motion";
import { BrandBackground, BrandSpinner } from "./brand";

interface WaitingScreenProps {
  title: string;
  subtitle?: string;
}

export function WaitingScreen({ title, subtitle }: WaitingScreenProps) {
  return (
    <BrandBackground>
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <div className="relative">
          <BrandSpinner size={72} />
          <motion.div
            className="absolute inset-0 rounded-full border border-emerald-400/30"
            animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-black text-white">{title}</h2>
          {subtitle && <p className="text-white/50 text-sm mt-2">{subtitle}</p>}
        </motion.div>
      </div>
    </BrandBackground>
  );
}
