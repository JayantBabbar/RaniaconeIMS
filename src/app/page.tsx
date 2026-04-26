"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════
   RaniacOne marketing landing.
   Standalone aesthetic (saffron-amber palette, dark/light toggle) —
   styles are inlined in a <style> block so they don't leak to other
   routes when the user navigates away.
   ═══════════════════════════════════════════════════════════════════ */

const LANDING_CSS = `
/* All tokens live on the landing wrapper itself — keeps them out of
   the global :root scope so they don't collide with the IMS app's
   theme.css tokens (which use --color-* names anyway). */
[data-page="landing"] {
  --surface:        oklch(0.140 0.018 55);
  --surface-2:      oklch(0.175 0.020 55);
  --surface-3:      oklch(0.210 0.022 55);
  --surface-elev:   oklch(0.250 0.024 55);
  --surface-light:  oklch(0.965 0.012 75);
  --surface-deepest:oklch(0.090 0.014 55);

  --border:         oklch(0.250 0.020 55);
  --border-2:       oklch(0.205 0.018 55);
  --border-strong:  oklch(0.345 0.024 55);

  --ink:            oklch(0.972 0.012 75);
  --ink-2:          oklch(0.835 0.016 65);
  --ink-muted:      oklch(0.640 0.018 60);
  --ink-faint:      oklch(0.460 0.014 55);
  --ink-on-light:   oklch(0.180 0.020 50);

  --brand:          oklch(0.745 0.180 65);
  --brand-deep:     oklch(0.620 0.180 50);
  --brand-light:    oklch(0.860 0.140 75);
  --brand-tint:     oklch(0.300 0.080 55);
  --brand-tint-2:   oklch(0.380 0.110 55);

  --brand-glow-strong: oklch(0.745 0.180 65 / 0.40);
  --brand-glow:        oklch(0.745 0.180 65 / 0.20);
  --brand-glow-soft:   oklch(0.745 0.180 65 / 0.16);
  --brand-glow-faint:  oklch(0.745 0.180 65 / 0.10);
  --brand-pulse:       oklch(0.860 0.140 75 / 0.65);
  --brand-deep-glow:   oklch(0.620 0.180 50 / 0.55);
  --brand-deep-soft:   oklch(0.620 0.180 50 / 0.20);
  --brand-on:          oklch(0.140 0.018 55);

  --pos:            oklch(0.720 0.140 145);
  --pos-tint:       oklch(0.260 0.075 145);
  --neg:            oklch(0.715 0.180  25);
  --neg-tint:       oklch(0.270 0.090  25);
  --warn:           oklch(0.815 0.130  75);
  --warn-tint:      oklch(0.270 0.080  75);

  --ff-display: 'Switzer', system-ui, -apple-system, sans-serif;
  --ff-body:    'General Sans', system-ui, -apple-system, sans-serif;
  --ff-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --t-xs:   0.75rem;  --t-sm:   0.875rem;  --t-base: 1rem;
  --t-md:   1.125rem; --t-lg:   1.25rem;   --t-xl:   1.5rem;
  --t-2xl:  1.875rem;
  --t-3xl:  clamp(2rem, 2.5vw + 1rem, 2.625rem);
  --t-4xl:  clamp(2.5rem, 4vw + 1rem, 3.5rem);
  --t-5xl:  clamp(3rem, 6vw + 1rem, 5rem);
  --t-hero: clamp(3rem, 7vw + 1rem, 6.25rem);

  --s-1: 4px;  --s-2: 8px;   --s-3: 12px;  --s-4: 16px;
  --s-5: 24px; --s-6: 32px;  --s-7: 48px;  --s-8: 64px;
  --s-9: 96px; --s-10: 128px;

  --r-sm: 8px;  --r-md: 14px;  --r-lg: 20px;  --r-xl: 28px;  --r-2xl: 36px;

  --shadow-md: 0 8px 26px oklch(0 0 0 / 0.45), 0 2px 6px oklch(0 0 0 / 0.30);
  --shadow-lg: 0 30px 60px oklch(0 0 0 / 0.50), 0 8px 18px oklch(0 0 0 / 0.30);
  --shadow-xl: 0 50px 90px oklch(0 0 0 / 0.55), 0 12px 28px oklch(0 0 0 / 0.30),
               0 0 0 1px oklch(0.745 0.180 65 / 0.16);

  --glass-1: oklch(1 0 0 / 0.07);
  --glass-2: oklch(1 0 0 / 0.14);
  --glass-edge: oklch(1 0 0 / 0.16);

  --container: 1320px;
  --nav-h: 68px;
  --grid-cell: 64px;

  /* Force inheritance reset so Tailwind's text-foreground on body
     doesn't bleed into our content. */
  color: var(--ink-2);
}

[data-page="landing"][data-theme="light"] {
  --surface:        oklch(0.987 0.010 75);
  --surface-2:      oklch(0.965 0.012 70);
  --surface-3:      oklch(0.940 0.014 65);
  --surface-elev:   oklch(0.920 0.016 60);
  --surface-light:  oklch(0.180 0.020 50);
  --surface-deepest:oklch(0.940 0.014 65);

  --border:         oklch(0.900 0.018 65);
  --border-2:       oklch(0.935 0.014 70);
  --border-strong:  oklch(0.825 0.022 60);

  --ink:            oklch(0.180 0.020 50);
  --ink-2:          oklch(0.350 0.018 55);
  --ink-muted:      oklch(0.500 0.018 60);
  --ink-faint:      oklch(0.660 0.014 65);
  --ink-on-light:   oklch(0.965 0.012 75);

  --brand:          oklch(0.620 0.180 50);
  --brand-deep:     oklch(0.500 0.180 45);
  --brand-light:    oklch(0.760 0.150 60);
  --brand-tint:     oklch(0.960 0.040 65);
  --brand-tint-2:   oklch(0.910 0.075 60);

  --brand-glow-strong: oklch(0.620 0.180 50 / 0.30);
  --brand-glow:        oklch(0.620 0.180 50 / 0.18);
  --brand-glow-soft:   oklch(0.620 0.180 50 / 0.10);
  --brand-glow-faint:  oklch(0.620 0.180 50 / 0.06);
  --brand-pulse:       oklch(0.620 0.180 50 / 0.55);
  --brand-deep-glow:   oklch(0.500 0.180 45 / 0.40);
  --brand-deep-soft:   oklch(0.500 0.180 45 / 0.16);
  --brand-on:          oklch(0.987 0.010 75);

  --pos:            oklch(0.555 0.130 145);
  --pos-tint:       oklch(0.948 0.038 145);
  --neg:            oklch(0.575 0.180  25);
  --neg-tint:       oklch(0.948 0.045  25);
  --warn:           oklch(0.700 0.130  75);
  --warn-tint:      oklch(0.960 0.045  75);

  --shadow-md: 0 4px 14px oklch(0.18 0.020 50 / 0.08), 0 1px 3px oklch(0.18 0.020 50 / 0.04);
  --shadow-lg: 0 28px 60px oklch(0.18 0.020 50 / 0.12), 0 6px 14px oklch(0.18 0.020 50 / 0.06);
  --shadow-xl: 0 40px 80px oklch(0.18 0.020 50 / 0.14), 0 10px 24px oklch(0.18 0.020 50 / 0.06),
               0 0 0 1px oklch(0.620 0.180 50 / 0.18);

  --glass-1: oklch(0.18 0.020 50 / 0.05);
  --glass-2: oklch(0.18 0.020 50 / 0.10);
  --glass-edge: oklch(0.18 0.020 50 / 0.12);
}

/* Scope: only apply to the landing wrapper. Keeps dashboard styles clean. */
[data-page="landing"] *, [data-page="landing"] *::before, [data-page="landing"] *::after {
  margin: 0; padding: 0; box-sizing: border-box;
}
[data-page="landing"] {
  background: var(--surface);
  color: var(--ink-2);
  font-family: var(--ff-body);
  font-size: var(--t-base);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  min-height: 100vh;
  transition: background 320ms ease, color 320ms ease;
}
[data-page="landing"] img,
[data-page="landing"] svg,
[data-page="landing"] video { display: block; max-width: 100%; }
[data-page="landing"] button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
[data-page="landing"] a { color: inherit; text-decoration: none; }
[data-page="landing"] ::selection { background: var(--brand-tint-2); color: var(--ink); }

[data-page="landing"] .eyebrow {
  font-family: var(--ff-mono);
  font-size: var(--t-xs);
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--brand);
}

/* Buttons */
[data-page="landing"] .btn {
  display: inline-flex; align-items: center; gap: var(--s-2);
  height: 44px; padding: 0 var(--s-5);
  border-radius: var(--r-sm);
  font-family: var(--ff-body);
  font-size: var(--t-sm);
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  transition: transform 180ms cubic-bezier(.16,1,.3,1),
              background 180ms, color 180ms,
              box-shadow 220ms, border-color 180ms;
}
[data-page="landing"] .btn-primary {
  background: var(--brand);
  color: var(--brand-on);
  box-shadow: 0 1px 2px oklch(0 0 0 / 0.30), inset 0 1px 0 oklch(1 0 0 / 0.20);
}
[data-page="landing"] .btn-primary:hover {
  background: var(--brand-light);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px var(--brand-glow-strong);
}
[data-page="landing"] .btn-ghost {
  background: var(--glass-1);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--border-strong);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
[data-page="landing"] .btn-ghost:hover { background: var(--glass-2); }
[data-page="landing"] .btn-on-dark {
  background: var(--glass-1);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--glass-edge);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
[data-page="landing"] .btn-on-dark:hover { background: var(--glass-2); transform: translateY(-1px); }
[data-page="landing"] .btn-lg { height: 50px; padding: 0 var(--s-6); font-size: var(--t-base); }

[data-page="landing"] #scroll-progress {
  position: fixed; top: 0; left: 0; right: 0;
  height: 2px; z-index: 110;
  background: linear-gradient(90deg, var(--brand) var(--p, 0%), transparent var(--p, 0%));
  pointer-events: none;
}

/* NAV */
[data-page="landing"] nav.site {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: var(--nav-h);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 var(--s-7);
  transition: background 280ms, border-color 280ms, color 280ms;
  border-bottom: 1px solid transparent;
  color: var(--ink);
}
[data-page="landing"] nav.site.scrolled {
  background: color-mix(in oklch, var(--surface) 78%, transparent);
  border-bottom-color: var(--border);
  backdrop-filter: saturate(140%) blur(16px);
  -webkit-backdrop-filter: saturate(140%) blur(16px);
}
[data-page="landing"] .brand-mark {
  display: inline-flex; align-items: center; gap: var(--s-3);
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: -0.015em;
  color: var(--ink);
}
[data-page="landing"] .brand-mark .glyph { width: 32px; height: 32px; display: block; flex-shrink: 0; }
[data-page="landing"] .brand-mark .glyph svg { width: 100%; height: 100%; }
[data-page="landing"] .nav-right { display: flex; align-items: center; gap: var(--s-6); }
[data-page="landing"] .nav-links { display: flex; gap: var(--s-6); }
[data-page="landing"] .nav-links a {
  font-size: var(--t-sm);
  font-weight: 500;
  color: var(--ink-2);
  transition: color 180ms;
}
[data-page="landing"] .nav-links a:hover { color: var(--ink); }
[data-page="landing"] .nav-cta-group { display: flex; gap: var(--s-3); align-items: center; }

/* Theme toggle */
[data-page="landing"] .theme-toggle {
  width: 38px; height: 38px;
  border-radius: var(--r-sm);
  background: var(--glass-1);
  border: 1px solid var(--glass-edge);
  display: grid; place-items: center;
  color: var(--ink);
  transition: background 180ms, transform 180ms cubic-bezier(.16,1,.3,1);
  flex-shrink: 0;
}
[data-page="landing"] .theme-toggle:hover { background: var(--glass-2); transform: rotate(-12deg); }
[data-page="landing"] .theme-toggle:active { transform: rotate(-12deg) scale(0.94); }
[data-page="landing"] .theme-toggle svg { width: 18px; height: 18px; }
[data-page="landing"] .theme-toggle .icon-moon { display: none; }
[data-page="landing"] .theme-toggle .icon-sun  { display: block; }
[data-page="landing"][data-theme="light"] .theme-toggle .icon-sun  { display: none; }
[data-page="landing"][data-theme="light"] .theme-toggle .icon-moon { display: block; }

/* HERO */
[data-page="landing"] #hero {
  position: relative;
  min-height: 100vh;
  display: flex; align-items: center;
  padding: calc(var(--nav-h) + var(--s-8)) var(--s-7) var(--s-9);
  isolation: isolate;
  overflow: hidden;
  background: var(--surface);
  color: oklch(0.972 0.012 75);
}
[data-page="landing"] .hero-video-bg {
  position: absolute; inset: 0;
  z-index: 1;
  will-change: transform;
  overflow: hidden;
}
[data-page="landing"] .hero-video-bg video {
  width: 100%; height: 100%;
  object-fit: cover;
  transform: scale(1.08);
  transform-origin: center;
  filter: contrast(1.05) saturate(1.1) brightness(0.92);
}
[data-page="landing"] .hero-scrim {
  position: absolute; inset: 0; z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse 75% 95% at 22% 55%,
      oklch(0.06 0.014 50 / 0.85) 0%,
      oklch(0.06 0.014 50 / 0.55) 35%,
      oklch(0.06 0.014 50 / 0.10) 70%,
      transparent 92%),
    linear-gradient(180deg,
      oklch(0.115 0.018 50 / 0.40) 0%,
      transparent 25%,
      oklch(0.115 0.018 50 / 0.30) 70%,
      oklch(0.115 0.018 50 / 0.92) 100%),
    linear-gradient(135deg,
      oklch(0.18 0.020 50 / 0.18) 0%,
      transparent 60%);
}
[data-page="landing"] .hero-scrim::after {
  content: '';
  position: absolute; inset: 0;
  background-image: radial-gradient(circle at 2px 2px, oklch(1 0 0 / 0.02) 1px, transparent 0);
  background-size: 4px 4px;
  pointer-events: none;
  opacity: 0.6;
  mix-blend-mode: overlay;
}
[data-page="landing"] .hero-content {
  position: relative;
  z-index: 3;
  max-width: var(--container);
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: calc(100vh - var(--nav-h) - var(--s-9) - var(--s-8));
}
[data-page="landing"] .hero-copy { max-width: 920px; }
[data-page="landing"] .hero-eyebrow-row {
  display: inline-flex; align-items: center; gap: var(--s-3);
  margin-bottom: var(--s-6);
  padding: var(--s-2) var(--s-4) var(--s-2) var(--s-3);
  border-radius: 99px;
  background: oklch(1 0 0 / 0.07);
  border: 1px solid oklch(1 0 0 / 0.16);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
[data-page="landing"] .hero-eyebrow-row .pulse {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--brand-light);
  box-shadow: 0 0 0 0 var(--brand-pulse);
  animation: heroPulse 2.4s cubic-bezier(.4,0,.6,1) infinite;
}
@keyframes heroPulse {
  0%   { box-shadow: 0 0 0 0 var(--brand-pulse); }
  70%  { box-shadow: 0 0 0 12px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
[data-page="landing"] .hero-eyebrow-row .eyebrow {
  color: oklch(0.972 0.012 75);
  letter-spacing: 0.16em;
  font-size: 11px;
}
[data-page="landing"] #hero h1 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-hero);
  line-height: 0.98;
  letter-spacing: -0.04em;
  color: oklch(0.972 0.012 75);
  margin-bottom: var(--s-6);
  text-shadow: 0 2px 24px oklch(0 0 0 / 0.55), 0 1px 2px oklch(0 0 0 / 0.40);
}
[data-page="landing"] #hero h1 .india {
  color: var(--brand-light);
  font-style: italic;
  font-weight: 600;
}
[data-page="landing"] #hero p.lead {
  font-size: clamp(1.05rem, 1vw + 0.85rem, 1.25rem);
  line-height: 1.5;
  color: oklch(0.835 0.016 65);
  max-width: 64ch;
  margin-bottom: var(--s-7);
  text-shadow: 0 1px 12px oklch(0 0 0 / 0.45);
}
[data-page="landing"] .hero-cta { display: flex; gap: var(--s-3); flex-wrap: wrap; align-items: center; }
[data-page="landing"] .hero-trust-strip {
  margin-top: var(--s-8);
  padding-top: var(--s-5);
  border-top: 1px solid oklch(1 0 0 / 0.16);
  display: flex; flex-wrap: wrap; gap: var(--s-2);
  align-items: center;
}
[data-page="landing"] .hero-trust-strip .label {
  font-family: var(--ff-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: oklch(1 0 0 / 0.6);
  margin-right: var(--s-3);
}
[data-page="landing"] .hero-trust-strip .badge {
  font-family: var(--ff-mono);
  font-size: 11px;
  font-weight: 500;
  padding: var(--s-1) var(--s-3);
  border-radius: 6px;
  background: oklch(1 0 0 / 0.08);
  color: oklch(0.972 0.012 75);
  border: 1px solid oklch(1 0 0 / 0.16);
  letter-spacing: 0.02em;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
[data-page="landing"] .hero-trust-strip .badge.brand {
  background: var(--brand-glow);
  border-color: var(--brand-glow-strong);
  color: var(--brand-light);
}
[data-page="landing"] .scroll-cue {
  position: absolute;
  left: 50%; bottom: var(--s-5);
  transform: translateX(-50%);
  z-index: 4;
  display: flex; flex-direction: column; align-items: center; gap: var(--s-2);
  font-family: var(--ff-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: oklch(1 0 0 / 0.55);
  pointer-events: none;
}
[data-page="landing"] .scroll-cue .stem {
  width: 1px; height: 28px;
  background: linear-gradient(180deg, oklch(1 0 0 / 0.55) 0%, transparent 100%);
  animation: scrollCue 1.8s cubic-bezier(.4,0,.6,1) infinite;
}
@keyframes scrollCue {
  0%, 100% { opacity: 0.35; transform: scaleY(0.55); transform-origin: top; }
  50%      { opacity: 1;    transform: scaleY(1);    transform-origin: top; }
}

/* CAPABILITIES */
[data-page="landing"] #capabilities {
  position: relative;
  padding: var(--s-10) 0;
  background: var(--surface);
  isolation: isolate;
  overflow: hidden;
}
[data-page="landing"] #capabilities::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(to right,  var(--border-2) 1px, transparent 1px),
    linear-gradient(to bottom, var(--border-2) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
  background-position: 50% 0;
  mask-image: radial-gradient(ellipse 80% 100% at 50% 50%, oklch(0 0 0 / 1) 0%, oklch(0 0 0 / 0) 95%);
  -webkit-mask-image: radial-gradient(ellipse 80% 100% at 50% 50%, oklch(0 0 0 / 1) 0%, oklch(0 0 0 / 0) 95%);
  z-index: -1;
  pointer-events: none;
  opacity: 0.5;
}
[data-page="landing"] #capabilities::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(180deg, var(--surface) 0%, transparent 8%, transparent 92%, var(--surface) 100%);
  pointer-events: none;
  z-index: -1;
}
[data-page="landing"] .cap-header {
  max-width: var(--container);
  margin: 0 auto var(--s-9);
  padding: 0 var(--s-7);
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: var(--s-8);
  align-items: end;
}
[data-page="landing"] .cap-header h2 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-4xl);
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--ink);
}
[data-page="landing"] .cap-header h2 em { color: var(--brand-light); font-style: italic; font-weight: 600; }
[data-page="landing"] .cap-header p { font-size: var(--t-md); color: var(--ink-2); max-width: 44ch; }

[data-page="landing"] .cap-grid {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--s-7);
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: minmax(440px, auto);
  gap: var(--s-6);
}
[data-page="landing"] .cap-grid .tile-inventory { grid-column: span 6; grid-row: span 1; }
[data-page="landing"] .cap-grid .tile-po        { grid-column: span 3; grid-row: span 1; }
[data-page="landing"] .cap-grid .tile-so        { grid-column: span 3; grid-row: span 1; }
[data-page="landing"] .cap-grid .tile-invoice   { grid-column: span 4; grid-row: span 2; }
[data-page="landing"] .cap-grid .tile-challan   { grid-column: span 2; grid-row: span 1; }
[data-page="landing"] .cap-grid .tile-stock     { grid-column: span 2; grid-row: span 1; }
[data-page="landing"] .cap-grid .tile-tracking  { grid-column: span 6; grid-row: span 1; }

[data-page="landing"] .tile {
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  min-height: 0;
  position: relative;
}
[data-page="landing"] .tile-intro { flex-shrink: 0; padding: 0 var(--s-1); }
[data-page="landing"] .tile-intro .tag {
  font-family: var(--ff-mono);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--brand-light);
  display: inline-flex;
  align-items: center;
  gap: var(--s-3);
  margin-bottom: var(--s-3);
}
[data-page="landing"] .tile-intro .tag::before {
  content: '';
  width: 18px; height: 2px;
  background: currentColor;
  border-radius: 1px;
}
[data-page="landing"] .tile-intro h3 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: clamp(1.375rem, 1.3vw + 0.95rem, 1.875rem);
  line-height: 1.15;
  letter-spacing: -0.028em;
  color: var(--ink);
  margin: 0 0 var(--s-3);
  max-width: 26ch;
}
[data-page="landing"] .tile-intro p {
  font-size: var(--t-base);
  line-height: 1.55;
  color: var(--ink-2);
  max-width: 58ch;
}
[data-page="landing"] .tile .window { flex: 1; min-height: 280px; }

/* WINDOW (light-theme island for screenshots) */
[data-page="landing"] .window, [data-page="landing"] .ai-window {
  --surface:        oklch(0.992 0.004 75);
  --surface-2:      oklch(0.970 0.010 70);
  --surface-3:      oklch(0.945 0.014 65);
  --surface-deep:   oklch(0.180 0.020 50);
  --border:         oklch(0.905 0.018 65);
  --border-2:       oklch(0.940 0.014 70);
  --border-strong:  oklch(0.820 0.022 60);
  --ink:            oklch(0.205 0.020 50);
  --ink-2:          oklch(0.360 0.018 55);
  --ink-muted:      oklch(0.520 0.018 60);
  --ink-faint:      oklch(0.680 0.014 65);
  --brand:          oklch(0.620 0.180 50);
  --brand-deep:     oklch(0.480 0.180 45);
  --brand-tint:     oklch(0.960 0.040 65);
  --brand-tint-2:   oklch(0.880 0.075 60);
  --brand-deep-soft:   oklch(0.620 0.180 50 / 0.20);
  --brand-deep-glow:   oklch(0.620 0.180 50 / 0.55);
  --brand-pulse:       oklch(0.620 0.180 50 / 0.55);
  --pos:            oklch(0.555 0.130 145);
  --pos-tint:       oklch(0.948 0.038 145);
  --neg:            oklch(0.575 0.180  25);
  --neg-tint:       oklch(0.948 0.045  25);
  --warn:           oklch(0.700 0.130  75);
  --warn-tint:      oklch(0.960 0.045  75);
}
[data-page="landing"] .window {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  transition: transform 360ms cubic-bezier(.16,1,.3,1), box-shadow 360ms cubic-bezier(.16,1,.3,1);
  display: flex; flex-direction: column;
  will-change: transform;
  color: var(--ink);
}
[data-page="landing"] .window:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
[data-page="landing"] .window-chrome {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
[data-page="landing"] .window-chrome .dots { display: flex; gap: 6px; }
[data-page="landing"] .window-chrome .dots i {
  width: 10px; height: 10px;
  border-radius: 50%;
  display: block;
  background: var(--border-strong);
}
[data-page="landing"] .window-chrome .dots i:nth-child(1) { background: oklch(0.78 0.15 25); }
[data-page="landing"] .window-chrome .dots i:nth-child(2) { background: oklch(0.84 0.13 75); }
[data-page="landing"] .window-chrome .dots i:nth-child(3) { background: oklch(0.78 0.13 155); }
[data-page="landing"] .window-chrome .url {
  flex: 1;
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--ink-faint);
  background: var(--surface-3);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  padding: 4px 10px;
  letter-spacing: 0.02em;
  text-align: center;
  max-width: 420px;
  margin: 0 auto;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
[data-page="landing"] .window-chrome .url .lock { color: var(--ink-faint); margin-right: 4px; }
[data-page="landing"] .window-chrome .placeholder { width: 56px; }
[data-page="landing"] .window-body { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; }

[data-page="landing"] .ui {
  font-family: var(--ff-body);
  font-size: 11px;
  color: var(--ink-2);
  padding: var(--s-4);
  display: flex; flex-direction: column;
  gap: var(--s-3);
  flex: 1;
  overflow: hidden;
}
[data-page="landing"] .ui .doc-head { display: flex; align-items: center; justify-content: space-between; }
[data-page="landing"] .ui .doc-num {
  font-family: var(--ff-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.02em;
}
[data-page="landing"] .ui .pill {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border-radius: 99px;
  font-family: var(--ff-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
[data-page="landing"] .ui .pill.ok    { background: var(--pos-tint); color: oklch(0.32 0.090 145); }
[data-page="landing"] .ui .pill.brand { background: var(--brand-tint); color: var(--brand-deep); }
[data-page="landing"] .ui .pill.warn  { background: var(--warn-tint); color: oklch(0.40 0.13 75); }
[data-page="landing"] .ui .pill.muted { background: var(--surface-2); color: var(--ink-muted); border: 1px solid var(--border); }
[data-page="landing"] .ui .pill .dot  { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
[data-page="landing"] .ui .label {
  font-family: var(--ff-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 2px;
}
[data-page="landing"] .ui table { width: 100%; border-collapse: collapse; font-size: 11px; }
[data-page="landing"] .ui table th {
  text-align: left;
  font-family: var(--ff-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
[data-page="landing"] .ui table td { padding: 8px; color: var(--ink); border-bottom: 1px solid var(--border-2); }
[data-page="landing"] .ui table td.num { text-align: right; font-family: var(--ff-mono); }
[data-page="landing"] .ui .totals {
  margin-top: auto;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  font-family: var(--ff-mono);
  font-size: 11px;
  padding-top: var(--s-2);
  border-top: 1px solid var(--border);
}
[data-page="landing"] .ui .totals .k { color: var(--ink-faint); text-align: right; }
[data-page="landing"] .ui .totals .v { color: var(--ink); text-align: right; }
[data-page="landing"] .ui .totals .grand-k { color: var(--ink); font-weight: 600; padding-top: 4px; border-top: 1px solid var(--border); }
[data-page="landing"] .ui .totals .grand-v { color: var(--ink); font-weight: 700; padding-top: 4px; border-top: 1px solid var(--border); font-size: 12px; }
[data-page="landing"] .ui .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }
[data-page="landing"] .ui .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--s-3); }
[data-page="landing"] .ui .col .h {
  font-family: var(--ff-display);
  font-weight: 600;
  font-size: 12px;
  color: var(--ink);
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}
[data-page="landing"] .ui .col .l { font-size: 10.5px; color: var(--ink-2); line-height: 1.5; }
[data-page="landing"] .ui .col .gstin { font-family: var(--ff-mono); font-size: 10px; color: var(--brand-deep); margin-top: 2px; letter-spacing: 0.02em; }

/* INVENTORY */
[data-page="landing"] .ui-inventory { padding: 0; gap: 0; }
[data-page="landing"] .inv-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--s-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}
[data-page="landing"] .inv-header .left { display: flex; align-items: center; gap: var(--s-4); }
[data-page="landing"] .inv-header .left .h {
  font-family: var(--ff-display);
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
  letter-spacing: -0.018em;
}
[data-page="landing"] .inv-search {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 7px;
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--ink-faint);
  min-width: 200px;
}
[data-page="landing"] .inv-search svg { color: var(--ink-faint); }
[data-page="landing"] .inv-filters { display: flex; gap: 6px; }
[data-page="landing"] .inv-filters .chip {
  font-family: var(--ff-mono);
  font-size: 10px;
  padding: 4px 9px;
  border-radius: 99px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--ink-2);
  letter-spacing: 0.04em;
}
[data-page="landing"] .inv-filters .chip.active {
  background: var(--ink);
  color: var(--surface);
  border-color: var(--ink);
}
[data-page="landing"] .inv-table { flex: 1; overflow: auto; }
[data-page="landing"] .inv-table table { font-size: 11.5px; }
[data-page="landing"] .inv-table th, [data-page="landing"] .inv-table td { padding: 8px 12px; }
[data-page="landing"] .inv-table th { background: var(--surface-2); border-bottom: 1px solid var(--border); }
[data-page="landing"] .inv-table td .sku-glyph { display: inline-flex; align-items: center; gap: 8px; }
[data-page="landing"] .inv-table td .sku-glyph .icon {
  width: 26px; height: 26px;
  border-radius: 6px;
  background: var(--brand-tint);
  display: grid; place-items: center;
  flex-shrink: 0;
  color: var(--brand-deep);
}
[data-page="landing"] .inv-table td .sku-glyph .icon svg { width: 14px; height: 14px; }
[data-page="landing"] .inv-table td .sku-glyph .info b { display: block; font-size: 12px; color: var(--ink); font-weight: 500; }
[data-page="landing"] .inv-table td .sku-glyph .info small { font-family: var(--ff-mono); font-size: 10px; color: var(--ink-faint); }
[data-page="landing"] .inv-table tr:hover td { background: var(--brand-tint); transition: background 180ms; }
[data-page="landing"] .inv-row-status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 99px;
  font-family: var(--ff-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
}
[data-page="landing"] .inv-row-status.ok    { background: var(--pos-tint); color: oklch(0.32 0.090 145); }
[data-page="landing"] .inv-row-status.low   { background: var(--warn-tint); color: oklch(0.40 0.13 75); }
[data-page="landing"] .inv-row-status.out   { background: var(--neg-tint); color: oklch(0.40 0.16 25); }
[data-page="landing"] .inv-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  display: flex; align-items: center; justify-content: space-between;
  font-family: var(--ff-mono);
  font-size: 10.5px;
  color: var(--ink-faint);
}

/* PO */
[data-page="landing"] .ui-po .doc-num::before { content: 'PO · '; color: var(--ink-faint); }
[data-page="landing"] .ui-po .vendor {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-3);
  background: var(--surface-2);
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
}
[data-page="landing"] .ui-po .vendor .avatar {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand), var(--brand-deep));
  color: oklch(0.99 0 0);
  display: grid; place-items: center;
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: 11px;
  flex-shrink: 0;
}
[data-page="landing"] .ui-po .vendor .vinfo .name { font-weight: 600; color: var(--ink); font-size: 12px; }
[data-page="landing"] .ui-po .vendor .vinfo .gstin { font-family: var(--ff-mono); font-size: 10px; color: var(--ink-faint); }

/* SO */
[data-page="landing"] .ui-so .reservation {
  margin-top: auto;
  padding: var(--s-3);
  background: var(--brand-tint);
  border: 1px solid var(--brand-deep-soft);
  border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: space-between;
}
[data-page="landing"] .ui-so .reservation .l {
  font-family: var(--ff-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brand-deep);
}
[data-page="landing"] .ui-so .reservation .v {
  font-family: var(--ff-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-deep);
}

/* Invoice */
[data-page="landing"] .ui-invoice { background: linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%); }
[data-page="landing"] .ui-invoice .inv-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding-bottom: var(--s-3);
  border-bottom: 1.5px solid var(--ink);
}
[data-page="landing"] .ui-invoice .inv-head .left .title {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: 14px;
  color: var(--ink);
  letter-spacing: -0.02em;
}
[data-page="landing"] .ui-invoice .inv-head .left .sub {
  font-family: var(--ff-mono);
  font-size: 10px;
  color: var(--brand-deep);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-top: 2px;
}
[data-page="landing"] .ui-invoice .inv-head .right { text-align: right; }
[data-page="landing"] .ui-invoice .inv-head .right .who {
  font-family: var(--ff-display);
  font-weight: 600;
  font-size: 12px;
  color: var(--ink);
}
[data-page="landing"] .ui-invoice .inv-head .right .meta { font-family: var(--ff-mono); font-size: 10px; color: var(--ink-faint); }
[data-page="landing"] .ui-invoice .parties { padding: var(--s-3) 0; }
[data-page="landing"] .ui-invoice .parties .label { color: var(--ink-faint); }
[data-page="landing"] .ui-invoice table { font-size: 10.5px; }
[data-page="landing"] .ui-invoice table thead { background: var(--ink); color: oklch(0.99 0 0); }
[data-page="landing"] .ui-invoice table thead th { color: oklch(0.96 0 0); border-color: transparent; }
[data-page="landing"] .ui-invoice .qr-strip {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-3);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  margin-top: var(--s-3);
}
[data-page="landing"] .ui-invoice .qr {
  width: 56px; height: 56px;
  background:
    linear-gradient(45deg, var(--ink) 25%, transparent 25%) 0 0/8px 8px,
    linear-gradient(-45deg, var(--ink) 25%, transparent 25%) 0 0/8px 8px,
    linear-gradient(45deg, transparent 75%, var(--ink) 75%) 0 0/8px 8px,
    linear-gradient(-45deg, transparent 75%, var(--ink) 75%) 0 0/8px 8px,
    var(--surface);
  border: 4px solid var(--surface);
  box-shadow: 0 0 0 1px var(--ink);
  border-radius: 4px;
  flex-shrink: 0;
}
[data-page="landing"] .ui-invoice .qr-strip .info { flex: 1; }
[data-page="landing"] .ui-invoice .qr-strip .info .label { font-size: 9px; }
[data-page="landing"] .ui-invoice .qr-strip .info .irn {
  font-family: var(--ff-mono);
  font-size: 10px;
  color: var(--ink);
  word-break: break-all;
  line-height: 1.4;
}
[data-page="landing"] .ui-invoice .totals { font-size: 10.5px; }
[data-page="landing"] .ui-invoice .words {
  font-family: var(--ff-body);
  font-size: 10.5px;
  color: var(--ink-2);
  font-style: italic;
  margin-top: var(--s-2);
}

/* Challan */
[data-page="landing"] .ui-challan .vehicle-row {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-3);
  background: var(--surface-deep);
  color: oklch(0.96 0 0);
  border-radius: var(--r-sm);
}
[data-page="landing"] .ui-challan .vehicle-plate {
  font-family: var(--ff-mono);
  font-weight: 700;
  font-size: 12px;
  background: oklch(0.84 0.16 95);
  color: oklch(0.18 0.020 50);
  padding: 5px 10px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  border: 1.5px solid oklch(0.18 0.020 50);
}
[data-page="landing"] .ui-challan .vehicle-row .driver { font-size: 11px; line-height: 1.3; }
[data-page="landing"] .ui-challan .vehicle-row .driver .nm { color: oklch(0.96 0 0); font-weight: 600; }
[data-page="landing"] .ui-challan .vehicle-row .driver .ph { font-family: var(--ff-mono); font-size: 10px; color: oklch(0.85 0 0); }
[data-page="landing"] .ui-challan .route {
  display: flex; align-items: center; gap: var(--s-2);
  font-family: var(--ff-mono);
  font-size: 10.5px;
  color: var(--ink-2);
}
[data-page="landing"] .ui-challan .route .arrow { color: var(--ink-faint); }

/* Tracking */
[data-page="landing"] .ui-tracking { padding: var(--s-5); display: flex; flex-direction: column; gap: var(--s-4); flex: 1; }
[data-page="landing"] .ui-tracking .head { display: flex; align-items: center; justify-content: space-between; }
[data-page="landing"] .ui-tracking .head .right { display: flex; gap: var(--s-3); align-items: center; }
[data-page="landing"] .ui-tracking .vehicle-plate {
  font-family: var(--ff-mono);
  font-weight: 700;
  font-size: 12px;
  background: oklch(0.84 0.16 95);
  color: oklch(0.18 0.020 50);
  padding: 4px 10px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  border: 1.5px solid oklch(0.18 0.020 50);
}
[data-page="landing"] .timeline {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
  padding: var(--s-5) 0 var(--s-3);
}
[data-page="landing"] .timeline::before {
  content: '';
  position: absolute;
  left: 4%; right: 4%;
  top: calc(var(--s-5) + 9px);
  height: 2px;
  background: var(--border);
  border-radius: 2px;
}
[data-page="landing"] .timeline::after {
  content: '';
  position: absolute;
  left: 4%;
  width: 64%;
  top: calc(var(--s-5) + 9px);
  height: 2px;
  background: var(--brand);
  border-radius: 2px;
  box-shadow: 0 0 12px var(--brand);
}
[data-page="landing"] .tl-step { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 var(--s-2); }
[data-page="landing"] .tl-step .node {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--border);
  position: relative;
  z-index: 1;
  margin-bottom: var(--s-3);
}
[data-page="landing"] .tl-step.done .node { background: var(--brand); border-color: var(--brand); }
[data-page="landing"] .tl-step.done .node::after {
  content: '';
  position: absolute;
  left: 5px; top: 7px;
  width: 4px; height: 7px;
  border: 1.5px solid oklch(0.99 0 0);
  border-top: 0; border-left: 0;
  transform: rotate(45deg);
}
[data-page="landing"] .tl-step.live .node {
  background: var(--brand);
  border-color: var(--brand);
  box-shadow: 0 0 0 5px var(--brand-tint), 0 0 18px var(--brand-deep-glow);
  animation: livePulse 2s cubic-bezier(.4,0,.6,1) infinite;
}
@keyframes livePulse {
  0%,100% { box-shadow: 0 0 0 5px var(--brand-tint), 0 0 14px var(--brand-pulse); }
  50%     { box-shadow: 0 0 0 8px var(--brand-deep-soft), 0 0 22px var(--brand-deep-glow); }
}
[data-page="landing"] .tl-step .time { font-family: var(--ff-mono); font-size: 11px; font-weight: 600; color: var(--ink); }
[data-page="landing"] .tl-step .place { font-size: 11px; color: var(--ink-2); margin-top: 2px; max-width: 18ch; line-height: 1.3; }
[data-page="landing"] .tl-step .place .sub {
  display: block;
  font-family: var(--ff-mono);
  font-size: 9.5px;
  color: var(--ink-faint);
  letter-spacing: 0.06em;
  margin-top: 1px;
  text-transform: uppercase;
}
[data-page="landing"] .tl-step.live .place .sub { color: var(--brand-deep); }
[data-page="landing"] .tl-step.scheduled .node { border-style: dashed; border-color: var(--border-strong); }
[data-page="landing"] .tl-step.scheduled .time, [data-page="landing"] .tl-step.scheduled .place { color: var(--ink-faint); }

/* Stock */
[data-page="landing"] .ui-stock { padding: var(--s-4); display: flex; flex-direction: column; gap: var(--s-3); }
[data-page="landing"] .ui-stock .stock-row {
  display: grid;
  grid-template-columns: 1fr 50px 50px 50px;
  gap: var(--s-2);
  align-items: center;
  padding: 6px 8px;
  font-family: var(--ff-mono);
  font-size: 11px;
  border-bottom: 1px solid var(--border-2);
}
[data-page="landing"] .ui-stock .stock-row:last-of-type { border-bottom: 0; }
[data-page="landing"] .ui-stock .stock-row.head {
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  border-bottom: 1px solid var(--border);
}
[data-page="landing"] .ui-stock .stock-row .sku { color: var(--ink); font-weight: 500; }
[data-page="landing"] .ui-stock .stock-row .num { text-align: right; color: var(--ink-2); }
[data-page="landing"] .ui-stock .stock-row .num.brand { color: var(--brand-deep); font-weight: 600; }

/* AI */
[data-page="landing"] #ai {
  position: relative;
  padding: var(--s-10) 0 var(--s-9);
  background: var(--surface);
  isolation: isolate;
  overflow: hidden;
}
[data-page="landing"] #ai::before {
  content: '';
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse 60% 80% at 80% 20%, var(--brand-glow) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 10% 90%, var(--brand-glow-faint) 0%, transparent 60%);
  z-index: -1;
  pointer-events: none;
}
[data-page="landing"] #ai::after {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(to right,  var(--border-2) 1px, transparent 1px),
    linear-gradient(to bottom, var(--border-2) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
  background-position: 50% 0;
  mask-image: radial-gradient(ellipse 70% 90% at 50% 50%, oklch(0 0 0 / 1) 0%, oklch(0 0 0 / 0) 90%);
  -webkit-mask-image: radial-gradient(ellipse 70% 90% at 50% 50%, oklch(0 0 0 / 1) 0%, oklch(0 0 0 / 0) 90%);
  z-index: -1;
  pointer-events: none;
  opacity: 0.5;
}
[data-page="landing"] .ai-inner { max-width: var(--container); margin: 0 auto; padding: 0 var(--s-7); }
[data-page="landing"] .ai-header {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: var(--s-8);
  align-items: end;
  margin-bottom: var(--s-9);
}
[data-page="landing"] .ai-header .left .ai-tag {
  display: inline-flex; align-items: center; gap: var(--s-2);
  padding: var(--s-1) var(--s-3);
  background: var(--brand-glow);
  border: 1px solid var(--brand-glow-strong);
  color: var(--brand-light);
  border-radius: 99px;
  font-family: var(--ff-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: var(--s-4);
}
[data-page="landing"] .ai-header .left .ai-tag .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--brand-light);
  box-shadow: 0 0 8px var(--brand-light);
}
[data-page="landing"] .ai-header h2 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-4xl);
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--ink);
}
[data-page="landing"] .ai-header h2 em { color: var(--brand-light); font-style: italic; font-weight: 600; }
[data-page="landing"] .ai-header .right p { font-size: var(--t-md); color: var(--ink-2); max-width: 48ch; margin-bottom: var(--s-4); }
[data-page="landing"] .ai-header .right ul {
  list-style: none;
  display: grid;
  gap: var(--s-2);
  font-family: var(--ff-mono);
  font-size: var(--t-sm);
  color: var(--ink-2);
}
[data-page="landing"] .ai-header .right ul li { display: flex; align-items: baseline; gap: var(--s-3); }
[data-page="landing"] .ai-header .right ul li::before {
  content: '';
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 2px;
  background: var(--brand);
  flex-shrink: 0;
  transform: translateY(-1px);
}

[data-page="landing"] .ai-window {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  color: var(--ink);
  display: flex; flex-direction: column;
}
[data-page="landing"] .ai-chrome {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  border-bottom: 1px solid var(--border);
}
[data-page="landing"] .ai-chrome .dots { display: flex; gap: 6px; }
[data-page="landing"] .ai-chrome .dots i { width: 10px; height: 10px; border-radius: 50%; display: block; }
[data-page="landing"] .ai-chrome .dots i:nth-child(1) { background: oklch(0.78 0.15 25); }
[data-page="landing"] .ai-chrome .dots i:nth-child(2) { background: oklch(0.84 0.13 75); }
[data-page="landing"] .ai-chrome .dots i:nth-child(3) { background: oklch(0.78 0.13 155); }
[data-page="landing"] .ai-chrome .url {
  flex: 1;
  font-family: var(--ff-mono);
  font-size: 11px;
  color: var(--ink-faint);
  background: var(--surface-3);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  padding: 4px 10px;
  text-align: center;
  max-width: 360px;
  margin: 0 auto;
}
[data-page="landing"] .ai-chrome .placeholder { width: 56px; }
[data-page="landing"] .ai-input {
  display: flex; align-items: center; gap: var(--s-3);
  padding: var(--s-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
[data-page="landing"] .ai-input .icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand), var(--brand-deep));
  color: oklch(0.99 0 0);
  display: grid; place-items: center;
  flex-shrink: 0;
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: 12px;
}
[data-page="landing"] .ai-input input {
  flex: 1;
  font-family: var(--ff-body);
  font-size: 14px;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
  letter-spacing: -0.01em;
}
[data-page="landing"] .ai-input input::placeholder { color: var(--ink-faint); }
[data-page="landing"] .ai-input .send {
  font-family: var(--ff-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--brand-deep);
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--brand-tint);
  border: 1px solid var(--brand-deep-soft);
  display: inline-flex; align-items: center; gap: 4px;
}
[data-page="landing"] .ai-thread { padding: var(--s-5); display: flex; flex-direction: column; gap: var(--s-5); }
[data-page="landing"] .ai-msg { display: flex; gap: var(--s-3); align-items: flex-start; }
[data-page="landing"] .ai-msg .avatar {
  width: 28px; height: 28px;
  border-radius: 7px;
  flex-shrink: 0;
  display: grid; place-items: center;
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: 11px;
}
[data-page="landing"] .ai-msg.user .avatar { background: var(--surface-2); border: 1px solid var(--border); color: var(--ink-2); }
[data-page="landing"] .ai-msg.bot .avatar {
  background: linear-gradient(135deg, var(--brand), var(--brand-deep));
  color: oklch(0.99 0 0);
}
[data-page="landing"] .ai-msg .body { flex: 1; min-width: 0; }
[data-page="landing"] .ai-msg .head { display: flex; align-items: baseline; gap: var(--s-2); margin-bottom: 4px; }
[data-page="landing"] .ai-msg .head .who { font-weight: 600; font-size: 12px; color: var(--ink); }
[data-page="landing"] .ai-msg .head .meta { font-family: var(--ff-mono); font-size: 10px; color: var(--ink-faint); letter-spacing: 0.04em; }
[data-page="landing"] .ai-msg.user .body p { font-size: 13.5px; color: var(--ink); letter-spacing: -0.01em; }
[data-page="landing"] .ai-result-table {
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  overflow: hidden;
  margin: var(--s-3) 0;
}
[data-page="landing"] .ai-result-table table { width: 100%; font-size: 12px; border-collapse: collapse; }
[data-page="landing"] .ai-result-table th {
  text-align: left;
  padding: 8px 12px;
  background: var(--surface-2);
  font-family: var(--ff-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  border-bottom: 1px solid var(--border);
}
[data-page="landing"] .ai-result-table td { padding: 10px 12px; color: var(--ink); border-bottom: 1px solid var(--border-2); }
[data-page="landing"] .ai-result-table tr:last-child td { border-bottom: 0; }
[data-page="landing"] .ai-result-table td.num { text-align: right; font-family: var(--ff-mono); }
[data-page="landing"] .ai-result-table td.rank { font-family: var(--ff-mono); font-size: 10px; color: var(--ink-faint); width: 32px; }
[data-page="landing"] .ai-result-table td .delta { font-family: var(--ff-mono); font-size: 10px; color: var(--pos); margin-left: 6px; }
[data-page="landing"] .ai-summary {
  font-size: 13px;
  color: var(--ink);
  background: var(--brand-tint);
  border: 1px solid var(--brand-deep-soft);
  border-radius: var(--r-sm);
  padding: var(--s-3);
  margin-top: var(--s-3);
  line-height: 1.5;
}
[data-page="landing"] .ai-summary b { color: var(--brand-deep); font-weight: 600; }
[data-page="landing"] .ai-actions { display: flex; gap: var(--s-2); margin-top: var(--s-3); }
[data-page="landing"] .ai-action-btn {
  font-family: var(--ff-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  padding: 6px 11px;
  border-radius: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--ink-2);
  display: inline-flex; align-items: center; gap: 4px;
}
[data-page="landing"] .ai-action-btn.brand { background: var(--ink); color: oklch(0.99 0 0); border-color: var(--ink); }

/* FACTS */
[data-page="landing"] #facts {
  background: var(--surface-light);
  color: var(--ink-on-light);
  padding: var(--s-9) var(--s-7);
  position: relative;
}
[data-page="landing"] #facts .row {
  max-width: var(--container);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--s-7);
}
[data-page="landing"] #facts .item .num {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-3xl);
  letter-spacing: -0.035em;
  color: var(--ink-on-light);
  line-height: 1;
}
[data-page="landing"] #facts .item .num em { color: var(--brand-deep); font-style: normal; font-weight: 700; }
[data-page="landing"] #facts .item .desc {
  margin-top: var(--s-3);
  font-size: var(--t-sm);
  color: color-mix(in oklch, var(--ink-on-light) 75%, transparent);
  max-width: 24ch;
  line-height: 1.5;
}
[data-page="landing"] #facts .item .label {
  font-family: var(--ff-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: color-mix(in oklch, var(--ink-on-light) 60%, transparent);
  margin-bottom: var(--s-3);
}

/* CTA */
[data-page="landing"] #cta {
  padding: var(--s-10) var(--s-7);
  text-align: center;
  background:
    radial-gradient(ellipse 60% 70% at 50% 30%, var(--brand-glow-soft), transparent 70%),
    var(--surface);
  position: relative;
  overflow: hidden;
}
[data-page="landing"] #cta::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(to right,  var(--border-2) 1px, transparent 1px),
    linear-gradient(to bottom, var(--border-2) 1px, transparent 1px);
  background-size: var(--grid-cell) var(--grid-cell);
  background-position: 50% 0;
  mask-image: radial-gradient(ellipse 60% 80% at 50% 50%, oklch(0 0 0 / 1) 0%, oklch(0 0 0 / 0) 75%);
  -webkit-mask-image: radial-gradient(ellipse 60% 80% at 50% 50%, oklch(0 0 0 / 1) 0%, oklch(0 0 0 / 0) 75%);
  pointer-events: none;
  opacity: 0.5;
}
[data-page="landing"] #cta .cta-inner { max-width: 640px; margin: 0 auto; position: relative; }
[data-page="landing"] #cta h2 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-4xl);
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--ink);
  margin: var(--s-3) 0 var(--s-5);
}
[data-page="landing"] #cta p { font-size: var(--t-md); color: var(--ink-2); margin-bottom: var(--s-7); }
[data-page="landing"] .cta-buttons { display: flex; gap: var(--s-3); justify-content: center; flex-wrap: wrap; }
[data-page="landing"] .cta-meta {
  margin-top: var(--s-7);
  font-family: var(--ff-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

/* FOOTER */
[data-page="landing"] footer {
  background: var(--surface-deepest);
  border-top: 1px solid var(--border);
  padding: var(--s-8) var(--s-7) var(--s-6);
}
[data-page="landing"] footer .footer-grid {
  max-width: var(--container);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: var(--s-7);
  margin-bottom: var(--s-7);
}
[data-page="landing"] footer .col h4 {
  font-family: var(--ff-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: var(--s-4);
}
[data-page="landing"] footer .col ul { list-style: none; display: grid; gap: var(--s-3); }
[data-page="landing"] footer .col a { font-size: var(--t-sm); color: var(--ink-2); transition: color 180ms; }
[data-page="landing"] footer .col a:hover { color: var(--ink); }
[data-page="landing"] footer .col.tag p { font-size: var(--t-sm); color: var(--ink-muted); max-width: 36ch; margin: var(--s-3) 0 var(--s-5); }
[data-page="landing"] footer .access-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--s-2);
  padding: 12px 18px;
  border-radius: var(--r-sm);
  background: var(--brand);
  color: var(--brand-on);
  font-family: var(--ff-body);
  font-size: var(--t-sm);
  font-weight: 600;
  letter-spacing: -0.005em;
  box-shadow: 0 1px 2px oklch(0 0 0 / 0.30), inset 0 1px 0 oklch(1 0 0 / 0.20);
  transition: transform 180ms cubic-bezier(.16,1,.3,1), background 180ms, box-shadow 220ms;
}
[data-page="landing"] footer .access-btn:hover {
  background: var(--brand-light);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px var(--brand-glow-strong);
  color: var(--brand-on);
}
[data-page="landing"] footer .access-btn svg { transition: transform 220ms cubic-bezier(.16,1,.3,1); }
[data-page="landing"] footer .access-btn:hover svg { transform: translateX(3px); }
[data-page="landing"] footer .footer-bottom {
  max-width: var(--container);
  margin: 0 auto;
  padding-top: var(--s-5);
  border-top: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center;
  font-family: var(--ff-mono);
  font-size: var(--t-xs);
  color: var(--ink-faint);
}

/* Responsive */
@media (max-width: 1080px) {
  [data-page="landing"] .cap-grid { grid-template-columns: repeat(4, 1fr); grid-auto-rows: minmax(420px, auto); }
  [data-page="landing"] .cap-grid .tile-inventory { grid-column: span 4; }
  [data-page="landing"] .cap-grid .tile-po,
  [data-page="landing"] .cap-grid .tile-so       { grid-column: span 2; }
  [data-page="landing"] .cap-grid .tile-invoice  { grid-column: span 4; grid-row: span 2; }
  [data-page="landing"] .cap-grid .tile-challan,
  [data-page="landing"] .cap-grid .tile-stock    { grid-column: span 2; }
  [data-page="landing"] .cap-grid .tile-tracking { grid-column: span 4; }
  [data-page="landing"] #facts .row { grid-template-columns: repeat(3, 1fr); gap: var(--s-6); }
  [data-page="landing"] .ai-header { grid-template-columns: 1fr; gap: var(--s-5); }
}
@media (max-width: 760px) {
  [data-page="landing"] nav.site { padding: 0 var(--s-5); }
  [data-page="landing"] .nav-links { display: none; }
  [data-page="landing"] #hero { padding: calc(var(--nav-h) + var(--s-7)) var(--s-5) var(--s-7); }
  [data-page="landing"] .scroll-cue { display: none; }
  [data-page="landing"] .cap-header { grid-template-columns: 1fr; gap: var(--s-4); padding: 0 var(--s-5); margin-bottom: var(--s-7); }
  [data-page="landing"] .cap-grid { grid-template-columns: 1fr; grid-auto-rows: minmax(400px, auto); padding: 0 var(--s-5); }
  [data-page="landing"] .cap-grid > * { grid-column: span 1 !important; grid-row: span 1 !important; }
  [data-page="landing"] .ai-inner { padding: 0 var(--s-5); }
  [data-page="landing"] #ai { padding: var(--s-8) 0; }
  [data-page="landing"] #facts .row { grid-template-columns: 1fr 1fr; gap: var(--s-5); }
  [data-page="landing"] #facts { padding: var(--s-7) var(--s-5); }
  [data-page="landing"] #cta { padding: var(--s-8) var(--s-5); }
  [data-page="landing"] footer { padding: var(--s-7) var(--s-5) var(--s-5); }
  [data-page="landing"] footer .footer-grid { grid-template-columns: 1fr 1fr; gap: var(--s-6); }
  [data-page="landing"] footer .footer-bottom { flex-direction: column; gap: var(--s-3); text-align: center; }
}

@media (prefers-reduced-motion: reduce) {
  [data-page="landing"] *, [data-page="landing"] *::before, [data-page="landing"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  [data-page="landing"] .hero-video-bg { transform: none !important; }
}
`;

