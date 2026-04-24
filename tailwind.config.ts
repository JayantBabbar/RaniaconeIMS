import type { Config } from "tailwindcss";

// ═══════════════════════════════════════════════════════════════════
// RaniacOne Tailwind config
// Colors, shadows, radii, fonts all resolve through CSS variables
// defined in src/styles/theme.css. Swap that file (or inject
// per-tenant overrides) to re-theme the app without rebuilding.
// ═══════════════════════════════════════════════════════════════════

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "var(--color-brand)",
          light:   "var(--color-brand-light)",
          dark:    "var(--color-brand-dark)",
          50:      "var(--color-brand-50)",
          100:     "var(--color-brand-100)",
          500:     "var(--color-brand-500)",
          600:     "var(--color-brand-600)",
          700:     "var(--color-brand-700)",
        },

        // Surfaces
        surface: {
          DEFAULT:   "var(--color-surface)",
          secondary: "var(--color-surface-secondary)",
        },

        // Borders
        hairline: {
          DEFAULT: "var(--color-hairline)",
          light:   "var(--color-hairline-light)",
        },

        // Text
        foreground: {
          DEFAULT:   "var(--color-foreground)",
          secondary: "var(--color-foreground-secondary)",
          muted:     "var(--color-foreground-muted)",
          faint:     "var(--color-foreground-faint)",
        },

        // Status
        status: {
          green: {
            DEFAULT: "var(--color-status-green)",
            bg:      "var(--color-status-green-bg)",
            text:    "var(--color-status-green-text)",
          },
          red: {
            DEFAULT: "var(--color-status-red)",
            bg:      "var(--color-status-red-bg)",
            text:    "var(--color-status-red-text)",
          },
          amber: {
            DEFAULT: "var(--color-status-amber)",
            bg:      "var(--color-status-amber-bg)",
            text:    "var(--color-status-amber-text)",
          },
          blue: {
            DEFAULT: "var(--color-status-blue)",
            bg:      "var(--color-status-blue-bg)",
            text:    "var(--color-status-blue-text)",
          },
          gray: {
            DEFAULT: "var(--color-status-gray)",
            bg:      "var(--color-status-gray-bg)",
            text:    "var(--color-status-gray-text)",
          },
        },

        // Dark sidebar
        sidebar: {
          bg:           "var(--color-sidebar-bg)",
          "bg-hover":   "var(--color-sidebar-bg-hover)",
          text:         "var(--color-sidebar-text)",
          "text-muted": "var(--color-sidebar-text-muted)",
          border:       "var(--color-sidebar-border)",
        },
      },

      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "monospace",
        ],
      },

      fontSize: {
        "2xs": ["0.625rem",  { lineHeight: "0.875rem" }],
        xs:    ["0.6875rem", { lineHeight: "1rem" }],
        sm:    ["0.8125rem", { lineHeight: "1.25rem" }],
        base:  ["0.875rem",  { lineHeight: "1.375rem" }],
      },

      boxShadow: {
        card:          "var(--shadow-card)",
        raised:        "var(--shadow-raised)",
        overlay:       "var(--shadow-overlay)",
        "btn-primary": "var(--shadow-btn-primary)",
        "btn-success": "var(--shadow-btn-success)",
        "btn-dark":    "var(--shadow-btn-dark)",
      },

      borderRadius: {
        sm:      "var(--radius-sm)",
        DEFAULT: "var(--radius-base)",
        md:      "var(--radius-md)",
        lg:      "var(--radius-lg)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in":        "fade-in 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
        "scale-in":       "scale-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
