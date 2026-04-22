"use client";

import { motion } from "framer-motion";

interface WaitingScreenProps {
  title: string;
  subtitle?: string;
}

export function WaitingScreen({ title, subtitle }: WaitingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white px-6 text-center gap-6">
      {/* Spinner animado */}
      <motion.div
        className="relative size-20"
        animate={{ rotate: 360 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-0 rounded-full border-4 border-white/10" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-black">{title}</h2>
        {subtitle && <p className="text-white/50 text-sm mt-2">{subtitle}</p>}
      </motion.div>
    </div>
  );
}
