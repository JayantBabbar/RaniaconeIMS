"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════
   Contact page — "Talk to our team"
   Reuses the marketing aesthetic (saffron-amber, dark/light themes).
   Form is stub-submitted (logs to console + shows success state).
   When you're ready to wire up a real backend:
     - replace handleSubmit with a fetch('/api/contact', ...) call
     - or POST to a service like Formspree / Resend / your own Lambda
   ═══════════════════════════════════════════════════════════════════ */

const CONTACT_CSS = `
[data-page="contact"] {
  --surface:        oklch(0.140 0.018 55);
  --surface-2:      oklch(0.175 0.020 55);
  --surface-3:      oklch(0.210 0.022 55);
  --surface-elev:   oklch(0.250 0.024 55);

  --border:         oklch(0.250 0.020 55);
  --border-2:       oklch(0.205 0.018 55);
  --border-strong:  oklch(0.345 0.024 55);

  --ink:            oklch(0.972 0.012 75);
  --ink-2:          oklch(0.835 0.016 65);
  --ink-muted:      oklch(0.640 0.018 60);
  --ink-faint:      oklch(0.460 0.014 55);

  --brand:          oklch(0.745 0.180 65);
  --brand-deep:     oklch(0.620 0.180 50);
  --brand-light:    oklch(0.860 0.140 75);
  --brand-tint:     oklch(0.300 0.080 55);
  --brand-on:       oklch(0.140 0.018 55);

  --brand-glow-strong: oklch(0.745 0.180 65 / 0.40);
  --brand-glow:        oklch(0.745 0.180 65 / 0.20);
  --brand-pulse:       oklch(0.860 0.140 75 / 0.65);

  --pos:            oklch(0.720 0.140 145);
  --neg:            oklch(0.715 0.180  25);

  --ff-display: 'Switzer', system-ui, -apple-system, sans-serif;
  --ff-body:    'General Sans', system-ui, -apple-system, sans-serif;
  --ff-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --t-xs: 0.75rem;  --t-sm: 0.875rem;  --t-base: 1rem;
  --t-md: 1.125rem; --t-lg: 1.25rem;   --t-xl: 1.5rem;
  --t-3xl: clamp(2rem, 2.5vw + 1rem, 2.625rem);
  --t-4xl: clamp(2.5rem, 4vw + 1rem, 3.5rem);

  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;
  --s-9: 96px;

  --r-sm: 8px; --r-md: 14px; --r-lg: 20px; --r-xl: 28px;

  --glass-1: oklch(1 0 0 / 0.07);
  --glass-2: oklch(1 0 0 / 0.14);
  --glass-edge: oklch(1 0 0 / 0.16);

  --container: 1200px;
  --nav-h: 68px;

  background: var(--surface);
  color: var(--ink-2);
  font-family: var(--ff-body);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
[data-page="contact"][data-theme="light"] {
  --surface:        oklch(0.987 0.010 75);
  --surface-2:      oklch(0.965 0.012 70);
  --surface-3:      oklch(0.940 0.014 65);
  --surface-elev:   oklch(0.920 0.016 60);
  --border:         oklch(0.900 0.018 65);
  --border-2:       oklch(0.935 0.014 70);
  --border-strong:  oklch(0.825 0.022 60);
  --ink:            oklch(0.180 0.020 50);
  --ink-2:          oklch(0.350 0.018 55);
  --ink-muted:      oklch(0.500 0.018 60);
  --ink-faint:      oklch(0.660 0.014 65);
  --brand:          oklch(0.620 0.180 50);
  --brand-deep:     oklch(0.500 0.180 45);
  --brand-light:    oklch(0.760 0.150 60);
  --brand-tint:     oklch(0.960 0.040 65);
  --brand-on:       oklch(0.987 0.010 75);
  --brand-glow-strong: oklch(0.620 0.180 50 / 0.30);
  --brand-glow:        oklch(0.620 0.180 50 / 0.18);
  --brand-pulse:       oklch(0.620 0.180 50 / 0.55);
  --glass-1: oklch(0.18 0.020 50 / 0.05);
  --glass-2: oklch(0.18 0.020 50 / 0.10);
  --glass-edge: oklch(0.18 0.020 50 / 0.12);
}

[data-page="contact"] *, [data-page="contact"] *::before, [data-page="contact"] *::after {
  margin: 0; padding: 0; box-sizing: border-box;
}
[data-page="contact"] a { color: inherit; text-decoration: none; }
[data-page="contact"] button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
[data-page="contact"] ::selection { background: var(--brand-tint); color: var(--ink); }

/* Top bar */
[data-page="contact"] .topbar {
  position: sticky; top: 0; z-index: 10;
  height: var(--nav-h);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 var(--s-7);
  background: color-mix(in oklch, var(--surface) 78%, transparent);
  border-bottom: 1px solid var(--border);
  backdrop-filter: saturate(140%) blur(16px);
  -webkit-backdrop-filter: saturate(140%) blur(16px);
  color: var(--ink);
}
[data-page="contact"] .brand-mark {
  display: inline-flex; align-items: center; gap: var(--s-3);
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-md);
  letter-spacing: -0.015em;
  color: var(--ink);
}
[data-page="contact"] .brand-mark .glyph { width: 32px; height: 32px; }
[data-page="contact"] .brand-mark .glyph svg { width: 100%; height: 100%; display: block; }
[data-page="contact"] .topbar .right { display: flex; align-items: center; gap: var(--s-4); }
[data-page="contact"] .back-link {
  display: inline-flex; align-items: center; gap: var(--s-2);
  font-family: var(--ff-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-2);
  padding: 6px 10px;
  border-radius: var(--r-sm);
  transition: color 180ms, background 180ms;
}
[data-page="contact"] .back-link:hover { color: var(--ink); background: var(--glass-1); }
[data-page="contact"] .theme-toggle {
  width: 38px; height: 38px;
  border-radius: var(--r-sm);
  background: var(--glass-1);
  border: 1px solid var(--glass-edge);
  display: grid; place-items: center;
  color: var(--ink);
  transition: background 180ms, transform 180ms cubic-bezier(.16,1,.3,1);
}
[data-page="contact"] .theme-toggle:hover { background: var(--glass-2); transform: rotate(-12deg); }
[data-page="contact"] .theme-toggle svg { width: 18px; height: 18px; }
[data-page="contact"] .theme-toggle .icon-moon { display: none; }
[data-page="contact"] .theme-toggle .icon-sun  { display: block; }
[data-page="contact"][data-theme="light"] .theme-toggle .icon-sun  { display: none; }
[data-page="contact"][data-theme="light"] .theme-toggle .icon-moon { display: block; }

/* Page layout */
[data-page="contact"] .container {
  max-width: var(--container);
  margin: 0 auto;
  padding: var(--s-9) var(--s-7);
}
[data-page="contact"] .head {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: var(--s-8);
  align-items: end;
  margin-bottom: var(--s-9);
}
[data-page="contact"] .head .eyebrow {
  font-family: var(--ff-mono);
  font-size: var(--t-xs);
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--brand-light);
  display: inline-flex; align-items: center; gap: var(--s-2);
  margin-bottom: var(--s-4);
}
[data-page="contact"] .head .eyebrow .dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--brand-light);
  box-shadow: 0 0 0 0 var(--brand-pulse);
  animation: contactPulse 2.4s cubic-bezier(.4,0,.6,1) infinite;
}
@keyframes contactPulse {
  0%   { box-shadow: 0 0 0 0 var(--brand-pulse); }
  70%  { box-shadow: 0 0 0 12px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
[data-page="contact"] .head h1 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-4xl);
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--ink);
}
[data-page="contact"] .head h1 em { color: var(--brand-light); font-style: italic; font-weight: 600; }
[data-page="contact"] .head .blurb {
  font-size: var(--t-md);
  line-height: 1.55;
  color: var(--ink-2);
  max-width: 44ch;
}

/* Two-column layout: form (left) + sidebar (right) */
[data-page="contact"] .layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: var(--s-8);
  align-items: start;
}

/* Form */
[data-page="contact"] form.contact-form {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: var(--s-7);
}
[data-page="contact"] .field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s-5);
}
[data-page="contact"] .field { display: grid; gap: 6px; }
[data-page="contact"] .field.span-2 { grid-column: span 2; }
[data-page="contact"] .field label {
  font-family: var(--ff-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
[data-page="contact"] .field label .req { color: var(--brand); margin-left: 2px; }
[data-page="contact"] .field input,
[data-page="contact"] .field select,
[data-page="contact"] .field textarea {
  font-family: var(--ff-body);
  font-size: var(--t-base);
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 12px 14px;
  outline: none;
  transition: border-color 180ms, box-shadow 180ms, background 180ms;
  width: 100%;
}
[data-page="contact"] .field input:focus,
[data-page="contact"] .field select:focus,
[data-page="contact"] .field textarea:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-glow);
}
[data-page="contact"] .field input::placeholder,
[data-page="contact"] .field textarea::placeholder { color: var(--ink-faint); }
[data-page="contact"] .field textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
[data-page="contact"] .field select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1.5l5 5 5-5' fill='none' stroke='%239f9489' stroke-width='1.5' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}
[data-page="contact"] .form-actions {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-4);
  margin-top: var(--s-6);
  padding-top: var(--s-6);
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
[data-page="contact"] .submit-btn {
  display: inline-flex; align-items: center; gap: var(--s-2);
  height: 48px; padding: 0 var(--s-6);
  border-radius: var(--r-sm);
  background: var(--brand);
  color: var(--brand-on);
  font-family: var(--ff-body);
  font-size: var(--t-base);
  font-weight: 600;
  letter-spacing: -0.005em;
  box-shadow: 0 1px 2px oklch(0 0 0 / 0.30), inset 0 1px 0 oklch(1 0 0 / 0.20);
  transition: transform 180ms cubic-bezier(.16,1,.3,1), background 180ms, box-shadow 220ms;
}
[data-page="contact"] .submit-btn:hover {
  background: var(--brand-light);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px var(--brand-glow-strong);
}
[data-page="contact"] .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
[data-page="contact"] .submit-btn svg { transition: transform 220ms cubic-bezier(.16,1,.3,1); }
[data-page="contact"] .submit-btn:hover svg { transform: translateX(3px); }
[data-page="contact"] .privacy-note {
  font-size: var(--t-xs);
  color: var(--ink-muted);
  max-width: 36ch;
  line-height: 1.5;
}

/* Success state */
[data-page="contact"] .success {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: var(--s-9) var(--s-7);
  text-align: center;
}
[data-page="contact"] .success .check {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--brand-glow);
  border: 1px solid var(--brand-glow-strong);
  display: grid; place-items: center;
  color: var(--brand-light);
  margin: 0 auto var(--s-5);
}
[data-page="contact"] .success .check svg { width: 28px; height: 28px; }
[data-page="contact"] .success h2 {
  font-family: var(--ff-display);
  font-weight: 700;
  font-size: var(--t-3xl);
  letter-spacing: -0.03em;
  color: var(--ink);
  margin-bottom: var(--s-3);
}
[data-page="contact"] .success p {
  font-size: var(--t-md);
  color: var(--ink-2);
  max-width: 44ch;
  margin: 0 auto var(--s-6);
  line-height: 1.55;
}
[data-page="contact"] .success-actions { display: flex; gap: var(--s-3); justify-content: center; flex-wrap: wrap; }
[data-page="contact"] .ghost-btn {
  display: inline-flex; align-items: center; gap: var(--s-2);
  height: 44px; padding: 0 var(--s-5);
  border-radius: var(--r-sm);
  background: var(--glass-1);
  color: var(--ink);
  font-family: var(--ff-body);
  font-size: var(--t-sm);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--border-strong);
  transition: background 180ms;
}
[data-page="contact"] .ghost-btn:hover { background: var(--glass-2); }

/* Sidebar */
[data-page="contact"] .sidebar { display: flex; flex-direction: column; gap: var(--s-5); }
[data-page="contact"] .info-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: var(--s-6);
}
[data-page="contact"] .info-card .label {
  font-family: var(--ff-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: var(--s-3);
}
[data-page="contact"] .info-card .value {
  font-family: var(--ff-display);
  font-weight: 600;
  font-size: var(--t-lg);
  color: var(--ink);
  letter-spacing: -0.018em;
  line-height: 1.25;
}
[data-page="contact"] .info-card .value a { color: inherit; transition: color 180ms; }
[data-page="contact"] .info-card .value a:hover { color: var(--brand-light); }
[data-page="contact"] .info-card .sub {
  margin-top: var(--s-2);
  font-size: var(--t-sm);
  color: var(--ink-muted);
  line-height: 1.5;
}
[data-page="contact"] .info-card .answer-time {
  display: inline-flex; align-items: center; gap: var(--s-2);
  margin-top: var(--s-3);
  padding: 4px 10px;
  background: var(--brand-glow);
  border: 1px solid var(--brand-glow-strong);
  border-radius: 99px;
  color: var(--brand-light);
  font-family: var(--ff-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
[data-page="contact"] .info-card .answer-time .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--pos);
  box-shadow: 0 0 6px var(--pos);
}

@media (max-width: 880px) {
  [data-page="contact"] .container { padding: var(--s-7) var(--s-5); }
  [data-page="contact"] .head { grid-template-columns: 1fr; gap: var(--s-5); margin-bottom: var(--s-7); }
  [data-page="contact"] .layout { grid-template-columns: 1fr; gap: var(--s-6); }
  [data-page="contact"] .field-grid { grid-template-columns: 1fr; }
  [data-page="contact"] .field.span-2 { grid-column: span 1; }
  [data-page="contact"] .topbar { padding: 0 var(--s-5); }
  [data-page="contact"] form.contact-form { padding: var(--s-5); }
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

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  inquiry: string;
  warehouses: string;
  message: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  company: "",
  email: "",
  phone: "",
  inquiry: "sales",
  warehouses: "1-3",
  message: "",
};

export default function ContactPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // hydrated gates the persist effect so it doesn't overwrite the
  // user's saved choice with the default "dark" on first mount.
  const [hydrated, setHydrated] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Init theme from storage / system preference
  useEffect(() => {
    let initial: "dark" | "light" = "dark";
    try {
      const stored = localStorage.getItem("rc-theme") as "dark" | "light" | null;
      if (stored === "dark" || stored === "light") initial = stored;
      else if (typeof window !== "undefined")
        initial = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch {}
    setTheme(initial);
    setHydrated(true);
  }, []);

  // Sync body bg + persist theme. Skipped until init effect finishes.
  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    const body = document.body;
    const prevBodyBg = body.style.background;
    const prevHtmlBg = html.style.background;
    const surface = theme === "dark" ? "oklch(0.140 0.018 55)" : "oklch(0.987 0.010 75)";
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

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    // Stub submission. When you have a real backend, replace this with:
    //   fetch('/api/contact', { method: 'POST', body: JSON.stringify(form), ... })
    //     .then(...)
    // For now, simulate latency + log + show success.
    // eslint-disable-next-line no-console
    console.log("Contact form submission:", form);
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
    }, 450);
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setSubmitted(false);
  };

  const toggleTheme = () => setTheme((p) => (p === "dark" ? "light" : "dark"));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CONTACT_CSS }} />

      <div data-page="contact" data-theme={theme}>
        <div className="topbar">
          <Link href="/" className="brand-mark" aria-label="RaniacOne">
            <span className="glyph"><LogoSvg /></span>
            RaniacOne
          </Link>
          <div className="right">
            <Link href="/" className="back-link">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 6H3M5.5 3.5L3 6l2.5 2.5" /></svg>
              Back
            </Link>
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" type="button">
              <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.2M12 19.3v2.2M3.5 12H1.3M22.7 12h-2.2M5.6 5.6L4 4M20 20l-1.6-1.6M5.6 18.4L4 20M20 4l-1.6 1.6" />
              </svg>
              <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="container">
          <header className="head">
            <div>
              <div className="eyebrow"><span className="dot" />Talk to our team</div>
              <h1>
                Tell us about your<br />
                <em>warehouse.</em>
              </h1>
            </div>
            <p className="blurb">
              Pricing, deployment, training, e-Invoice setup — we&rsquo;ll set up a 30-minute call,
              walk you through RaniacOne on your data, and quote you something honest.
            </p>
          </header>

          <div className="layout">
            {submitted ? (
              <div className="success">
                <div className="check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l5 5L20 7" />
                  </svg>
                </div>
                <h2>Message received.</h2>
                <p>Thanks, {form.name.split(" ")[0] || "there"}. We&rsquo;ll be back in touch within one business day — usually faster.</p>
                <div className="success-actions">
                  <Link href="/" className="ghost-btn">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 6H3M5.5 3.5L3 6l2.5 2.5" /></svg>
                    Back to home
                  </Link>
                  <button className="ghost-btn" onClick={reset} type="button">
                    Send another
                  </button>
                </div>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="name">Full name<span className="req">*</span></label>
                    <input id="name" type="text" required autoComplete="name" placeholder="Priya Mehta" value={form.name} onChange={update("name")} />
                  </div>
                  <div className="field">
                    <label htmlFor="company">Company<span className="req">*</span></label>
                    <input id="company" type="text" required autoComplete="organization" placeholder="Mehta Industries Pvt. Ltd." value={form.company} onChange={update("company")} />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Work email<span className="req">*</span></label>
                    <input id="email" type="email" required autoComplete="email" placeholder="ops@mehta-industries.in" value={form.email} onChange={update("email")} />
                  </div>
                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={update("phone")} />
                  </div>
                  <div className="field">
                    <label htmlFor="inquiry">What can we help with?</label>
                    <select id="inquiry" value={form.inquiry} onChange={update("inquiry")}>
                      <option value="sales">Pricing &amp; pilot</option>
                      <option value="demo">Personal walkthrough</option>
                      <option value="self-host">Self-host / on-prem</option>
                      <option value="integration">Integration / API</option>
                      <option value="support">Support (existing customer)</option>
                      <option value="general">Something else</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="warehouses">Warehouses to manage</label>
                    <select id="warehouses" value={form.warehouses} onChange={update("warehouses")}>
                      <option value="1-3">1–3</option>
                      <option value="4-10">4–10</option>
                      <option value="11-25">11–25</option>
                      <option value="25+">25+</option>
                    </select>
                  </div>
                  <div className="field span-2">
                    <label htmlFor="message">Message<span className="req">*</span></label>
                    <textarea id="message" required placeholder="A bit about your operation — SKUs, current tools, GST volume, anything that would help us prepare." value={form.message} onChange={update("message")} />
                  </div>
                </div>
                <div className="form-actions">
                  <p className="privacy-note">By submitting, you agree we may contact you about RaniacOne. We don&rsquo;t share your details with anyone else.</p>
                  <button type="submit" className="submit-btn" disabled={submitting}>
                    {submitting ? "Sending…" : "Send message"}
                    {!submitting && <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" /></svg>}
                  </button>
                </div>
              </form>
            )}

            <aside className="sidebar">
              <div className="info-card">
                <div className="label">Email</div>
                <div className="value"><a href="mailto:hello@raniacone.in">hello@raniacone.in</a></div>
                <p className="sub">Sales, partnerships, and product questions.</p>
                <span className="answer-time"><span className="dot" />Within 1 business day</span>
              </div>
              <div className="info-card">
                <div className="label">Phone</div>
                <div className="value"><a href="tel:+919876543210">+91 98765 43210</a></div>
                <p className="sub">Mon–Sat &middot; 10am–7pm IST. Voicemail outside hours.</p>
              </div>
              <div className="info-card">
                <div className="label">Office</div>
                <div className="value">Gurugram &middot; Haryana</div>
                <p className="sub">Visits by appointment. We can also come to you.</p>
              </div>
              <div className="info-card">
                <div className="label">Already a customer?</div>
                <div className="value">Sign in to your workspace.</div>
                <p className="sub" style={{ marginBottom: 12 }}>For support and account questions, the in-app help centre is faster.</p>
                <Link href="/login" className="ghost-btn" style={{ height: 38 }}>
                  Access your RaniacOne
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h6M6.5 3.5L9 6l-2.5 2.5" /></svg>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
