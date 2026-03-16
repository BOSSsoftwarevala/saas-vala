import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        cyan: "hsl(var(--cyan))",
        purple: "hsl(var(--purple))",
        green: "hsl(var(--green))",
        gold: "hsl(var(--gold))",
        "neon-blue": "hsl(var(--royal-blue-light))",
        "neon-pink": "hsl(var(--secondary))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },
        "morph-gradient": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
          "50%": { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" },
        },
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-line": {
          "0%": { left: "0%", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { left: "100%", opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
        "count-up": "count-up 0.5s ease-out forwards",
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "morph-gradient": "morph-gradient 8s ease-in-out infinite",
        "slide-up-fade": "slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow-line": "glow-line 3s ease-in-out infinite",
        marquee: "marquee 20s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "navy-gradient": "linear-gradient(135deg, hsl(215, 65%, 18%) 0%, hsl(215, 65%, 12%) 100%)",
        "card-gradient": "linear-gradient(145deg, hsl(0, 0%, 100%) 0%, hsl(220, 20%, 98%) 100%)",
        "orange-gradient": "linear-gradient(135deg, hsl(215, 75%, 42%) 0%, hsl(215, 80%, 55%) 100%)",
        "cyan-gradient": "linear-gradient(135deg, hsl(195, 85%, 45%) 0%, hsl(195, 85%, 35%) 100%)",
        "purple-gradient": "linear-gradient(135deg, hsl(255, 60%, 55%) 0%, hsl(255, 60%, 42%) 100%)",
        "mesh-gradient": "radial-gradient(at 40% 20%, hsl(215, 75%, 42%, 0.04) 0px, transparent 50%), radial-gradient(at 80% 0%, hsl(195, 85%, 45%, 0.03) 0px, transparent 50%), radial-gradient(at 0% 50%, hsl(255, 60%, 55%, 0.03) 0px, transparent 50%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
