import { useGetMe, getGetMeQueryKey, useGetDashboard, getGetDashboardQueryKey, useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle, CheckCircle2, CircleDollarSign, ClipboardList, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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

  const logoutMutation = useLogout();

  const handleLogout = () => {
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
      if (dashboard.monthlyHours.some((month) => month.month === currentMonth)) {
        return currentMonth;
      }

      return dashboard.monthlyHours.find((month) => month.hasData)?.month ?? "October";
    });
  }, [dashboard]);

  const selectedMonthData = useMemo(() => {
    return dashboard?.monthlyHours.find((month) => month.month === selectedMonth) ?? dashboard?.monthlyHours[0];
  }, [dashboard, selectedMonth]);

  const annualProgress = dashboard ? getProgressPercent(dashboard.totalHours, dashboard.annualGoal) : 0;
  const isGrade10 = dashboard?.grade === 10;

  if (isAuthLoading || (isAuthSuccess && isDashboardLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading your dashboard...</div>
      </div>
    );
  }

  // Prevent flash of content while redirecting
  if (!user) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-bold text-lg text-foreground flex items-center gap-2">
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

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 py-6 md:py-10">
        {isDashboardError ? (
          <Alert variant="destructive" className="max-w-md w-full" data-testid="alert-dashboard-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Member not found</AlertTitle>
            <AlertDescription>
              {getApiErrorMessage(dashboardError, "We couldn't find your hours record in the system. Please ask the coordinator to check your details.")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
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
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                {dashboard ? `${formatHours(dashboard.totalHours)} of ${formatHours(dashboard.annualGoal)} hours completed` : "Loading"}
              </div>
            </div>

            {dashboard && (
              <>
                <Card className="shadow-lg border-primary/20 bg-card overflow-hidden">
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
                  <section className="grid gap-3 md:grid-cols-2">
                    <ProgressCard
                      label="Semester 1"
                      hours={dashboard.semester1Hours}
                      goal={dashboard.semester1Goal}
                      remaining={dashboard.semester1Remaining}
                    />
                    <ProgressCard
                      label="Semester 2"
                      hours={dashboard.semester2Hours}
                      goal={dashboard.semester2Goal}
                      remaining={dashboard.semester2Remaining}
                    />
                  </section>
                )}

                <Card className="shadow-lg border-card-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-display">Monthly Activity</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Select a month to see your HW Center, Tutorial, and total hours.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="tablist" aria-label="Monthly activity">
                      {dashboard.monthlyHours.map((month) => (
                        <button
                          key={month.month}
                          type="button"
                          onClick={() => setSelectedMonth(month.month)}
                          className={cn(
                            "rounded-xl px-3 py-3 text-sm font-semibold transition-all border",
                            selectedMonth === month.month
                              ? "bg-primary text-primary-foreground border-primary shadow-md"
                              : month.hasData
                                ? "bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
                                : "bg-muted/50 text-muted-foreground border-transparent"
                          )}
                          aria-selected={selectedMonth === month.month}
                          role="tab"
                        >
                          {month.shortLabel}
                        </button>
                      ))}
                    </div>

                    {selectedMonthData && (
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
                              Selected Month
                            </p>
                            <h3 className="text-2xl font-display font-bold text-foreground">
                              {selectedMonthData.month}
                            </h3>
                          </div>
                          <div className="rounded-full bg-card px-4 py-2 text-sm font-bold text-primary border border-primary/20">
                            {formatHours(selectedMonthData.total)} total
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                          <MonthDetail label="HW Center" value={selectedMonthData.hwCenter} />
                          <MonthDetail label="Tutorial" value={selectedMonthData.tutorial} />
                          <MonthDetail label="Total" value={formatHours(selectedMonthData.total)} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-card-border bg-card">
                  <CardContent className="p-4 sm:p-5">
                    <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
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
                    </div>
                  </CardContent>
                </Card>

                <div className="text-center bg-card rounded-xl p-5 w-full text-muted-foreground border border-card-border">
                  <p className="text-sm font-medium" data-testid="text-help-footer">
                    Contact NHS officers for questions about your hours
                  </p>
                </div>
              </>
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
    <Card className="border-card-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-full p-2", complete ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            {complete ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <XCircle className="w-4 h-4 text-destructive" />}
            {complete ? completeText : incompleteText}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressCard({ label, hours, goal, remaining }: { label: string; hours: number; goal: number; remaining: number }) {
  const progress = getProgressPercent(hours, goal);

  return (
    <Card className="border-card-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-display font-bold text-foreground">
              {formatHours(hours)} / {formatHours(goal)}
            </p>
          </div>
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden mt-3">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {remaining === 0 ? "Requirement met" : `${formatHours(remaining)} hours remaining`}
        </p>
      </CardContent>
    </Card>
  );
}

function MonthDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-card-border p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}

function getProgressPercent(hours: number, goal: number): number {
  if (goal <= 0) return 100;
  return Math.min(100, Math.max(0, (hours / goal) * 100));
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: { error?: string } }).data;
    if (typeof data?.error === "string") return data.error;
  }

  return fallback;
}
