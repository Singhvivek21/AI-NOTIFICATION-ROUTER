import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const colors = {
  background: "#000000",
  surface: "#121212",
  primary: "#ffffff",
  secondary: "#888888",
  accent: "#3b82f6",
  success: "#34d399",
  warning: "#fbbf24",
  error: "#f87171",
};

export const typography = {
  h1: "text-4xl md:text-5xl font-semibold tracking-tight text-white",
  h2: "text-3xl font-medium tracking-tight text-white",
  h3: "text-2xl font-medium tracking-tight text-white",
  h4: "text-xl font-medium tracking-tight text-white",
  body: "text-base font-normal text-[#A1A1AA] leading-relaxed",
  bodySmall: "text-sm font-normal text-[#A1A1AA] leading-relaxed",
  label: "text-xs font-medium uppercase tracking-wider text-[#71717A]",
};

export const buttonVariants = {
  base: "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  primary: "bg-white text-black hover:bg-neutral-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]",
  secondary: "bg-[#1E1E1E] text-white hover:bg-[#2A2A2A] border border-white/5",
  ghost: "text-[#A1A1AA] hover:text-white hover:bg-white/5",
  danger: "bg-error/10 text-error hover:bg-error/20 border border-error/20",
  glass: "bg-white/5 backdrop-blur-md border border-white/10 text-white hover:bg-white/10",
  sizes: {
    sm: "h-8 px-3 text-xs gap-1.5",
    md: "h-10 px-4 py-2 text-sm gap-2",
    lg: "h-12 px-8 text-base gap-2.5",
    icon: "h-10 w-10",
  }
};

export const cardVariants = {
  base: "rounded-2xl overflow-hidden transition-all duration-300",
  default: "bg-[#121212] border border-white/5",
  glass: "glass-panel",
  glassDark: "glass-panel-dark",
  interactive: "hover:border-white/10 hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer",
  glow: "border border-accent/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]",
};

export const animationConfig = {
  timing: {
    fast: "duration-150 ease-out",
    normal: "duration-300 ease-out",
    slow: "duration-500 ease-in-out",
    spring: "transition-[transform,opacity,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
  },
  framer: {
    spring: { type: "spring", stiffness: 400, damping: 30 },
    easeOut: { type: "tween", ease: "easeOut", duration: 0.3 },
    apple: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  }
};