const LogoSvg = () => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="var(--brand)" />
    <g transform="translate(14, 16)" fill="#ffffff">
      <path
        fillRule="evenodd"
        d="M 0 0 L 14 0 Q 24 0 24 11 Q 24 18 18 21 L 24 32 L 16 32 L 11 22 L 6 22 L 6 32 L 0 32 Z M 6 6 L 13 6 Q 18 6 18 11 Q 18 16 13 16 L 6 16 Z"
      />
      <path d="M 28 5 L 32 0 L 36 0 L 36 32 L 32 32 L 32 4 Z" />
    </g>
  </svg>
);

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" />
  </svg>
);

export default function LandingPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // `hydrated` blocks the body-bg + persist effect until AFTER we've
  // read localStorage. Without this, the first run of the persist
  // effect (with default "dark") overwrites the user's saved choice
  // before the init effect can apply it.
  const [hydrated, setHydrated] = useState(false);

  // Initial mount: read saved theme (or system pref) and apply.
  useEffect(() => {
    let initial: "dark" | "light" = "dark";
    try {
      const stored = localStorage.getItem("rc-theme") as "dark" | "light" | null;
      if (stored === "dark" || stored === "light") {
        initial = stored;
      } else if (typeof window !== "undefined") {
        initial = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
    } catch {}
    setTheme(initial);
    setHydrated(true);
  }, []);

  // Sync body/html bg + persist to localStorage. Skipped until the
  // init effect above has finished reading storage.
  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    const body = document.body;
    const prevBodyBg = body.style.background;
    const prevHtmlBg = html.style.background;

    const surface =
      theme === "dark" ? "oklch(0.140 0.018 55)" : "oklch(0.987 0.010 75)";
    body.style.background = surface;
    html.style.background = surface;
    try {
      localStorage.setItem("rc-theme", theme);
    } catch {}

    return () => {
      body.style.background = prevBodyBg;
      html.style.background = prevHtmlBg;
    };
  }, [theme, hydrated]);

  // Bullet-proof hero video playback
  useEffect(() => {
    const video = document.querySelector<HTMLVideoElement>("#hero video");
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    const tryPlay = () => video.play().catch(() => {});
    tryPlay();

    let onGesture: (() => void) | null = null;
    if (video.paused) {
      onGesture = () => {
        tryPlay();
        ["click", "touchstart", "scroll", "keydown"].forEach((ev) =>
          window.removeEventListener(ev, onGesture as EventListener)
        );
      };
      ["click", "touchstart", "scroll", "keydown"].forEach((ev) =>
        window.addEventListener(ev, onGesture as EventListener, { once: true, passive: true })
      );
    }

    const onPause = () => {
      if (!video.ended) setTimeout(tryPlay, 80);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    video.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      video.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVis);
      if (onGesture) {
        ["click", "touchstart", "scroll", "keydown"].forEach((ev) =>
          window.removeEventListener(ev, onGesture as EventListener)
        );
      }
    };
  }, []);

  // Scroll progress bar + nav scrolled state
  useEffect(() => {
    const onScroll = () => {
      const s = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const prog = document.getElementById("scroll-progress");
      const nav = document.getElementById("nav");
      if (prog) prog.style.setProperty("--p", (max > 0 ? (s / max) * 100 : 0).toFixed(2) + "%");
      if (nav) nav.classList.toggle("scrolled", s > 32);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Smooth scroll for in-page anchors (delegate)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!target) return;
      const id = target.getAttribute("href") || "";
      if (id === "#" || id.length < 2) return;
      const node = document.querySelector(id);
      if (!node) return;
      e.preventDefault();
      node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // GSAP: load from CDN, then wire up parallax + tile reveals
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const w = window as unknown as { gsap?: any; ScrollTrigger?: any };
    let scriptsAdded: HTMLScriptElement[] = [];

    const init = () => {
      const { gsap, ScrollTrigger } = w;
      if (!gsap || !ScrollTrigger) return;
      gsap.registerPlugin(ScrollTrigger);

      gsap.to("#hero-video-bg", {
        yPercent: 22,
        scale: 1.06,
        scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 1.1 },
      });

      // Subtle slide-up entrance only (no opacity:0). If GSAP fails or
      // ScrollTriggers don't fire, content stays fully visible. Belt
      // and braces vs. the kind of timing race a static HTML page
      // doesn't have to worry about.
      (gsap.utils.toArray("[data-tile]") as HTMLElement[]).forEach((tile) => {
        gsap.from(tile, {
          y: 32,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: tile, start: "top 92%", toggleActions: "play none none none" },
        });
      });

      gsap.from(".cap-header > *", {
        y: 18,
        duration: 0.75,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: ".cap-header", start: "top 85%" },
      });

      gsap.from(".ai-header > *", {
        y: 18,
        duration: 0.75,
        stagger: 0.10,
        ease: "power3.out",
        scrollTrigger: { trigger: ".ai-header", start: "top 85%" },
      });

      gsap.from(".ai-window", {
        y: 40,
        duration: 0.95,
        ease: "power3.out",
        scrollTrigger: { trigger: ".ai-window", start: "top 92%" },
      });

      gsap.from("#facts .item", {
        y: 18,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: { trigger: "#facts", start: "top 85%" },
      });
    };

    if (w.gsap && w.ScrollTrigger) {
      init();
    } else {
      const s1 = document.createElement("script");
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      s1.async = true;
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
      s2.async = true;
      scriptsAdded = [s1, s2];
      document.head.append(s1, s2);
      Promise.all([
        new Promise<void>((r) => (s1.onload = () => r())),
        new Promise<void>((r) => (s2.onload = () => r())),
      ]).then(init);
    }

    return () => {
      const ww = window as unknown as { ScrollTrigger?: any };
      if (ww.ScrollTrigger) ww.ScrollTrigger.getAll().forEach((t: any) => t.kill());
      scriptsAdded.forEach((s) => s.remove());
    };
  }, []);

  const toggleTheme = () => setTheme((p) => (p === "dark" ? "light" : "dark"));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <div data-page="landing" data-theme={theme}>
        <div id="scroll-progress" />

        {/* NAV */}
        <nav className="site" id="nav">
          <Link href="/" className="brand-mark" aria-label="RaniacOne">
            <span className="glyph"><LogoSvg /></span>
            RaniacOne
          </Link>
          <div className="nav-right">
            <div className="nav-links">
              <a href="#capabilities">Platform</a>
              <a href="#ai">AI</a>
              <a href="#cta">Pricing</a>
              <a href="#cta">Docs</a>
            </div>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" type="button">
              <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.2M12 19.3v2.2M3.5 12H1.3M22.7 12h-2.2M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6" />
              </svg>
              <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            </button>
            <div className="nav-cta-group">
              <Link href="/login" className="btn btn-on-dark">Sign in</Link>
              <Link href="/contact" className="btn btn-primary">Talk to our team</Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section id="hero">
          <div className="hero-video-bg" id="hero-video-bg">
            <video autoPlay muted loop playsInline preload="auto" src="/landing/hero.mp4" />
          </div>
          <div className="hero-scrim" aria-hidden="true" />

          <div className="hero-content">
            <div className="hero-copy">
              <h1>
                Inventory, invoicing,<br />
                and dispatch.<br />
                <span className="india">Built for India.</span>
              </h1>
              <p className="lead">
                Purchase orders, GST invoices, delivery challans, live shipment tracking — plus an AI that writes your reports. One platform that knows the difference between CGST and IGST.
              </p>
              <div className="hero-cta">
                <Link href="/contact" className="btn btn-primary btn-lg">
                  Talk to our team
                  <ArrowRight />
                </Link>
                <a href="#capabilities" className="btn btn-on-dark btn-lg">See what you get</a>
              </div>

              <div className="hero-trust-strip">
                <span className="label">Compliance</span>
                <span className="badge brand">GST &amp; e-Invoice</span>
                <span className="badge">e-Way Bill</span>
                <span className="badge">HSN / SAC</span>
                <span className="badge">CGST · SGST · IGST</span>
                <span className="badge">29 states &amp; UTs</span>
              </div>
            </div>
          </div>

          <div className="scroll-cue" aria-hidden="true">
            <span>Scroll</span>
            <span className="stem" />
          </div>
        </section>

        {/* CAPABILITIES */}
        <section id="capabilities">
          <header className="cap-header">
            <h2>Everything your warehouse runs on.<br /><em>Under one login.</em></h2>
            <p>Real screens. Real tax math. Real timestamps. Six product surfaces, one platform — and an AI that reads them all.</p>
          </header>

          <div className="cap-grid">

            {/* Inventory */}
            <article className="tile tile-inventory" data-tile>
              <div className="tile-intro">
                <span className="tag">Inventory</span>
                <h3>Every SKU, every warehouse — one searchable list.</h3>
                <p>Filter by category, location, lot, or status. On-hand, reserved, and available — accurate the moment a document posts. No nightly batches, no stale reports.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / inventory / items · 8,432 items · live</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui ui-inventory">
                    <div className="inv-header">
                      <div className="left">
                        <div className="h">Items</div>
                        <div className="inv-search">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                            <circle cx="5" cy="5" r="3.5" />
                            <path d="M7.5 7.5L10 10" />
                          </svg>
                          <span>Search SKU, barcode, lot…</span>
                        </div>
                      </div>
                      <div className="inv-filters">
                        <span className="chip active">All · 8,432</span>
                        <span className="chip">Low stock · 14</span>
                        <span className="chip">Out · 2</span>
                        <span className="chip">Pune WH</span>
                        <span className="chip">Bengaluru WH</span>
                      </div>
                    </div>
                    <div className="inv-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Item</th><th>HSN</th><th>Category</th><th>Location</th>
                            <th className="num">On hand</th><th className="num">Reserved</th><th className="num">Available</th>
                            <th className="num">Reorder</th><th className="num">Value</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><div className="sku-glyph"><div className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></svg></div><div className="info"><b>Bearing 6204-2RS</b><small>BR-6204-2RS</small></div></div></td>
                            <td>8483</td><td>Bearings</td><td>Pune WH · A-04-12</td>
                            <td className="num">240</td><td className="num">120</td><td className="num"><b>120</b></td>
                            <td className="num">100</td><td className="num">₹39,600</td>
                            <td><span className="inv-row-status ok">In stock</span></td>
                          </tr>
                          <tr>
                            <td><div className="sku-glyph"><div className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="10" height="9" rx="1" /><path d="M5 4V2h6v2M6 8h4M6 11h3" /></svg></div><div className="info"><b>Motor 1HP 3-phase</b><small>MOT-1HP-3PH</small></div></div></td>
                            <td>8501</td><td>Electric Motors</td><td>Pune WH · B-02-07</td>
                            <td className="num">12</td><td className="num">0</td><td className="num"><b>12</b></td>
                            <td className="num">10</td><td className="num">₹58,200</td>
                            <td><span className="inv-row-status ok">In stock</span></td>
                          </tr>
                          <tr>
                            <td><div className="sku-glyph"><div className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="3" fill="currentColor" /></svg></div><div className="info"><b>Copper Spool 12ga</b><small>CU-12GA-150</small></div></div></td>
                            <td>7411</td><td>Wire &amp; Cable</td><td>Bengaluru WH · C-01-03</td>
                            <td className="num">150</td><td className="num">40</td><td className="num"><b>110</b></td>
                            <td className="num">120</td><td className="num">₹32,700</td>
                            <td><span className="inv-row-status low">Reorder</span></td>
                          </tr>
                          <tr>
                            <td><div className="sku-glyph"><div className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 13V6l4-2 4 2v7M4 13h8M6 13V9h4v4" /></svg></div><div className="info"><b>Hydraulic Pump H200</b><small>HP-H200</small></div></div></td>
                            <td>8413</td><td>Pumps</td><td>Pune WH · D-03-11</td>
                            <td className="num">5</td><td className="num">5</td><td className="num"><b style={{ color: "var(--neg)" }}>0</b></td>
                            <td className="num">8</td><td className="num">₹71,000</td>
                            <td><span className="inv-row-status out">Out of stock</span></td>
                          </tr>
                          <tr>
                            <td><div className="sku-glyph"><div className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="10" height="10" rx="1.5" /><path d="M3 7h10M3 10h10M7 3v10" /></svg></div><div className="info"><b>Aluminium Wire 8ga</b><small>WIRE-AL-8GA</small></div></div></td>
                            <td>7605</td><td>Wire &amp; Cable</td><td>Bengaluru WH · C-01-08</td>
                            <td className="num">320</td><td className="num">75</td><td className="num"><b>245</b></td>
                            <td className="num">200</td><td className="num">₹1,12,400</td>
                            <td><span className="inv-row-status ok">In stock</span></td>
                          </tr>
                          <tr>
                            <td><div className="sku-glyph"><div className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l5-5 5 5-5 5z" /></svg></div><div className="info"><b>Industrial Widget A</b><small>SKU-7842-A</small></div></div></td>
                            <td>8479</td><td>Components</td><td>Pune WH · A-01-02</td>
                            <td className="num">238</td><td className="num">12</td><td className="num"><b>226</b></td>
                            <td className="num">100</td><td className="num">₹34,200</td>
                            <td><span className="inv-row-status ok">In stock</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="inv-footer">
                      <span>Showing 1–6 of 8,432 items</span>
                      <span>Last updated · 2 seconds ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* PO */}
            <article className="tile tile-po" data-tile>
              <div className="tile-intro">
                <span className="tag">Purchase orders</span>
                <h3>Buy with one source of truth.</h3>
                <p>Auto-numbered POs with HSN codes, vendor GSTIN, and tax math built in. Approval flow optional — not assumed.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / purchase-orders / PO-2026-0421</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui ui-po">
                    <div className="doc-head">
                      <span className="doc-num">PO-2026-0421</span>
                      <span className="pill ok"><span className="dot" />Approved</span>
                    </div>
                    <div className="vendor">
                      <div className="avatar">AS</div>
                      <div className="vinfo">
                        <div className="name">Acme Suppliers Pvt. Ltd.</div>
                        <div className="gstin">GSTIN 27ABCDE1234F1Z5 · Maharashtra</div>
                      </div>
                    </div>
                    <table>
                      <thead><tr><th>Item</th><th>HSN</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                      <tbody>
                        <tr><td>Bearing 6204-2RS</td><td>8483</td><td className="num">240</td><td className="num">₹ 142.50</td><td className="num">₹ 34,200</td></tr>
                        <tr><td>Motor 1HP 3-phase</td><td>8501</td><td className="num">12</td><td className="num">₹ 4,850</td><td className="num">₹ 58,200</td></tr>
                        <tr><td>Copper Spool 12ga</td><td>7411</td><td className="num">150</td><td className="num">₹ 218.00</td><td className="num">₹ 32,700</td></tr>
                      </tbody>
                    </table>
                    <div className="totals">
                      <span className="k">Subtotal</span>      <span className="v">₹ 1,25,100.00</span>
                      <span className="k">CGST 9%</span>       <span className="v">₹ 11,259.00</span>
                      <span className="k">SGST 9%</span>       <span className="v">₹ 11,259.00</span>
                      <span className="grand-k">Total</span>   <span className="grand-v">₹ 1,47,618.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* SO */}
            <article className="tile tile-so" data-tile>
              <div className="tile-intro">
                <span className="tag">Sales orders</span>
                <h3>Reserve stock the moment a customer confirms.</h3>
                <p>Approved orders soft-hold against on-hand — picking can&rsquo;t oversell what&rsquo;s already promised.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / sales-orders / SO-2026-1284</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui ui-so">
                    <div className="doc-head">
                      <span className="doc-num">SO · SO-2026-1284</span>
                      <span className="pill brand"><span className="dot" />Posted</span>
                    </div>
                    <div className="grid-2">
                      <div className="col">
                        <div className="label">Customer</div>
                        <div className="h">Mehta Industries</div>
                        <div className="l">Andheri East, Mumbai</div>
                        <div className="gstin">27MEHTA0987X2P3</div>
                      </div>
                      <div className="col">
                        <div className="label">Place of supply</div>
                        <div className="h">Maharashtra (27)</div>
                        <div className="l" style={{ marginTop: 8 }}><span className="pill muted" style={{ fontSize: 9 }}>Intra-state · CGST + SGST</span></div>
                      </div>
                    </div>
                    <table>
                      <thead><tr><th>Item</th><th className="num">Ordered</th><th className="num">Reserved</th><th className="num">Status</th></tr></thead>
                      <tbody>
                        <tr><td>Bearing 6204-2RS</td><td className="num">120</td><td className="num">120</td><td className="num"><span className="pill ok" style={{ fontSize: 9 }}>held</span></td></tr>
                        <tr><td>Hydraulic Pump H200</td><td className="num">8</td><td className="num">5</td><td className="num"><span className="pill warn" style={{ fontSize: 9 }}>short 3</span></td></tr>
                        <tr><td>Copper Spool 12ga</td><td className="num">40</td><td className="num">40</td><td className="num"><span className="pill ok" style={{ fontSize: 9 }}>held</span></td></tr>
                      </tbody>
                    </table>
                    <div className="reservation">
                      <span className="l">Soft-held against on-hand</span>
                      <span className="v">165 / 168 units</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Invoice */}
            <article className="tile tile-invoice" data-tile>
              <div className="tile-intro">
                <span className="tag">GST invoicing</span>
                <h3>Tax invoices that pass an audit.</h3>
                <p>CGST + SGST or IGST, split automatically by place of supply. e-Invoice IRN, QR code, and e-Way Bill generated at posting time — no copy-pasting from Tally.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / invoices / INV-2026-2891 · GST · e-Invoice</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui ui-invoice">
                    <div className="inv-head">
                      <div className="left">
                        <div className="title">Tax Invoice</div>
                        <div className="sub">Original for recipient</div>
                      </div>
                      <div className="right">
                        <div className="who">RaniacOne Demo Pvt. Ltd.</div>
                        <div className="meta">GSTIN 06ACME5678Y9K4 · Haryana</div>
                        <div className="meta">Invoice INV-2026-2891</div>
                        <div className="meta">Date 26-Apr-2026</div>
                      </div>
                    </div>
                    <div className="parties grid-3">
                      <div className="col">
                        <div className="label">Bill to</div>
                        <div className="h">Mehta Industries Pvt. Ltd.</div>
                        <div className="l">15, MIDC Industrial Estate<br />Andheri East, Mumbai 400093</div>
                        <div className="gstin">27MEHTA0987X2P3</div>
                      </div>
                      <div className="col">
                        <div className="label">Ship to</div>
                        <div className="h">Mehta Warehouse — Bhiwandi</div>
                        <div className="l">Plot 42, Sector 7<br />Bhiwandi, Thane 421302</div>
                        <div className="gstin">27MEHTA0987X2P3</div>
                      </div>
                      <div className="col">
                        <div className="label">Place of supply</div>
                        <div className="h">Maharashtra <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>(27)</span></div>
                        <div className="l" style={{ marginTop: 6 }}><span className="pill muted" style={{ fontSize: 9 }}>Inter-state · IGST 18%</span></div>
                        <div className="l" style={{ marginTop: 8, fontFamily: "var(--ff-mono)", color: "var(--ink-faint)", fontSize: 9.5, letterSpacing: "0.06em" }}>E-WAY BILL · 481032916740</div>
                      </div>
                    </div>
                    <table>
                      <thead>
                        <tr><th>Item</th><th>HSN/SAC</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Taxable</th><th className="num">IGST 18%</th><th className="num">Amount</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>Bearing 6204-2RS</td><td>8483</td><td className="num">120</td><td className="num">₹ 165.00</td><td className="num">₹ 19,800.00</td><td className="num">₹ 3,564.00</td><td className="num">₹ 23,364.00</td></tr>
                        <tr><td>Hydraulic Pump H200</td><td>8413</td><td className="num">5</td><td className="num">₹ 14,200.00</td><td className="num">₹ 71,000.00</td><td className="num">₹ 12,780.00</td><td className="num">₹ 83,780.00</td></tr>
                        <tr><td>Copper Spool 12ga</td><td>7411</td><td className="num">40</td><td className="num">₹ 245.00</td><td className="num">₹ 9,800.00</td><td className="num">₹ 1,764.00</td><td className="num">₹ 11,564.00</td></tr>
                      </tbody>
                    </table>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: "var(--s-4)", alignItems: "start" }}>
                      <div>
                        <div className="qr-strip">
                          <div className="qr" aria-hidden="true" />
                          <div className="info">
                            <div className="label">e-Invoice IRN</div>
                            <div className="irn">b2c4d8a1f7e34c9b8a2e5f6d4c7b9e3a1f8d6c2b5e9a7c4d8f1e3b6a9c2d5e8f</div>
                          </div>
                          <div className="info" style={{ textAlign: "right" }}>
                            <div className="label">Ack no.</div>
                            <div className="irn" style={{ whiteSpace: "nowrap" }}>112526041800142</div>
                            <div className="label" style={{ marginTop: 4 }}>Ack date</div>
                            <div className="irn" style={{ whiteSpace: "nowrap" }}>26-04-2026 09:42</div>
                          </div>
                        </div>
                      </div>
                      <div className="totals">
                        <span className="k">Taxable value</span>   <span className="v">₹ 1,00,600.00</span>
                        <span className="k">IGST 18%</span>        <span className="v">₹ 18,108.00</span>
                        <span className="k">Round off</span>      <span className="v">−₹ 0.00</span>
                        <span className="grand-k">Grand total</span><span className="grand-v">₹ 1,18,708.00</span>
                      </div>
                    </div>
                    <div className="words">Rupees one lakh eighteen thousand seven hundred and eight only.</div>
                  </div>
                </div>
              </div>
            </article>

            {/* Challan */}
            <article className="tile tile-challan" data-tile>
              <div className="tile-intro">
                <span className="tag">Delivery challan</span>
                <h3>Send goods. Document everything.</h3>
                <p>Vehicle, driver, route — captured before the truck rolls.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / challans / DC-2026-0891</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui ui-challan">
                    <div className="doc-head">
                      <span className="doc-num">DC-2026-0891</span>
                      <span className="pill brand"><span className="dot" />Dispatched</span>
                    </div>
                    <div className="route">
                      <span>Pune Warehouse</span>
                      <span className="arrow">→</span>
                      <span style={{ color: "var(--ink)" }}>Mehta Industries, Mumbai</span>
                    </div>
                    <div className="vehicle-row">
                      <div className="vehicle-plate">MH 04 AB 1234</div>
                      <div className="driver">
                        <div className="nm">Ramesh Kumar</div>
                        <div className="ph">+91 98765 43210</div>
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="col">
                        <div className="label">Loaded at</div>
                        <div className="h" style={{ fontFamily: "var(--ff-mono)", fontSize: 11 }}>09:14 · 26-Apr</div>
                      </div>
                      <div className="col">
                        <div className="label">Expected delivery</div>
                        <div className="h" style={{ fontFamily: "var(--ff-mono)", fontSize: 11 }}>14:30 · 26-Apr</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* Stock */}
            <article className="tile tile-stock" data-tile>
              <div className="tile-intro">
                <span className="tag">Live stock summary</span>
                <h3>Pin what you check most.</h3>
                <p>A dashboard widget for the SKUs your team refreshes ten times a day. Always current, never stale.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / dashboard / live-stock</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui ui-stock">
                    <div className="doc-head">
                      <span style={{ fontFamily: "var(--ff-display)", fontWeight: 600, fontSize: 13, color: "var(--ink)", letterSpacing: "-0.018em" }}>Pune WH · top 5</span>
                      <span className="pill ok"><span className="dot" />Synced</span>
                    </div>
                    <div className="stock-row head">
                      <span>SKU</span><span className="num">On</span><span className="num">Res.</span><span className="num">Avail.</span>
                    </div>
                    <div className="stock-row"><span className="sku">BR-6204-2RS</span><span className="num">240</span><span className="num">120</span><span className="num brand">120</span></div>
                    <div className="stock-row"><span className="sku">MOT-1HP-3PH</span><span className="num">12</span><span className="num">0</span><span className="num brand">12</span></div>
                    <div className="stock-row"><span className="sku">CU-12GA-150</span><span className="num">150</span><span className="num">40</span><span className="num brand">110</span></div>
                    <div className="stock-row"><span className="sku">HP-H200</span><span className="num">5</span><span className="num">5</span><span className="num" style={{ color: "var(--neg)" }}>0</span></div>
                    <div className="stock-row"><span className="sku">WIRE-AL-8GA</span><span className="num">320</span><span className="num">75</span><span className="num brand">245</span></div>
                  </div>
                </div>
              </div>
            </article>

            {/* Tracking */}
            <article className="tile tile-tracking" data-tile>
              <div className="tile-intro">
                <span className="tag">Shipment tracking</span>
                <h3>Door-to-door visibility.</h3>
                <p>Loaded, dispatched, in transit, delivered, returned. Every step timestamped against a vehicle and a driver. Your customer asks "where is it?" — you have the answer in one click.</p>
              </div>
              <div className="window">
                <header className="window-chrome">
                  <div className="dots"><i /><i /><i /></div>
                  <div className="url"><span className="lock">⌁</span>app.raniacone.in / shipments / SHP-2026-3491 · live tracking</div>
                  <div className="placeholder" />
                </header>
                <div className="window-body">
                  <div className="ui-tracking">
                    <div className="head">
                      <div>
                        <div style={{ fontFamily: "var(--ff-display)", fontWeight: 600, fontSize: 14, color: "var(--ink)", letterSpacing: "-0.02em" }}>Shipment SHP-2026-3491</div>
                        <div style={{ fontFamily: "var(--ff-mono)", fontSize: 10.5, color: "var(--ink-faint)", marginTop: 2 }}>SO-2026-1284 · Mehta Industries · Mumbai</div>
                      </div>
                      <div className="right">
                        <span className="pill brand" style={{ fontSize: 10 }}><span className="dot" />In transit</span>
                        <div className="vehicle-plate">MH 04 AB 1234</div>
                        <span style={{ fontFamily: "var(--ff-mono)", fontSize: 10.5, color: "var(--ink-2)" }}>Ramesh K. · +91 98765 43210</span>
                      </div>
                    </div>
                    <div className="timeline">
                      <div className="tl-step done"><div className="node" /><div className="time">09:14</div><div className="place">Pune Warehouse<span className="sub">Loaded</span></div></div>
                      <div className="tl-step done"><div className="node" /><div className="time">09:42</div><div className="place">Hadapsar Toll<span className="sub">Out for delivery</span></div></div>
                      <div className="tl-step done"><div className="node" /><div className="time">12:35</div><div className="place">Lonavala<span className="sub">Checkpoint</span></div></div>
                      <div className="tl-step live"><div className="node" /><div className="time">14:08</div><div className="place">Mumbai (Andheri)<span className="sub">Delivering now</span></div></div>
                      <div className="tl-step scheduled"><div className="node" /><div className="time">— : —</div><div className="place">Return to Pune WH<span className="sub">Scheduled 18:00</span></div></div>
                    </div>
                  </div>
                </div>
              </div>
            </article>

          </div>
        </section>

        {/* AI */}
        <section id="ai">
          <div className="ai-inner">
            <header className="ai-header">
              <div className="left">
                <div className="ai-tag"><span className="dot" />AI · Beta</div>
                <h2>Ask in plain English.<br /><em>Get the report.</em></h2>
              </div>
              <div className="right">
                <p>No more export-to-Excel-then-pivot-then-format ritual. Type a question — RaniacOne reads your inventory, movements, invoices, and shipments, and writes the answer back with citations you can audit.</p>
                <ul>
                  <li>Tables, charts, and summaries from a single question</li>
                  <li>Schedule it as a daily, weekly, or monthly report</li>
                  <li>Pin to dashboard, export PDF, share with a link</li>
                </ul>
              </div>
            </header>

            <div className="ai-window">
              <header className="ai-chrome">
                <div className="dots"><i /><i /><i /></div>
                <div className="url">app.raniacone.in / ai / ask</div>
                <div className="placeholder" />
              </header>

              <div className="ai-input">
                <div className="icon">R1</div>
                <input type="text" defaultValue="Top 5 customers by GST invoice value, this quarter." readOnly />
                <button className="send">
                  Ask
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 5.5h7M6 2.5L9.5 5.5L6 8.5" /></svg>
                </button>
              </div>

              <div className="ai-thread">
                <div className="ai-msg user">
                  <div className="avatar">P</div>
                  <div className="body">
                    <div className="head"><span className="who">Priya Mehta</span><span className="meta">09:42 · ops@mehta-industries.in</span></div>
                    <p>Top 5 customers by GST invoice value, this quarter.</p>
                  </div>
                </div>

                <div className="ai-msg bot">
                  <div className="avatar">R1</div>
                  <div className="body">
                    <div className="head"><span className="who">RaniacOne AI</span><span className="meta">09:42 · read 8,432 invoices · 1.2s</span></div>

                    <div className="ai-result-table">
                      <table>
                        <thead>
                          <tr><th></th><th>Customer</th><th className="num">Invoices</th><th className="num">Value</th><th className="num">IGST</th><th className="num">vs. last Q</th></tr>
                        </thead>
                        <tbody>
                          <tr><td className="rank">01</td><td><b>Mehta Industries Pvt. Ltd.</b><br /><small style={{ fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--ink-faint)" }}>27MEHTA0987X2P3</small></td><td className="num">34</td><td className="num">₹ 18,42,500</td><td className="num">₹ 2,82,250</td><td className="num"><span className="delta">▲ 18%</span></td></tr>
                          <tr><td className="rank">02</td><td><b>Sharma &amp; Sons Trading Co.</b><br /><small style={{ fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--ink-faint)" }}>29SHARM4567Z8K2</small></td><td className="num">29</td><td className="num">₹ 14,68,900</td><td className="num">₹ 2,21,420</td><td className="num"><span className="delta">▲ 9%</span></td></tr>
                          <tr><td className="rank">03</td><td><b>Krishna Engineering Works</b><br /><small style={{ fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--ink-faint)" }}>33KRISH8842P1L9</small></td><td className="num">22</td><td className="num">₹ 11,24,750</td><td className="num">₹ 1,68,290</td><td className="num"><span className="delta" style={{ color: "var(--ink-faint)" }}>— flat</span></td></tr>
                          <tr><td className="rank">04</td><td><b>Acme Suppliers Pvt. Ltd.</b><br /><small style={{ fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--ink-faint)" }}>27ABCDE1234F1Z5</small></td><td className="num">18</td><td className="num">₹ 8,92,400</td><td className="num">₹ 1,33,860</td><td className="num"><span className="delta">▲ 4%</span></td></tr>
                          <tr><td className="rank">05</td><td><b>Bhatia Trading House</b><br /><small style={{ fontFamily: "var(--ff-mono)", fontSize: 10, color: "var(--ink-faint)" }}>07BHATI2351Y6T8</small></td><td className="num">15</td><td className="num">₹ 7,61,200</td><td className="num">₹ 1,14,180</td><td className="num"><span className="delta" style={{ color: "var(--neg)" }}>▼ 6%</span></td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="ai-summary">
                      Top 5 customers contributed <b>₹ 60,89,750</b> in invoice value this quarter — <b>+12% MoM</b>, mostly driven by Mehta Industries (Maharashtra). Bhatia Trading slipped 6% after their March invoices were short on Pump H200, which is currently out of stock in Pune WH.
                    </div>

                    <div className="ai-actions">
                      <button className="ai-action-btn brand"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 5.5L4.5 8L9 3" /></svg>Pin to dashboard</button>
                      <button className="ai-action-btn"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2.5 1.5h6L9.5 3v6.5h-7zM4 5h3M4 7h3" /></svg>Export PDF</button>
                      <button className="ai-action-btn"><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="5.5" cy="5.5" r="4" /><path d="M5.5 3v3l2 1.5" /></svg>Schedule weekly</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FACTS */}
        <section id="facts">
          <div className="row">
            <div className="item">
              <div className="label">Compliance</div>
              <div className="num"><em>GST</em>-ready</div>
              <div className="desc">CGST, SGST, IGST, UTGST. HSN/SAC on every line. IRN + QR generated at posting time.</div>
            </div>
            <div className="item">
              <div className="label">Documents</div>
              <div className="num"><em>6</em> Out-of-the-box</div>
              <div className="desc">PO, SO, Tax Invoice, Delivery Challan, Credit Note, e-Way Bill — pre-numbered, validated.</div>
            </div>
            <div className="item">
              <div className="label">Latency</div>
              <div className="num">Sub-<em>second</em></div>
              <div className="desc">Live stock balances updated as documents post. No nightly batches, no stale reports.</div>
            </div>
            <div className="item">
              <div className="label">Audit</div>
              <div className="num">Every <em>move</em></div>
              <div className="desc">Immutable movement ledger. Posted documents reverse, never delete. Defensible to your CA.</div>
            </div>
            <div className="item">
              <div className="label">Tracking</div>
              <div className="num">Door-to-<em>door</em></div>
              <div className="desc">Vehicle, driver, timestamps for load, dispatch, checkpoints, delivery, and return-to-office.</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta">
          <div className="cta-inner">
            <span className="eyebrow">Get in touch</span>
            <h2>Let&rsquo;s see if we&rsquo;re a fit.</h2>
            <p>Tell us about your warehouse. We&rsquo;ll set up a 30-minute call, walk you through RaniacOne on your data, and quote you something honest.</p>
            <div className="cta-buttons">
              <Link href="/contact" className="btn btn-primary btn-lg">
                Talk to our team
                <ArrowRight />
              </Link>
              <a href="mailto:hello@raniacone.in" className="btn btn-ghost btn-lg">Email us directly</a>
            </div>
            <div className="cta-meta">No card · No commitment · Reply within 1 business day</div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="footer-grid">
            <div className="col tag">
              <div className="brand-mark">
                <span className="glyph"><LogoSvg /></span>
                RaniacOne
              </div>
              <p>Inventory and operations for India's warehouses. PO to GST invoice, on one platform.</p>
              <Link href="/login" className="access-btn">
                Access your RaniacOne
                <ArrowRight />
              </Link>
            </div>
            <div className="col">
              <h4>Product</h4>
              <ul>
                <li><a href="#capabilities">Capabilities</a></li>
                <li><a href="#ai">AI</a></li>
                <li><Link href="/contact">Pricing</Link></li>
                <li><Link href="/contact">Talk to sales</Link></li>
              </ul>
            </div>
            <div className="col">
              <h4>Resources</h4>
              <ul>
                <li><a href="#">Docs</a></li>
                <li><a href="#">API reference</a></li>
                <li><a href="#">e-Invoice setup</a></li>
                <li><a href="#">Changelog</a></li>
              </ul>
            </div>
            <div className="col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Customers</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="mailto:hello@raniacone.in">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 RaniacOne, Inc.</span>
            <span>SOC 2 type II · ISO 27001 (in progress) · CIN U72900HR2026PTC100000</span>
          </div>
        </footer>
      </div>
    </>
  );
}
