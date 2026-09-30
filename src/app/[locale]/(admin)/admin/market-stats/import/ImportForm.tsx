"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DataProvenance } from "@prisma/client";
import {
  checkMarketStatsImport,
  confirmMarketStatsImport,
  type ImportState,
  type PreviewGroup,
} from "./actions";
import type { FileError, RowError } from "@/lib/csv/marketStatsImport";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Hint, Label } from "@/components/ui/Field";
import { Skeleton, SkeletonTableRows } from "@/components/ui/Skeleton";
import { ProvenanceBadge } from "@/components/provenance/ProvenanceBadge";
import { formatOMR, formatPercent } from "@/lib/money";
import { formatMonth, localName } from "@/lib/i18nData";

// The bulk-upload screen (Align Step 3, Build A). Two server actions share one
// form: "Check file" shows a preview and writes nothing; "Import" re-sends the
// same file and the server checks it all again before saving.
// Column names, values found in the file and web addresses are code-like, so
// they are wrapped dir="ltr" inside Arabic sentences.

const MONEY = new Set(["avgSalePrice", "medianSalePrice", "avgRentMonthly", "avgPricePerSqm"]);
const FOUND_MAX = 24;

function Ltr({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <bdi dir="ltr" title={title} className="font-mono text-[0.85em]">
      {children}
    </bdi>
  );
}

