import { getGetLifetimeHoursQueryKey, useGetLifetimeHours } from "@workspace/api-client-react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useRef, type TouchEvent } from "react";

type LifetimeHoursPanelProps = {
  open: boolean;
  onClose: () => void;
  dragDistance?: number;
  /** Pass dashboard.grade === 12; omitted/false never assumes prior-year eligibility. */
  eligibleForPreviousYear?: boolean;
};

const CENTER = 200;
const RADIUS = 121;
const LABEL_RADIUS = 176;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const HW_COLOR = "#ff8572";
const TUTORIAL_COLOR = "#48d5bd";

function formatHours(value: number): string {
  const decimal = String(value).split(".")[1];
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimal ? Math.min(decimal.length, 20) : 0,
    maximumFractionDigits: decimal ? Math.min(decimal.length, 20) : 0,
  }).format(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
  return value > 0 && value < 0.1 ? "<0.1%" : `${Number(value.toFixed(1))}%`;
}

function labelPosition(startShare: number, segmentShare: number) {
  const angle = -Math.PI / 2 + 2 * Math.PI * (startShare + segmentShare / 2);
  return {
    x: CENTER + LABEL_RADIUS * Math.cos(angle),
    y: CENTER + LABEL_RADIUS * Math.sin(angle),
  };
}

