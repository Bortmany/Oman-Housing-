"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useLocale } from "next-intl";

// Cloudflare Turnstile widget. Renders NOTHING unless the public site key is
// set (the matching secret is checked server-side in src/lib/captcha.ts), so
// the forms are unchanged while the CAPTCHA is dormant. When active, the
// widget drops a hidden `cf-turnstile-response` input into the enclosing
// form; the server actions / authorize() verify it with Cloudflare.
//
// `resetKey`: change it after a rejected submission — each token is single
// use, so the widget must issue a fresh one before the visitor tries again.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function Turnstile({ resetKey }: { resetKey?: unknown }) {
  const locale = useLocale();
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  function mount() {
    const api = window.turnstile;
    if (!api || !boxRef.current || widgetId.current || !SITE_KEY) return;
    widgetId.current = api.render(boxRef.current, {
      sitekey: SITE_KEY,
      language: locale,
      theme: "light",
    });
  }

  // The script may already be on the page (client-side navigation between
  // forms), in which case onLoad never fires again — mount straight away.
  useEffect(() => {
    mount();
    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A rejected submission burns the token — hand out a fresh one.
  useEffect(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script src={SCRIPT_URL} strategy="afterInteractive" onLoad={mount} />
      {/* The widget draws its own UI; dir="ltr" keeps its layout stable. */}
      <div ref={boxRef} dir="ltr" className="min-h-[65px]" />
    </>
  );
}
