import { useGetMe, getGetMeQueryKey, useGetDashboard, getGetDashboardQueryKey, useLogout } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardList, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

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
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState("October");

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

  useEffect(() => {
    if (!dashboard) return;

    setSelectedMonth((currentMonth) => {
      if (dashboard.monthlyHours?.some((month) => month.month === currentMonth)) {
        return currentMonth;
      }

      return dashboard.monthlyHours?.find((month) => month.hasData)?.month ?? "October";
    });
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
    <div className="min-h-[100dvh] flex flex-col overflow-x-clip bg-background">
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

      <main className="flex-1 w-full">
        {isDashboardError ? (
          <Alert variant="destructive" className="max-w-md w-full mx-auto my-6" data-testid="alert-dashboard-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Member not found</AlertTitle>
            <AlertDescription>
              {getApiErrorMessage(dashboardError, "We couldn't find your hours record in the system. Please ask the coordinator to check your details.")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="sticky top-16 z-0 bg-background">
              <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:py-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground" data-testid="text-welcome-greeting">
                  Member Dashboard
                </p>
                <h2 className="mt-1 text-4xl md:text-5xl font-display font-bold text-foreground" data-testid="text-display-name">
                  Hello, {dashboard?.displayName?.split(" ")[0] || user.username}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {dashboard ? `Grade ${dashboard.grade}` : "Loading member data"}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">
                  <CalendarClock className="h-4 w-4" />
                  Hours last updated on:{" "}
                  {sheetStatus?.updatedAt ? formatUpdatedAt(sheetStatus.updatedAt) : "Not yet recorded"}
                </p>
              </div>
            </div>

            {dashboard && (
              <>
                <Card className="shadow-lg border-0 bg-card overflow-hidden">
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Hour Goal</p>
                        <p className="text-sm text-muted-foreground">
                          Annual progress toward your requirement
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatHours(dashboard.totalHours)} of {formatHours(dashboard.annualGoal)}
                      </p>
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
              <section className="monthly-activity-section relative z-[1] min-h-[calc(100dvh-4rem)] bg-primary pb-12 pt-16 text-white md:pt-24">
                <div className="mx-auto max-w-5xl space-y-5 px-4">
                <Card className="border-0 shadow-none bg-transparent text-white">
                  <CardHeader className="pb-3 text-center">
                    <CardTitle className="whitespace-nowrap font-display text-[clamp(1.5rem,7.2vw,3rem)] font-bold leading-tight text-white md:text-5xl">Monthly Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {dashboard.monthlyHours?.length > 0 && (
                      <div className="relative pt-[72px]">
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
                      <div className="rounded-2xl bg-white/10 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-2xl font-display font-bold text-white">
                              {selectedMonthData.month}
                            </h3>
                          </div>
                          <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-primary">
                            {formatHours(selectedMonthData.total)} total
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <MonthDetail label="HW Center" value={selectedMonthData.hwCenter} />
                          <MonthDetail label="Tutorial" value={selectedMonthData.tutorial} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="mx-auto max-w-2xl border-0 bg-white/10 text-white shadow-none">
                  <CardContent className="grid grid-cols-2 divide-x divide-white/20 p-3 sm:p-4">
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

                <div className="w-full p-5 text-center text-white/75">
                  <p className="text-sm font-medium" data-testid="text-help-footer">
                    Contact NHS officers for questions about your hours
                  </p>
                </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
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
    <div className="flex min-w-0 flex-col items-start gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div className="rounded-full bg-white/15 p-2 text-white">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-white/75">{label}</p>
        <p className="font-semibold text-white flex items-center gap-1.5">
          {complete ? <CheckCircle2 className="w-4 h-4 text-white" /> : <XCircle className="w-4 h-4 text-white" />}
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
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-white/75">{label}</p>
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
