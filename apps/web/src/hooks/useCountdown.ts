"use client";

import { useEffect, useState } from "react";

/**
 * Cuenta regresiva hasta `targetMs` (Unix timestamp en ms).
 * Retorna los segundos restantes (≥ 0) y una fracción de progreso [0,1]
 * respecto a `totalMs` (duración total en ms).
 */
export function useCountdown(
  targetMs: number | null,
  totalMs: number,
): { remaining: number; fraction: number } {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!targetMs) {
      setRemaining(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, targetMs - Date.now());
      setRemaining(Math.ceil(diff / 1000));
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [targetMs]);

  const fraction = totalMs > 0 ? Math.min(1, remaining / (totalMs / 1000)) : 0;

  return { remaining, fraction };
}
