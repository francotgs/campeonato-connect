"use client";

/**
 * Brand primitives for the Campeonato MundIAl 4Match.
 *
 * Todos los componentes de esta app consumen estos primitivos para mantener
 * un look & feel cohesivo: mismo fondo, mismo header, mismos indicadores
 * de estado.
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type React from "react";

// ---------------------------------------------------------------------------
// BrandBackground — fondo compartido por todas las pantallas full-screen
// ---------------------------------------------------------------------------

type BrandBackgroundProps = {
  children: React.ReactNode;
  /** `subtle` usa menos adornos (para vistas in-match y bracket projector). */
  variant?: "default" | "subtle" | "celebrate";
  className?: string;
};

export function BrandBackground({
  children,
  variant = "default",
  className,
}: BrandBackgroundProps) {
  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-surface", className)}>
      {/* Campo / líneas sutiles (siempre visibles pero muy bajas) */}
      <FieldLines opacity={variant === "subtle" ? 0.025 : 0.05} />

      {/* Glow brand en el fondo */}
      {variant !== "subtle" && <BrandGlow />}

      {/* Celebración: overlay dorado animado */}
      {variant === "celebrate" && <CelebrateGlow />}

      {/* Contenido */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function FieldLines({ opacity }: { opacity: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity }} aria-hidden="true">
      {/* Líneas verticales */}
      {[25, 50, 75].map((pct) => (
        <div
          key={pct}
          className="absolute top-0 bottom-0 w-px bg-emerald-300"
          style={{ left: `${pct}%` }}
        />
      ))}
      {/* Círculo central */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300 aspect-square"
        style={{ width: "45vmin" }}
      />
    </div>
  );
}

function BrandGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 aspect-square rounded-full"
        style={{
          width: "80vmin",
          background: "radial-gradient(closest-side, rgba(16,185,129,0.18), transparent 70%)",
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 aspect-square rounded-full"
        style={{
          width: "60vmin",
          background: "radial-gradient(closest-side, rgba(34,197,94,0.12), transparent 70%)",
        }}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
      />
    </div>
  );
}

function CelebrateGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {[240, 340, 440, 540, 640, 740].map((size, i) => (
        <motion.div
          key={size}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300/20"
          style={{ width: size, height: size }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.05, 0.35] }}
          transition={{
            duration: 3 + i * 0.3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: i * 0.25,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BrandLogo — isotipo y wordmark reutilizables
// ---------------------------------------------------------------------------

type BrandLogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  orientation?: "horizontal" | "vertical";
  /** Color del logo: emerald (default) | gold (championship) */
  tone?: "primary" | "gold";
  className?: string;
};

const LOGO_SIZES = {
  sm: { icon: "size-8", title: "text-base" },
  md: { icon: "size-12", title: "text-xl" },
  lg: { icon: "size-16", title: "text-2xl" },
  xl: { icon: "size-20", title: "text-3xl" },
};

export function BrandLogo({
  size = "md",
  orientation = "horizontal",
  tone = "primary",
  className,
}: BrandLogoProps) {
  const sz = LOGO_SIZES[size];
  const toneClasses =
    tone === "gold" ? "bg-amber-400/15 text-amber-400" : "bg-emerald-400/15 text-emerald-400";

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        orientation === "vertical" && "flex-col text-center",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-2xl flex items-center justify-center ring-1 ring-white/5",
          sz.icon,
          toneClasses,
        )}
      >
        <Trophy className="size-1/2" strokeWidth={1.8} />
      </div>
      <div className={cn(orientation === "vertical" && "space-y-0.5")}>
        <h1 className={cn("font-black leading-none text-white", sz.title)}>Campeonato MundIAl</h1>
        <p
          className={cn(
            "text-xs uppercase tracking-[0.25em] font-bold",
            tone === "gold" ? "text-amber-400" : "text-emerald-400",
          )}
        >
          4Match
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BrandHeader — barra superior para páginas con contexto persistente
// ---------------------------------------------------------------------------

type BrandHeaderProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
};

export function BrandHeader({ left, right, title, subtitle, className }: BrandHeaderProps) {
  return (
    <header
      className={cn(
        "relative flex items-center justify-between gap-4 px-6 py-4",
        "border-b border-default bg-[rgba(11,16,32,0.6)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {left ?? <BrandLogo size="sm" />}
        {(title || subtitle) && (
          <div className="min-w-0">
            {title && <p className="text-sm font-bold text-white truncate">{title}</p>}
            {subtitle && (
              <p className="text-[11px] text-white/50 uppercase tracking-widest truncate">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>
      {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// StatusPill — indicador de estado con semántica (live, offline, paused…)
// ---------------------------------------------------------------------------

type StatusPillTone = "live" | "primary" | "gold" | "muted" | "danger" | "warning";

const STATUS_TONE: Record<
  StatusPillTone,
  { bg: string; text: string; border: string; dot?: string }
> = {
  live: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  primary: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
  },
  gold: {
    bg: "bg-amber-400/15",
    text: "text-amber-300",
    border: "border-amber-400/40",
  },
  muted: {
    bg: "bg-white/5",
    text: "text-white/60",
    border: "border-white/10",
  },
  danger: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    border: "border-red-500/40",
  },
  warning: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    border: "border-amber-500/40",
  },
};

export function StatusPill({
  tone,
  children,
  pulse,
  className,
}: {
  tone: StatusPillTone;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const c = STATUS_TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-[0.15em]",
        c.bg,
        c.text,
        c.border,
        className,
      )}
    >
      {pulse && c.dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              c.dot,
            )}
          />
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", c.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BrandSpinner — loader consistente en toda la app
// ---------------------------------------------------------------------------

export function BrandSpinner({
  size = 40,
  tone = "primary",
  className,
}: {
  size?: number;
  tone?: "primary" | "gold" | "white";
  className?: string;
}) {
  const color =
    tone === "gold"
      ? "border-t-amber-400"
      : tone === "white"
        ? "border-t-white"
        : "border-t-emerald-400";

  return (
    <motion.div
      className={cn("rounded-full border-2 border-white/10", color, className)}
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Panel — contenedor con estilo card brand
// ---------------------------------------------------------------------------

export function Panel({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "primary" | "gold" | false;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-default bg-[rgba(26,34,54,0.6)] backdrop-blur-sm shadow-xl",
        glow === "primary" && "glow-primary",
        glow === "gold" && "glow-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}
