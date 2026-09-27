import { useGetMe, getGetMeQueryKey, useGetDashboard, getGetDashboardQueryKey, useLogout } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode, type TouchEvent } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle, CalendarClock, CheckCircle2, ChevronLeft, CircleDollarSign, ClipboardList, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import LifetimeHoursPanel from "@/components/lifetime-hours-panel";

interface SheetStatus {
  updatedAt: string | null;
}

async function getSheetStatus(): Promise<SheetStatus> {
  const response = await fetch("/api/dashboard/sheet-status", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not load the sheet update time");
  }

  return response.json() as Promise<SheetStatus>;
}

export default function DashboardPage() {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isLifetimeOpen = location === "/lifetime";
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const arrowDrag = useRef<{ pointerId: number; x: number; y: number; distance: number; active: boolean } | null>(null);
  const suppressArrowClick = useRef(false);
  const [dragDistance, setDragDistance] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState("October");
  const [freezeTop, setFreezeTop] = useState(64);
  const whiteSectionRef = useRef<HTMLDivElement>(null);
  const blueSectionRef = useRef<HTMLElement>(null);
  const sliderRegionRef = useRef<HTMLDivElement>(null);

  const { data: user, isError: isAuthError, isSuccess: isAuthSuccess, isLoading: isAuthLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (isAuthError) {
      setLocation("/login");
    }
  }, [isAuthError, setLocation]);

  const { data: dashboard, isError: isDashboardError, isLoading: isDashboardLoading, error: dashboardError } = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey(),
      enabled: isAuthSuccess && Boolean(user),
      retry: false
    }
  });

  const { data: sheetStatus } = useQuery({
    queryKey: ["sheet-status"],
    queryFn: getSheetStatus,
    enabled: isAuthSuccess && Boolean(user) && user?.role !== "admin",
    refetchInterval: 60_000,
  });

  const logoutMutation = useLogout();

  const handleLogout = () => {
    trackEvent("sign_out", { role: "member" });
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const handleDashboardTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (isLifetimeOpen || (event.target instanceof Element && event.target.closest("input, button, a, select, textarea"))) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const handleDashboardTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || isLifetimeOpen) return;
    const deltaX = event.changedTouches[0].clientX - start.x;
    const deltaY = event.changedTouches[0].clientY - start.y;
    if (deltaX < -70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      setLocation("/lifetime");
    }
  };

  const handleArrowPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isLifetimeOpen) return;
    arrowDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, distance: 0, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleArrowPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = arrowDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = drag.x - event.clientX;
    const dy = drag.y - event.clientY;
    if (!drag.active && (dx < 6 || dx < Math.abs(dy) * 1.2)) return;
    drag.active = true;
    drag.distance = Math.max(0, Math.min(window.innerWidth, dx));
    setDragDistance(drag.distance);
  };

  const finishArrowDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = arrowDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    arrowDrag.current = null;
    if (!drag.active) {
      setDragDistance(0);
      return;
    }
    // A release after dragging can also fire a click; don't let a short drag open the page.
    suppressArrowClick.current = true;
    window.setTimeout(() => { suppressArrowClick.current = false; }, 350);
    if (!cancelled && drag.distance >= 72) {
      // Keep the page at the dragged position until the route opens, then animate the rest of the way.
      setLocation("/lifetime");
      requestAnimationFrame(() => setDragDistance(0));
    } else {
      setDragDistance(0);
    }
  };

  useEffect(() => {
    if (!dashboard) return;

    setSelectedMonth((currentMonth) => {
      if (dashboard.monthlyHours?.some((month) => month.month === currentMonth)) {
        return currentMonth;
      }

      return dashboard.monthlyHours?.find((month) => month.hasData)?.month ?? "October";
    });
  }, [dashboard]);

  useLayoutEffect(() => {
    const whiteSection = whiteSectionRef.current;
    const blueSection = blueSectionRef.current;
    const sliderRegion = sliderRegionRef.current;
    if (!whiteSection || !blueSection || !sliderRegion) return;

    const updateFreezePoint = () => {
      const sliderBottomWithinBlue =
        sliderRegion.getBoundingClientRect().bottom - blueSection.getBoundingClientRect().top;
      // Pin the white section only after the whole heading and slider reach the viewport.
      setFreezeTop(Math.min(64, window.innerHeight - whiteSection.getBoundingClientRect().height - sliderBottomWithinBlue));
    };

    updateFreezePoint();
    const observer = new ResizeObserver(updateFreezePoint);
    observer.observe(whiteSection);
    observer.observe(blueSection);
    observer.observe(sliderRegion);
    window.addEventListener("resize", updateFreezePoint);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFreezePoint);
    };
  }, [dashboard]);

  const selectedMonthData = useMemo(() => {
    return dashboard?.monthlyHours?.find((month) => month.month === selectedMonth) ?? dashboard?.monthlyHours?.[0];
  }, [dashboard, selectedMonth]);
  const selectedMonthIndex = dashboard?.monthlyHours?.findIndex((month) => month.month === selectedMonth) ?? -1;
  const monthProgress = dashboard?.monthlyHours?.length
    ? (Math.max(0, selectedMonthIndex) / Math.max(1, dashboard.monthlyHours.length - 1)) * 100
    : 0;
  const sliderPosition = `calc(${monthProgress}% + ${17.6 - (35.2 * monthProgress) / 100}px)`;

  const annualProgress = dashboard ? getProgressPercent(dashboard.totalHours, dashboard.annualGoal) : 0;
  const isGrade10 = dashboard?.grade === 10;

  if (isAuthLoading || (isAuthSuccess && isDashboardLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading your dashboard...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
    <div
      className="min-h-[100dvh] flex flex-col overflow-x-clip bg-background"
      onTouchStart={handleDashboardTouchStart}
      onTouchEnd={handleDashboardTouchEnd}
      inert={isLifetimeOpen}
      aria-hidden={isLifetimeOpen}
    >
      <header className="bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg text-foreground">
            Leigh NHS
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col">
        {isDashboardError ? (
          <Alert variant="destructive" className="max-w-md w-full mx-auto my-6" data-testid="alert-dashboard-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Member not found</AlertTitle>
            <AlertDescription>
              {getApiErrorMessage(dashboardError, "We couldn't find your hours record in the system. Please ask the coordinator to check your details.")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex w-full flex-1 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div ref={whiteSectionRef} className="sticky z-0 bg-background" style={{ top: freezeTop }}>
              <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:py-10">
            <div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm uppercase tracking-normal text-muted-foreground" data-testid="text-welcome-greeting">
                  Member Dashboard
                </p>
                {dashboard && <p className="shrink-0 text-sm text-muted-foreground">Grade {dashboard.grade}</p>}
              </div>
              <h2 className="mt-1 text-4xl md:text-5xl font-display font-bold text-foreground" data-testid="text-display-name">
                Hey, {dashboard?.displayName?.split(" ")[0] || user.username}
              </h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
                <CalendarClock className="h-4 w-4" />
                Hours last updated on:{" "}
                {sheetStatus?.updatedAt ? formatUpdatedAt(sheetStatus.updatedAt) : "Not yet recorded"}
              </p>
            </div>

            {dashboard && (
              <>
                <Card className="shadow-lg border-0 bg-card overflow-hidden">
                  <CardContent className="p-6 md:p-8">
                    <div className="mb-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Annual Hour Goal</p>
                      </div>
                    </div>

                    <div className="h-4 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${annualProgress}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8">
                      <BigMetric label="Hours" value={dashboard.totalHours} />
                      <BigMetric label="Remaining" value={dashboard.annualRemaining} />
                    </div>
                  </CardContent>
                </Card>

                {!isGrade10 && (
                  <section className={cn("grid gap-3", dashboard.grade === 12 && "md:grid-cols-2")}>
                    {dashboard.grade === 12 && (
                      <ProgressCard
                        label="Semester 1"
                        hours={dashboard.semester1Hours}
                        goal={dashboard.semester1Goal}
                        remaining={dashboard.semester1Remaining}
                        note="Oct–Dec: 1 HW Center hour and 1 Tutorial hour each month, plus 2 hours from any activity."
                      />
                    )}
                    <ProgressCard
                      label="Semester 2"
                      hours={dashboard.semester2Hours}
                      goal={dashboard.semester2Goal}
                      remaining={dashboard.semester2Remaining}
                      note={dashboard.grade === 11 ? "Junior requirement covers January–May only." : undefined}
                    />
                  </section>
                )}
              </>
            )}
              </div>
            </div>

            {dashboard && (
              <section ref={blueSectionRef} className="monthly-activity-section relative z-[1] flex-1 bg-primary pb-4 pt-16 text-white md:pt-24">
                <div className="mx-auto w-full max-w-5xl px-4">
                <Card className="border-0 shadow-none bg-transparent text-white">
                  <CardHeader className="pb-3 text-center">
                    <CardTitle className="whitespace-nowrap font-display text-[clamp(1.5rem,7.2vw,3rem)] font-bold leading-tight text-white md:text-5xl">Monthly Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {dashboard.monthlyHours?.length > 0 && (
                      <div ref={sliderRegionRef} className="relative pt-[72px]">
                        <label htmlFor="month-slider" className="sr-only">Select activity month</label>
                        <div
                          aria-hidden="true"
                          className="absolute top-0 z-10 flex h-11 min-w-16 -translate-x-1/2 items-center justify-center rounded-xl bg-[#061747] px-3 text-base font-bold text-white after:absolute after:-bottom-2 after:left-1/2 after:h-4 after:w-4 after:-translate-x-1/2 after:rotate-45 after:rounded-sm after:bg-[#061747]"
                          style={{ left: sliderPosition }}
                        >
                          <span className="relative z-10">{selectedMonthData?.shortLabel}</span>
                        </div>
                        <input
                          id="month-slider"
                          className="month-slider"
                          type="range"
                          min={0}
                          max={dashboard.monthlyHours.length - 1}
                          step={1}
                          value={Math.max(0, selectedMonthIndex)}
                          style={{
                            background: `linear-gradient(to right, #4299f7 ${sliderPosition}, #e9e9ed ${sliderPosition})`,
                          }}
                          aria-valuetext={selectedMonthData?.month}
                          onChange={(event) => {
                            const month = dashboard.monthlyHours[Number(event.currentTarget.value)];
                            if (month && month.month !== selectedMonth) {
                              setSelectedMonth(month.month);
                              trackEvent("month_selected", { month: month.month });
                            }
                          }}
                        />
                        <div className="mt-5 flex justify-between text-xs font-medium text-white/70">
                          <span>{dashboard.monthlyHours[0].shortLabel}</span>
                          <span>{dashboard.monthlyHours[dashboard.monthlyHours.length - 1].shortLabel}</span>
                        </div>
                      </div>
                    )}

                    {selectedMonthData && (
                      <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <MonthDetail label="HW Center" value={selectedMonthData.hwCenter} />
                        <MonthDetail label="Tutorial" value={selectedMonthData.tutorial} />
                        <MonthDetail label="Total" value={formatHours(selectedMonthData.total)} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="mt-6">
                  <Card className="mx-auto max-w-2xl border-0 bg-white/10 text-white shadow-none">
                    <CardContent className="grid grid-cols-2 divide-x divide-white/20 p-2 sm:p-4">
                      <StatusCard
                        icon={<ClipboardList className="w-5 h-5" />}
                        label="Info Form"
                        complete={dashboard.infoFormComplete}
                        completeText="Complete"
                        incompleteText="Missing"
                      />
                      <StatusCard
                        icon={<CircleDollarSign className="w-5 h-5" />}
                        label="Club Dues"
                        complete={dashboard.clubDuesPaid}
                        completeText="Paid"
                        incompleteText="Unpaid"
                      />
                    </CardContent>
                  </Card>

                  <div className="w-full pt-4 text-center text-white/75">
                    <p className="text-sm font-medium" data-testid="text-help-footer">
                      Contact NHS officers for questions about your hours
                    </p>
                  </div>
                </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
    {dashboard && (
      <>
        <button
          type="button"
          onClick={() => {
            if (suppressArrowClick.current) {
              suppressArrowClick.current = false;
              return;
            }
            setLocation("/lifetime");
          }}
          onPointerDown={handleArrowPointerDown}
          onPointerMove={handleArrowPointerMove}
          onPointerUp={finishArrowDrag}
          onPointerCancel={(event) => finishArrowDrag(event, true)}
          onLostPointerCapture={(event) => finishArrowDrag(event, true)}
          className={`fixed right-0 top-1/2 ${dragDistance > 0 ? "z-[60]" : "z-20"} -translate-y-1/2 rounded-l-full bg-primary px-2 py-5 text-white shadow-lg transition-[padding,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none hover:pl-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isLifetimeOpen ? "pointer-events-none opacity-0" : ""}`}
          style={{
            touchAction: "pan-y",
            transform: dragDistance > 0 ? `translate3d(-${dragDistance}px, -50%, 0)` : undefined,
            transition: dragDistance > 0 ? "none" : undefined,
          }}
          aria-label="View lifetime hours"
          aria-hidden={isLifetimeOpen}
          tabIndex={isLifetimeOpen ? -1 : 0}
          title="View lifetime hours"
          data-testid="button-lifetime-hours"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <LifetimeHoursPanel
          open={isLifetimeOpen}
          onClose={() => setLocation("/dashboard")}
          eligibleForPreviousYear={dashboard.grade === 12}
          dragDistance={dragDistance}
        />
      </>
    )}
    </>
  );
}

function BigMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-display text-6xl md:text-7xl font-bold leading-none text-foreground">
        {formatHours(value)}
      </div>
      <div className="mt-1 text-lg md:text-xl font-display font-bold uppercase text-foreground">
        {label}
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  complete,
  completeText,
  incompleteText,
}: {
  icon: ReactNode;
  label: string;
  complete: boolean;
  completeText: string;
  incompleteText: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4">
      <div className="shrink-0 rounded-full bg-white/15 p-1.5 text-white sm:p-2">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-sm text-white/75">{label}</p>
        <p className="flex items-center gap-1 text-xs font-semibold text-white sm:text-base">
          {complete ? <CheckCircle2 className="h-3 w-3 shrink-0 text-white sm:h-4 sm:w-4" /> : <XCircle className="h-3 w-3 shrink-0 text-white sm:h-4 sm:w-4" />}
          {complete ? completeText : incompleteText}
        </p>
      </div>
    </div>
  );
}

function ProgressCard({
  label,
  hours,
  goal,
  remaining,
  note,
}: {
  label: string;
  hours: number;
  goal: number;
  remaining: number;
  note?: string;
}) {
  const progress = getProgressPercent(hours, goal);

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-display font-bold text-foreground">
            {formatHours(hours)} / {formatHours(goal)}
          </p>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden mt-3">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {remaining === 0 ? "Requirement met" : `${formatHours(remaining)} hours remaining`}
        </p>
        {note && (
          <p className="mt-3 pt-2 text-xs leading-relaxed text-muted-foreground">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MonthDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 p-2 text-center">
      <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-white/75 sm:text-xs sm:tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-xl font-display font-bold text-white">{value}</p>
    </div>
  );
}

function getProgressPercent(hours: number, goal: number): number {
  if (goal <= 0) return 100;
  return Math.min(100, Math.max(0, (hours / goal) * 100));
}

function formatHours(hours: number | undefined | null): string {
  if (hours == null || !Number.isFinite(hours)) return "0";
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: { error?: string } }).data;
    if (typeof data?.error === "string") return data.error;
  }

  return fallback;
}