export default function LifetimeHoursPanel({
  open,
  onClose,
  dragDistance = 0,
  eligibleForPreviousYear = false,
}: LifetimeHoursPanelProps) {
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

  // The API has already converted tutorial hours to attendance counts.
  // These two counts describe the chart, while totalHours includes other service.
  const hwCount = data?.hwCenterShifts ?? 0;
  const tutorialCount = data?.tutorialsAttended ?? 0;
  const activityCount = hwCount + tutorialCount;
  const hwShare = activityCount > 0 ? hwCount / activityCount : 0;
  const tutorialShare = activityCount > 0 ? tutorialCount / activityCount : 0;
  const hwLabel = labelPosition(0, hwShare);
  const tutorialLabel = labelPosition(hwShare, tutorialShare);
  const totalText = data ? formatHours(data.totalHours) : "";
  const totalFontSize = totalText.length > 9 ? 30 : totalText.length > 6 ? 38 : 53;
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
      className={`fixed inset-0 z-50 min-h-[100dvh] overflow-y-auto overscroll-contain bg-[#1c2127] text-[#f4f3ee] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${dragDistance > 0 ? "!transition-none" : ""} ${
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
      style={dragDistance > 0 && !open ? { transform: `translateX(calc(100% - ${dragDistance}px))` } : undefined}
    >
      <div className="flex min-h-[100dvh] items-center justify-center p-3 sm:p-6">
        <main className="flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[740px] flex-col rounded-[24px] border border-[#31343a] bg-[#101216] px-5 pb-6 pt-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] sm:min-h-0 sm:px-10 sm:pb-9 sm:pt-7">
          <header className="flex items-center justify-between gap-4">
            <button
              ref={backRef}
              type="button"
              onClick={onClose}
              data-testid="button-close-lifetime-hours"
              className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-[#aeb5be] transition-colors hover:text-[#f4f3ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48d5bd]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </button>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#747d89]">Leigh NHS</span>
          </header>

          <div className="mt-5 text-center sm:mt-6">
            <h1 className="font-display text-[clamp(1.25rem,4vw,1.7rem)] font-semibold tracking-[-0.035em]">
              Activity mix by visits
            </h1>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center">
            {loading ? (
              <div role="status" aria-label="Loading lifetime hours" className="flex w-full flex-col items-center motion-safe:animate-pulse">
                <div className="my-6 flex aspect-square w-[min(100%,45dvh,390px)] items-center justify-center rounded-full border-[clamp(40px,8vw,62px)] border-[#24292e]">
                  <div className="h-11 w-24 rounded-md bg-[#24292e]" />
                </div>
                <div className="h-4 w-48 rounded bg-[#24292e]" />
              </div>
            ) : isError ? (
              <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center px-4 text-center">
                <div className="mb-6 h-28 w-28 rounded-full border-[18px] border-[#272c31]" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold">Hours unavailable</h2>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#a3abb5]">
                  We couldn’t load your record right now. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  data-testid="button-retry-lifetime-hours"
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#505861] px-5 text-sm font-semibold text-[#f4f3ee] transition-colors hover:border-[#48d5bd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#48d5bd] disabled:cursor-wait disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {isFetching ? "Trying again…" : "Try again"}
                </button>
              </div>
            ) : data ? (
              <>
                <div className="relative my-3 aspect-square w-[min(100%,49dvh,440px)] shrink-0 sm:my-4 sm:w-[min(100%,440px)]">
                  <svg
                    viewBox="0 0 400 400"
                    className="h-full w-full overflow-visible"
                    role="img"
                    aria-label={`${formatHours(data.totalHours)} recorded lifetime hours. Activity mix: ${formatCount(hwCount)} HW Center shifts, ${formatCount(tutorialCount)} tutorials attended.${activityCount ? ` ${formatPercent(hwShare * 100)} shifts and ${formatPercent(tutorialShare * 100)} tutorials.` : " No counted activities yet."}`}
                    data-testid="chart-lifetime-activities"
                  >
                    <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#292d31" strokeWidth="62" />
                    {hwCount > 0 && (
                      <circle
                        cx={CENTER} cy={CENTER} r={RADIUS} fill="none"
                        stroke={HW_COLOR} strokeWidth="62"
                        strokeDasharray={`${hwShare * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                        transform={`rotate(-90 ${CENTER} ${CENTER})`}
                      />
                    )}
                    {tutorialCount > 0 && (
                      <circle
                        cx={CENTER} cy={CENTER} r={RADIUS} fill="none"
                        stroke={TUTORIAL_COLOR} strokeWidth="62"
                        strokeDasharray={`${tutorialShare * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                        transform={`rotate(${-90 + hwShare * 360} ${CENTER} ${CENTER})`}
                      />
                    )}
                    {hwCount > 0 && (
                      <text x={hwLabel.x} y={hwLabel.y} textAnchor="middle" dominantBaseline="middle" fill={HW_COLOR} fontSize="15" fontWeight="700" fontFamily="DM Sans, sans-serif">
                        {formatPercent(hwShare * 100)}
                      </text>
                    )}
                    {tutorialCount > 0 && (
                      <text x={tutorialLabel.x} y={tutorialLabel.y} textAnchor="middle" dominantBaseline="middle" fill={TUTORIAL_COLOR} fontSize="15" fontWeight="700" fontFamily="DM Sans, sans-serif">
                        {formatPercent(tutorialShare * 100)}
                      </text>
                    )}
                    <text x={CENTER} y="171" textAnchor="middle" fill="#9099a2" fontSize="10" fontWeight="700" letterSpacing="2" fontFamily="DM Sans, sans-serif">
                      LIFETIME HOURS
                    </text>
                    <text x={CENTER} y="219" textAnchor="middle" dominantBaseline="middle" fill="#f4f3ee" fontSize={totalFontSize} fontWeight="700" letterSpacing="-2" fontFamily="Poppins, sans-serif" data-testid="text-lifetime-total-hours">
                      {totalText}
                    </text>
                    <text x={CENTER} y="254" textAnchor="middle" fill="#9099a2" fontSize="12" fontFamily="DM Sans, sans-serif">
                      hours recorded
                    </text>
                  </svg>
                </div>

                {activityCount === 0 && (
                  <p className="-mt-1 mb-3 text-center text-xs text-[#a3abb5]" data-testid="status-no-counted-activities">
                    No HW Center shifts or tutorials recorded yet.
                  </p>
                )}

                <div className="grid w-full max-w-[540px] grid-cols-2 gap-2 border-t border-[#2a2e34] pt-5 sm:gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#d8dce0] sm:text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: HW_COLOR }} aria-hidden="true" />
                      <span>HW Center shifts</span>
                    </div>
                    <p className="mt-1 pl-[18px] text-lg font-semibold tabular-nums text-[#f4f3ee] sm:text-xl" data-testid="text-hw-center-shifts">
                      {formatCount(hwCount)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#d8dce0] sm:text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TUTORIAL_COLOR }} aria-hidden="true" />
                      <span>Tutorials attended</span>
                    </div>
                    <p className="mt-1 pl-[18px] text-lg font-semibold tabular-nums text-[#f4f3ee] sm:text-xl" data-testid="text-tutorials-attended">
                      {formatCount(tutorialCount)}
                    </p>
                  </div>
                </div>
                {eligibleForPreviousYear && !data.hasPreviousYear && (
                  <p className="mt-2 max-w-[540px] text-center text-[11px] leading-relaxed text-[#c6aa8c]" data-testid="status-previous-year-unmatched">
                    No previous-year record found. These may not be all your lifetime hours; ask an NHS officer to check.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </main>
      </div>
    </section>
  );
}