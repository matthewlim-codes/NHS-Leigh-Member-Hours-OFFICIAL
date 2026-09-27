import { useGetLifetimeHours, getGetLifetimeHoursQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, ArrowUpRight, Clock3, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";

type LifetimeHoursPanelProps = {
  open: boolean;
  onClose: () => void;
  dragDistance?: number;
  /** Pass dashboard.grade === 12; omitted/false never assumes prior-year eligibility. */
  eligibleForPreviousYear?: boolean;
};

function decimalPlaces(value: number): number {
  const decimal = String(value).split(".")[1];
  return decimal ? Math.min(decimal.length, 20) : 0;
}

function formatHours(value: number, digits = decimalPlaces(value)): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

const REEL_DIGITS = Array.from({ length: 30 }, (_, index) => index % 10);

function RollingHours({ value, open }: { value: number; open: boolean }) {
  const [rolling, setRolling] = useState(false);
  const [motionReduced, setMotionReduced] = useState(false);
  const formatted = formatHours(value);
  const digitCount = [...formatted].filter((character) => /\d/.test(character)).length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) {
      setRolling(false);
      return;
    }
    setRolling(false);
    // Give the zero position a paint before starting each reel's transition.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setRolling(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [formatted, open]);

  let digitIndex = 0;
  return (
    <div aria-hidden="true" className="max-w-full min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span
        className="inline-flex min-w-max items-baseline whitespace-nowrap font-display font-bold leading-none tracking-[-0.07em] tabular-nums text-[#f8fbff]"
        style={{ fontSize: `clamp(2.75rem, ${Math.min(20, 72 / Math.max(formatted.length, 4))}vw, 11rem)` }}
      >
        {[...formatted].map((character, index) => {
          if (!/\d/.test(character)) return <span key={`separator-${index}`} className="self-end">{character}</span>;
          const position = digitIndex++;
          const finalDigit = Number(character);
          return (
            <span key={`digit-${index}`} className="relative inline-block h-[1em] w-[0.62em] shrink-0 overflow-hidden align-bottom leading-none">
              <span
                className="absolute left-0 top-0 flex w-full flex-col leading-none"
                style={{
                  transform: `translate3d(0, -${motionReduced || rolling ? 20 + finalDigit : 0}em, 0)`,
                  transition: motionReduced || !rolling
                    ? "none"
                    : `transform ${1050 + position * 65}ms cubic-bezier(0.18, 0.72, 0.17, 1) ${Math.max(0, digitCount - position - 1) * 65}ms`,
                }}
              >
                {REEL_DIGITS.map((digit, reelIndex) => (
                  <span key={reelIndex} className="block h-[1em] leading-[1em]">{digit}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </div>
  );
}

export default function LifetimeHoursPanel({ open, onClose, dragDistance = 0, eligibleForPreviousYear = false }: LifetimeHoursPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { data, isLoading, isError, refetch, isFetching } = useGetLifetimeHours({
    query: {
      queryKey: getGetLifetimeHoursQueryKey(),
      enabled: open,
      retry: false,
      refetchOnMount: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => backRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    if (touch) {
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      if (dx > 85 && Math.abs(dx) > Math.abs(dy) * 1.4) onCloseRef.current();
    }
    touchStart.current = null;
  };

  const total = data?.totalHours ?? 0;
  const current = data?.currentYearHours ?? 0;
  const previous = data?.previousYearHours ?? 0;
  const showPreviousYear = Boolean(data?.hasPreviousYear || eligibleForPreviousYear);
  const currentShare = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
  const previousShare = data?.hasPreviousYear && total > 0 ? Math.max(0, Math.min(100, (previous / total) * 100)) : 0;

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-modal={open ? "true" : undefined}
      aria-label="Lifetime service hours"
      aria-hidden={!open}
      inert={!open}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`fixed inset-0 z-50 min-h-[100dvh] overflow-y-auto overscroll-contain bg-[#faf9f6] text-[#172544] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${dragDistance > 0 ? "!transition-none" : ""} ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      style={dragDistance > 0 && !open ? { transform: `translateX(calc(100% - ${dragDistance}px))` } : undefined}
    >
      <div className="min-h-[100dvh]">
        <header className="relative z-10 border-b border-[#e7e9ef] bg-[#faf9f6]">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 md:px-8">
            <button
              ref={backRef}
              type="button"
              onClick={onClose}
              data-testid="button-close-lifetime-hours"
              className="group -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#082267] outline-none transition-colors hover:bg-[#e9edf7] focus-visible:ring-2 focus-visible:ring-[#4299f7] focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-[18px] w-[18px] transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              <span>Dashboard</span>
            </button>
            <span className="font-display text-sm font-bold tracking-tight text-[#082267] md:text-base">Leigh NHS</span>
          </div>
        </header>

        <main>
          <div className="relative isolate overflow-hidden bg-[#082267] text-[#f8fbff]">
            <div aria-hidden="true" className="pointer-events-none absolute -right-44 -top-44 h-[530px] w-[530px] rounded-full border border-white/[0.09] md:right-[max(-5rem,calc(50%-35rem))] md:-top-64 md:h-[800px] md:w-[800px]">
              <div className="absolute inset-[12%] rounded-full border border-white/[0.09]" />
              <div className="absolute inset-[25%] rounded-full border border-white/[0.08]" />
              <div className="absolute inset-[39%] rounded-full border border-white/[0.08]" />
            </div>
            <div className="relative mx-auto w-full max-w-5xl px-6 pb-14 pt-12 md:px-8 md:pb-20 md:pt-20">
              <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.19em] text-[#9bc6fa]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#77b9fb]" />
                Your service, over time
              </div>
              <h1 className="mt-5 max-w-xl font-display text-[clamp(2.3rem,7vw,4.75rem)] font-bold leading-[1.06] tracking-[-0.045em]">
                Every hour<br />adds up.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#c5d5f1] md:text-base">
                A look at the time you’ve given to your community across school years.
              </p>

              <div className="mt-12 border-t border-white/20 pt-7 md:mt-16 md:pt-9">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a9c9f4]">
                  <Clock3 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                  {eligibleForPreviousYear && data && !data.hasPreviousYear ? "Recorded hours" : "Lifetime hours"}
                </div>

                {isLoading || (!data && !isError) ? (
                  <div aria-label="Loading lifetime hours" role="status" className="mt-4 animate-pulse">
                    <div className="h-24 w-48 rounded-xl bg-white/15 md:h-32 md:w-72" />
                    <div className="mt-4 h-4 w-52 rounded bg-white/10" />
                  </div>
                ) : isError ? (
                  <div role="alert" className="mt-6 max-w-md rounded-2xl border border-white/20 bg-white/[0.08] p-5">
                    <p className="font-display text-lg font-semibold">We couldn’t load your hours.</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#c5d5f1]">Your record is safe. Please try again in a moment.</p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      disabled={isFetching}
                      data-testid="button-retry-lifetime-hours"
                      className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#f8fbff] px-4 text-sm font-bold text-[#082267] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      {isFetching ? "Trying again…" : "Try again"}
                    </button>
                  </div>
                ) : data ? (
                  <div className="mt-2">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <RollingHours value={total} open={open} />
                      <span aria-hidden="true" className="shrink-0 font-display text-lg font-medium text-[#9bc6fa] md:text-2xl">hrs</span>
                    </div>
                    <span className="sr-only" aria-live="polite" data-testid="text-lifetime-total-hours">
                      {formatHours(total)} total service hours
                    </span>
                    <p className="mt-3 flex items-center gap-2 text-sm text-[#c5d5f1]">
                      <ArrowUpRight className="h-4 w-4 text-[#9bc6fa]" aria-hidden="true" />
                      {data.hasPreviousYear
                        ? "Across 2025–26 and 2026–27"
                        : eligibleForPreviousYear
                          ? "Current-year hours only — no previous-year record found"
                          : "For the 2026–27 school year"}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-10 md:px-8 md:pb-24 md:pt-14">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4977b1]">The breakdown</p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.035em] text-[#14274b] md:text-3xl">Your hours by year</h2>
              </div>
              <span className="text-xs text-[#65738b]">School years</span>
            </div>

            {isLoading || (!data && !isError) ? (
              <div role="status" aria-label="Loading school year breakdown" className="space-y-3 animate-pulse">
                <div className="h-28 rounded-2xl bg-[#e7eaf1]" />
                <div className="h-28 rounded-2xl bg-[#e7eaf1]" />
              </div>
            ) : isError ? (
              <div className="rounded-2xl border border-[#dbe1eb] bg-[#f2f4f8] p-6 text-sm text-[#53647e]">
                The year-by-year view will appear once your hours load.
              </div>
            ) : data ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-[#dce3ee] bg-[#fffefa] shadow-[0_12px_32px_-25px_rgba(8,34,103,0.45)]">
                  <div className={`grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-6 md:px-8 md:py-7 ${showPreviousYear ? "border-b border-[#e6eaf1]" : ""}`}>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-[#2875d4]" aria-hidden="true" />
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#4879b5]">Current year</span>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-bold text-[#14274b] md:text-2xl">2026–27</h3>
                      <p className="mt-0.5 text-xs text-[#687791]">Still in progress</p>
                    </div>
                    <p className="whitespace-nowrap font-display text-3xl font-bold tracking-[-0.045em] text-[#082267] md:text-4xl" data-testid="text-current-year-hours">
                      {formatHours(current)}<span className="ml-1 text-sm font-medium tracking-normal text-[#687791]">hrs</span>
                    </p>
                  </div>
                  {showPreviousYear && <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-6 md:px-8 md:py-7">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full bg-[#8ab3e5]" aria-hidden="true" />
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#7185a4]">Previous year</span>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-bold text-[#14274b] md:text-2xl">2025–26</h3>
                      <p className="mt-0.5 max-w-[210px] text-xs leading-relaxed text-[#687791]">
                        {data.hasPreviousYear ? "Carried forward into your total" : "No previous-year hours on record"}
                      </p>
                    </div>
                    <p className="whitespace-nowrap font-display text-3xl font-bold tracking-[-0.045em] text-[#45648f] md:text-4xl" data-testid="text-previous-year-hours">
                      {data.hasPreviousYear ? formatHours(previous) : "—"}
                      {data.hasPreviousYear && <span className="ml-1 text-sm font-medium tracking-normal text-[#687791]">hrs</span>}
                    </p>
                  </div>}
                </div>

                <div className="mt-7 border-t border-[#dce3ee] pt-6">
                  <div className="flex items-center justify-between gap-4 text-xs font-semibold text-[#526480]">
                    <span>How your total comes together</span>
                    <span className="tabular-nums" data-testid="text-lifetime-summary-hours">{formatHours(total)} hrs total</span>
                  </div>
                  <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[#e7eaf1]" role="img" aria-label={`${formatHours(current)} hours in 2026–27${data.hasPreviousYear ? ` and ${formatHours(previous)} hours in 2025–26` : ""}`}>
                    <div className="h-full bg-[#2875d4]" style={{ width: `${currentShare}%` }} />
                    <div className="h-full bg-[#8ab3e5]" style={{ width: `${previousShare}%` }} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#65738b]">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#2875d4]" />2026–27</span>
                    {data.hasPreviousYear && <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#8ab3e5]" />2025–26</span>}
                  </div>
                  {total === 0 && <p className="mt-4 text-sm text-[#65738b]">Recorded hours will appear here as they’re added.</p>}
                  {eligibleForPreviousYear && !data.hasPreviousYear && (
                    <p className="mt-6 rounded-xl bg-[#ecf2f9] px-4 py-3 text-xs leading-relaxed text-[#466386]" data-testid="status-previous-year-unmatched">
                      Have hours from 2025–26 that aren’t showing? Ask an NHS officer to check your previous-year record.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </section>
  );
}