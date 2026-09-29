import { getGetLifetimeHoursQueryKey, useGetLifetimeHours } from "@workspace/api-client-react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";

type LifetimeHoursPanelProps = {
  open: boolean;
  onClose: () => void;
  dragDistance?: number;
  currentGrade: number;
  /** Pass true for returning 11th and 12th graders who may have a previous-year record. */
  eligibleForPreviousYear?: boolean;
};

function formatHours(value: number, decimalPlaces = 0): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export default function LifetimeHoursPanel({
  open,
  onClose,
  dragDistance = 0,
  currentGrade,
  eligibleForPreviousYear = false,
}: LifetimeHoursPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);
  const [animatedHours, setAnimatedHours] = useState(0);
  onCloseRef.current = onClose;

  const { data, isLoading, isError, refetch, isFetching } = useGetLifetimeHours({
    query: {
      queryKey: getGetLifetimeHoursQueryKey(),
      enabled: open || dragDistance > 0,
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

  useEffect(() => {
    if (!open || !data) return;
    const total = data.totalHours;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimatedHours(total);
      return;
    }

    setAnimatedHours(0);
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1400);
      setAnimatedHours(total * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, data?.totalHours]);

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

  const hwCount = data?.hwCenterShifts ?? 0;
  const tutorialCount = data?.tutorialsAttended ?? 0;
  const decimalPlaces = data ? Math.min((String(data.totalHours).split(".")[1] ?? "").length, 2) : 0;
  const loading = isLoading || (!data && !isError);

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
      className={`fixed inset-0 z-50 min-h-[100dvh] overflow-y-auto overscroll-contain bg-primary text-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${dragDistance > 0 ? "!transition-none" : ""} ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      style={dragDistance > 0 ? { translate: `calc(100% - ${dragDistance}px) 0` } : undefined}
    >
      <div className="flex min-h-[100dvh] flex-col px-6 py-6 sm:px-10 sm:py-8">
        <header className="flex items-center">
            <button
              ref={backRef}
              type="button"
              onClick={onClose}
              data-testid="button-close-lifetime-hours"
              className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </button>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center pb-12 text-center">
            {loading ? (
              <div role="status" aria-label="Loading lifetime hours" className="flex flex-col items-center gap-5 motion-safe:animate-pulse">
                <div className="h-5 w-40 rounded bg-white/15" />
                <div className="h-28 w-64 rounded-xl bg-white/15" />
                <div className="h-5 w-32 rounded bg-white/15" />
              </div>
            ) : isError ? (
              <div role="alert" className="flex flex-col items-center px-4">
                <h1 className="font-display text-2xl font-semibold">Hours unavailable</h1>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/70">
                  We couldn’t load your record right now. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  data-testid="button-retry-lifetime-hours"
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/50 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {isFetching ? "Trying again…" : "Try again"}
                </button>
              </div>
            ) : data ? (
              <>
                <h1 className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 font-display text-sm font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-base">
                  <span>Lifetime hours</span>
                  <span className="text-xs font-medium normal-case tracking-normal sm:text-sm">
                    ({data.hasPreviousYear
                      ? currentGrade === 12 ? "Jnr + Snr year" : "Grade 10 + Jnr year"
                      : currentGrade === 12 ? "Snr year only" : currentGrade === 11 ? "Jnr year only" : "Current year"})
                  </span>
                </h1>
                <p
                  className="mt-4 max-w-full font-display text-[clamp(4.5rem,15vw,10rem)] font-bold leading-none tracking-tight tabular-nums"
                  aria-hidden="true"
                  data-testid="text-lifetime-total-hours"
                >
                  {formatHours(animatedHours, decimalPlaces)}
                </p>
                <p className="sr-only">{formatHours(data.totalHours, decimalPlaces)} lifetime hours recorded</p>
                <p className="mt-3 text-base font-medium text-white/75 sm:text-lg">hours recorded</p>

                <div className="mt-14 grid w-full max-w-lg grid-cols-2 divide-x divide-white/25 border-t border-white/25 pt-7 sm:mt-20">
                  <div className="min-w-0 px-2 sm:px-6">
                    <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl" data-testid="text-hw-center-shifts">
                      {formatCount(hwCount)}
                    </p>
                    <p className="mt-2 text-xs font-medium text-white/75 sm:text-sm">HW Center shifts</p>
                  </div>
                  <div className="min-w-0 px-2 sm:px-6">
                    <p className="font-display text-3xl font-semibold tabular-nums sm:text-4xl" data-testid="text-tutorials-attended">
                      {formatCount(tutorialCount)}
                    </p>
                    <p className="mt-2 text-xs font-medium text-white/75 sm:text-sm">Tutorials attended</p>
                  </div>
                </div>
                {eligibleForPreviousYear && !data.hasPreviousYear && (
                  <p className="mt-8 max-w-sm text-xs leading-relaxed text-white/70" data-testid="status-previous-year-unmatched">
                    No previous-year record found. These may not be all your lifetime hours; ask an NHS officer to check.
                  </p>
                )}
              </>
            ) : null}
        </main>
      </div>
    </section>
  );
}