// The sentence follows the page direction; the column name and the value
// found are dropped in afterwards inside dir="ltr" wrappers (placeholders
// \u0001C\u0001 and \u0001V\u0001 mark where they go).
function ltrSentence(
  sentence: string,
  parts: Record<string, string>,
  emptyLabel: string,
): ReactNode {
  return sentence.split(/(\u0001[A-Z]\u0001)/).map((bit, i) => {
    const m = /^\u0001([A-Z])\u0001$/.exec(bit);
    if (!m) return bit;
    const text = parts[m[1]] ?? "";
    return <Ltr key={i}>{text === "" ? emptyLabel : text}</Ltr>;
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function isPreview(state: ImportState): state is Extract<ImportState, { kind: "preview" }> {
  return state?.kind === "preview";
}

type T = ReturnType<typeof useTranslations>;

export function ImportForm({ intro }: { intro: ReactNode }) {
  const t = useTranslations("adminImport");
  const tc = useTranslations("csvImport");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState(0);
  const [showGood, setShowGood] = useState(false);
  // Which action ran last, and whether "choose a different file" cleared it.
  const [last, setLast] = useState<"check" | "confirm">("check");
  const [cleared, setCleared] = useState(false);

  const [checkState, checkAction, checking] = useActionState<ImportState, FormData>(
    checkMarketStatsImport,
    null,
  );
  const [confirmState, confirmAction, importing] = useActionState<ImportState, FormData>(
    confirmMarketStatsImport,
    null,
  );
  const state: ImportState = cleared ? null : last === "confirm" ? confirmState : checkState;
  const busy = checking || importing;

  function reset() {
    formRef.current?.reset();
    setFileName(null);
    setFileSize(0);
    setCleared(true);
  }

  function rowErrorText(e: RowError) {
    const sentence = tc(`errors.${e.code}`, {
      line: e.line,
      column: "\u0001C\u0001",
      value: "\u0001V\u0001",
      level: e.level ? tc(`levels.${e.level}`) : "",
    });
    return ltrSentence(sentence, { C: e.column, V: e.value }, t("emptyValue"));
  }

  function fileErrorText(e: FileError) {
    const sentence = tc(`errors.${e.code}`, { column: "\u0001C\u0001", max: e.max ?? 0 });
    return ltrSentence(sentence, { C: e.column ?? "" }, "");
  }

  const rateLimited = state?.kind === "rateLimited";
  const refusedFile =
    state?.kind === "refused" ||
    state?.kind === "serverError" ||
    state?.kind === "notAllowed" ||
    rateLimited;
  const done = state?.kind === "done" || state?.kind === "partial";

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-6">
        {intro}

        <Card>
          <form ref={formRef} className="space-y-4">
            <ButtonLink
              href="/templates/market-stats-template.csv"
              variant="secondary"
              download
              className="w-full"
            >
              {t("template")}
            </ButtonLink>
            <Hint>{t("templateHint")}</Hint>

            <div>
              <Label htmlFor="import-file">{t("file")}</Label>
              <input
                id="import-file"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                disabled={busy}
                aria-invalid={refusedFile && !rateLimited ? true : undefined}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFileName(f?.name ?? null);
                  setFileSize(f?.size ?? 0);
                  setCleared(true);
                }}
                className={`block min-h-11 w-full cursor-pointer rounded-lg bg-white px-3 py-2 text-sm text-stone-700 ring-1 file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:opacity-50 dark:bg-stone-900 dark:text-stone-200 dark:file:bg-stone-800 ${
                  refusedFile && !rateLimited
                    ? "ring-rose-500"
                    : "ring-stone-300 dark:ring-stone-700"
                }`}
              />
              {fileName && (
                <p className="mt-1 truncate text-xs text-stone-500 dark:text-stone-400">
                  <Ltr>{fileName}</Ltr> · {Math.max(1, Math.round(fileSize / 1024))} KB
                </p>
              )}
            </div>

            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-stone-800 dark:text-stone-200">
              <input
                type="checkbox"
                name="neighborhoodAllowed"
                disabled={busy}
                className="mt-0.5 size-6 shrink-0 accent-teal-800"
              />
              <span>
                {t("namesNeighborhood")}
                <span className="mt-1 block text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
                  {t("namesNeighborhoodHint")}
                </span>
              </span>
            </label>

            {refusedFile && <RefusalBox state={state} t={t} fileErrorText={fileErrorText} />}

            <Button
              type="submit"
              formAction={checkAction}
              onClick={() => {
                setLast("check");
                setCleared(false);
              }}
              disabled={busy || !fileName || rateLimited}
              variant={isPreview(state) && state.problems === 0 ? "secondary" : "primary"}
              className="w-full"
            >
              {checking ? t("checking") : t("check")}
            </Button>

            {isPreview(state) && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={reset}
                className="w-full"
              >
                {t("chooseAnother")}
              </Button>
            )}
            {isPreview(state) && state.problems === 0 && (
              <Button
                type="submit"
                formAction={confirmAction}
                onClick={() => {
                  setLast("confirm");
                  setCleared(false);
                }}
                disabled={busy || state.figures === 0}
                className="w-full"
              >
                {importing ? t("importing") : t("import", { n: state.figures })}
              </Button>
            )}
            {isPreview(state) && state.problems > 0 && (
              <>
                <Button type="button" disabled className="w-full">
                  {t("import", { n: 0 })}
                </Button>
                <Hint>{t("importBlocked")}</Hint>
              </>
            )}
          </form>
        </Card>
      </div>

      <div aria-live="polite" className="min-w-0 space-y-4">
        {checking && <PreviewSkeleton />}
        {!checking && done && <DoneBox state={state} t={t} onAnother={reset} />}
        {!checking && !done && isPreview(state) && (
          <PreviewView
            state={state}
            locale={locale}
            importing={importing}
            showGood={showGood}
            onToggleGood={() => setShowGood((v) => !v)}
            rowErrorText={rowErrorText}
          />
        )}
        {!checking && !done && !isPreview(state) && <EmptyCard t={t} />}
      </div>
    </div>
  );
}

function RefusalBox({
  state,
  t,
  fileErrorText,
}: {
  state: ImportState;
  t: T;
  fileErrorText: (e: FileError) => ReactNode;
}) {
  if (!state) return null;
  const amber = state.kind === "rateLimited";
  const tone = amber
    ? "bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200"
    : "bg-rose-50 text-rose-900 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-200";
  let lines: ReactNode[] = [];
  if (state.kind === "refused") {
    lines = state.fileErrors.map((e, i) => <p key={i}>{fileErrorText(e)}</p>);
  } else if (state.kind === "rateLimited") {
    lines = [<p key="r">{t("rateLimited", { minutes: state.minutes })}</p>];
  } else if (state.kind === "notAllowed") {
    lines = [<p key="n">{t("notAllowed")}</p>];
  } else if (state.kind === "serverError") {
    lines = [<p key="s">{t("serverError")}</p>];
  }
  return (
    <div role="alert" className={`rounded-lg px-4 py-2 text-sm ring-1 ring-inset ${tone}`}>
      {lines}
    </div>
  );
}

