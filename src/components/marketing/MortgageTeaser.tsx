"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { mortgage } from "@/lib/calculators/mortgage";
import { formatOMR, formatOMRWhole } from "@/lib/money";

// The landing-page centerpiece: three sliders, one live monthly figure.
// Uses the SAME pure mortgage() function as the real calculator — no
// duplicate math, no network calls. Clearly labeled as an estimate.

const ASSUMED_ANNUAL_RATE = 5.0;

function AnimatedAmount({ value }: { value: number }) {
  const locale = useLocale();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (from === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const duration = 320;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="tabular-nums">{formatOMR(display, locale)}</span>;
}

export function MortgageTeaser() {
  const t = useTranslations("home");
  const locale = useLocale();

  const [price, setPrice] = useState(120_000);
  const [downPct, setDownPct] = useState(20);
  const [years, setYears] = useState(25);

  const downPayment = (price * downPct) / 100;
  const result = mortgage({
    propertyPrice: price,
    downPayment,
    annualRatePct: ASSUMED_ANNUAL_RATE,
    years,
    mode: "conventional",
  });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-stone-200">
      <h2 className="text-sm font-semibold text-stone-900">
        {t("teaserTitle")}
      </h2>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <label htmlFor="teaser-price" className="font-medium text-stone-600">
              {t("teaserPrice")}
            </label>
            <span className="font-semibold text-stone-900 tabular-nums">
              {formatOMRWhole(price, locale)}
            </span>
          </div>
          <input
            id="teaser-price"
            type="range"
            className="range-slider"
            min={30_000}
            max={500_000}
            step={5_000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <label htmlFor="teaser-down" className="font-medium text-stone-600">
              {t("teaserDownPayment")}
            </label>
            <span className="font-semibold text-stone-900 tabular-nums">
              {downPct}% · {formatOMRWhole(downPayment, locale)}
            </span>
          </div>
          <input
            id="teaser-down"
            type="range"
            className="range-slider"
            min={0}
            max={50}
            step={5}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.target.value))}
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <label htmlFor="teaser-years" className="font-medium text-stone-600">
              {t("teaserYears")}
            </label>
            <span className="font-semibold text-stone-900 tabular-nums">
              {t("teaserYearsValue", { years })}
            </span>
          </div>
          <input
            id="teaser-years"
            type="range"
            className="range-slider"
            min={5}
            max={30}
            step={1}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100">
        <div className="text-xs font-medium text-brand-900">
          {t("teaserMonthly")}
        </div>
        <div className="mt-1 text-3xl font-bold text-brand-800">
          <AnimatedAmount value={result.monthlyPayment} />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {t("teaserNote", { rate: ASSUMED_ANNUAL_RATE })}
        </p>
      </div>

      <Link
        href="/calculators/mortgage"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
      >
        {t("teaserFullCalculator")}
      </Link>
    </div>
  );
}