function EmptyCard({ t }: { t: T }) {
  return (
    <Card className="text-center">
      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{t("emptyTitle")}</p>
      <p className="mt-1 text-sm text-stone-600 rtl:text-base dark:text-stone-400">{t("emptyBody")}</p>
    </Card>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <Card>
        <SkeletonTableRows rows={6} cols={5} />
      </Card>
    </div>
  );
}

function DoneBox({
  state,
  t,
  onAnother,
}: {
  state: ImportState;
  t: T;
  onAnother: () => void;
}) {
  if (state?.kind === "done") {
    return (
      <div className="space-y-3 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-200">
        <p className="font-semibold">{t("done", { n: state.figures, r: state.replaced })}</p>
        <p className="text-xs rtl:text-sm">{t("doneNote")}</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/market-stats">{t("viewStats")}</ButtonLink>
          <Button type="button" variant="ghost" onClick={onAnother}>
            {t("another")}
          </Button>
        </div>
      </div>
    );
  }
  if (state?.kind === "partial") {
    return (
      <div
        role="alert"
        className="space-y-3 rounded-xl bg-amber-50 px-4 py-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200"
      >
        <p className="font-semibold">{t("donePartial", { saved: state.saved, total: state.total })}</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/market-stats" variant="secondary">
            {t("viewStats")}
          </ButtonLink>
          <Button type="button" variant="ghost" onClick={onAnother}>
            {t("another")}
          </Button>
        </div>
      </div>
    );
  }
  return null;
}

function PreviewView({
  state,
  locale,
  importing,
  showGood,
  onToggleGood,
  rowErrorText,
}: {
  state: Extract<ImportState, { kind: "preview" }>;
  locale: string;
  importing: boolean;
  showGood: boolean;
  onToggleGood: () => void;
  rowErrorText: (e: RowError) => ReactNode;
}) {
  const t = useTranslations("adminImport");
  const tc = useTranslations("csvImport");
  const ok = state.problems === 0;
  const moreProblems = state.problems - state.rowErrors.length;

  return (
    <div className={`space-y-4 ${importing ? "opacity-70" : ""}`}>
      <div
        className={`rounded-xl border-s-4 px-4 py-3 text-sm font-medium ring-1 ring-inset ${
          ok
            ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-200"
            : "border-rose-600 bg-rose-50 text-rose-900 ring-rose-600/20 dark:bg-rose-950 dark:text-rose-200"
        }`}
      >
        {ok
          ? t("summaryOk", { ready: state.figures, replace: state.replaceFigures })
          : t("summaryProblems", { count: state.problems })}
      </div>

      {state.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200">
          {state.warnings.map((w, i) => (
            <p key={i}>{ltrSentence(tc(`warnings.${w.code}`, { column: "\u0001C\u0001" }), { C: w.column }, "")}</p>
          ))}
        </div>
      )}

      {ok && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
          {t("savedAs")}
          <ProvenanceBadge provenance="OFFICIAL_STAT" />
        </p>
      )}

      {!ok && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
            {t("problemsHeading")}
          </h2>
          <ProblemTable rows={state.rowErrors} rowErrorText={rowErrorText} />
          {moreProblems > 0 && (
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {t("moreProblems", { n: moreProblems })}
            </p>
          )}
        </section>
      )}

      {state.groups.length > 0 && (
        <section>
          {!ok && (
            <button
              type="button"
              onClick={onToggleGood}
              aria-expanded={showGood}
              className="min-h-11 text-sm font-medium text-teal-800 hover:underline dark:text-teal-300"
            >
              {t("showGood")}
            </button>
          )}
          {(ok || showGood) && (
            <>
              <h2 className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                {t("previewHeading", { n: state.shownFigures })}
              </h2>
              <PreviewTable groups={state.groups} locale={locale} />
              {state.figures > state.shownFigures && (
                <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                  {t("moreFigures", { n: state.figures - state.shownFigures })}
                </p>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ProblemTable({
  rows,
  rowErrorText,
}: {
  rows: RowError[];
  rowErrorText: (e: RowError) => ReactNode;
}) {
  const t = useTranslations("adminImport");
  const found = (v: string) =>
    v === "" ? (
      <span className="text-stone-400">{t("emptyValue")}</span>
    ) : (
      <Ltr title={v}>{v.length > FOUND_MAX ? `${v.slice(0, FOUND_MAX)}…` : v}</Ltr>
    );
  return (
    <>
      {/* Phone: one card per problem, no sideways scrolling. */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((e, i) => (
          <li
            key={i}
            className="rounded-lg border-s-4 border-rose-500 bg-white p-3 text-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold tabular-nums">
                {t("col.line")} {e.line}
              </span>
              {e.column && <Ltr>{e.column}</Ltr>}
            </div>
            <div className="mt-1">{found(e.value)}</div>
            <p className="mt-1 text-rose-700 rtl:text-base dark:text-rose-300">{rowErrorText(e)}</p>
          </li>
        ))}
      </ul>
      <Card className="hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-start text-sm rtl:text-base">
          <thead className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{t("col.line")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("col.column")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("col.found")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("col.problem")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={i} className="border-t border-stone-100 align-top dark:border-stone-800">
                <td className="px-3 py-2 font-semibold tabular-nums">{e.line}</td>
                <td className="px-3 py-2">{e.column && <Ltr>{e.column}</Ltr>}</td>
                <td className="px-3 py-2">{found(e.value)}</td>
                <td className="px-3 py-2 text-rose-700 dark:text-rose-300">{rowErrorText(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function PreviewTable({ groups, locale }: { groups: PreviewGroup[]; locale: string }) {
  const t = useTranslations("adminImport");
  const ta = useTranslations("admin");
  const te = useTranslations("enums.propertyType");
  const tm = useTranslations("market");

  function figure(metric: string, value: number) {
    if (MONEY.has(metric)) return formatOMR(value, locale);
    if (metric === "grossYieldPct") return formatPercent(value, locale);
    return new Intl.NumberFormat(locale === "ar" ? "ar-OM-u-nu-latn" : "en-OM").format(value);
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[720px] text-start text-sm rtl:text-base">
        <thead className="text-xs text-stone-500 rtl:text-sm dark:text-stone-400">
          <tr>
            <th className="sticky start-0 bg-white px-3 py-2 text-start font-medium dark:bg-stone-900">
              {t("col.area")}
              <span className="sr-only"> / {t("col.level")}</span>
            </th>
            <th className="px-3 py-2 text-start font-medium">{t("col.type")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("col.month")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("col.figures")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("col.label")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("col.source")}</th>
            <th className="px-3 py-2 text-start font-medium">{t("col.status")}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={i} className="border-t border-stone-100 align-top dark:border-stone-800">
              <td className="sticky start-0 bg-white px-3 py-2 dark:bg-stone-900">
                <span className="font-semibold">{localName(locale, g.nameEn, g.nameAr)}</span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">
                  {ta(g.level)}
                </span>
              </td>
              <td className="px-3 py-2">{g.propertyType ? te(g.propertyType) : tm("allTypes")}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {formatMonth(locale, new Date(`${g.periodStart}T00:00:00.000Z`))}
              </td>
              <td className="px-3 py-2">
                <ul className="space-y-0.5">
                  {Object.entries(g.metrics).map(([m, v]) => (
                    <li key={m} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {ta(`stat.${m}`)}
                      </span>
                      <span dir="ltr" className="font-semibold tabular-nums">
                        {figure(m, v as number)}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-3 py-2">
                <ProvenanceBadge provenance="OFFICIAL_STAT" confidence={g.confidence} />
              </td>
              <td className="px-3 py-2">
                <a
                  href={g.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  title={g.sourceUrl}
                  className="inline-block max-w-40 truncate text-teal-800 hover:underline dark:text-teal-300"
                >
                  {hostOf(g.sourceUrl)}
                </a>
              </td>
              <td className="px-3 py-2">
                {g.existing ? (
                  <div className="space-y-1">
                    <span
                      title={t("replacesHint")}
                      className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950 dark:text-amber-200"
                    >
                      {t("status.replaces")}
                    </span>
                    <div>
                      {g.existing.isSample ? (
                        <ProvenanceBadge isSample />
                      ) : (
                        <ProvenanceBadge
                          provenance={g.existing.provenance as DataProvenance}
                          confidence={g.existing.confidence}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                    {t("status.new")}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
