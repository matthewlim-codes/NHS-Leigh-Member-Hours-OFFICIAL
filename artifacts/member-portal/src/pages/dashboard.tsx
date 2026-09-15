import { useGetMe, getGetMeQueryKey, useGetDashboard, getGetDashboardQueryKey, useLogout } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      if (dashboard.monthlyHours?.some((month: any) => month.month === currentMonth)) {
        return currentMonth;
      }

      return dashboard.monthlyHours?.find((month: any) => month.hasData)?.month ?? "October";
    });
  }, [dashboard]);

  const selectedMonthData = useMemo(() => {
    return dashboard?.monthlyHours?.find((month: any) => month.month === selectedMonth) ?? dashboard?.monthlyHours?.[0];
  }, [dashboard, selectedMonth]);

  const isGrade10 = dashboard?.grade === 10;

  if (isAuthLoading || (isAuthSuccess && isDashboardLoading)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-medium text-[16px]">Loading your dashboard...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-bold text-[16px]">Leigh NHS</span>
          </div>
          <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
            <span className="hidden sm:inline">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="text-muted-foreground hover:text-ink h-8 px-2 font-medium"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        {isDashboardError ? (
          <Alert variant="destructive" className="max-w-md w-full bg-card rounded" data-testid="alert-dashboard-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Member not found</AlertTitle>
            <AlertDescription>
              {getApiErrorMessage(dashboardError, "We couldn't find your hours record in the system. Please ask the coordinator to check your details.")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="w-full animate-in fade-in duration-500 space-y-12">
            
            <header>
              <p className="text-[13px] uppercase tracking-wider text-muted-foreground font-semibold mb-2" data-testid="text-welcome-greeting">
                Student Dashboard
              </p>
              <h1 className="text-[40px] md:text-[48px] font-bold text-ink leading-tight" data-testid="text-display-name">
                {dashboard?.displayName?.split(" ")[0] || user.username}
              </h1>
              <p className="mt-2 text-[16px] text-muted-foreground">
                {dashboard ? `Grade ${dashboard.grade}` : "Loading student data"}
                <span className="mx-2 text-border">•</span>
                Data synced: {sheetStatus?.updatedAt ? formatUpdatedAt(sheetStatus.updatedAt) : "Unknown"}
              </p>
            </header>

            {dashboard && (
              <>
                {/* Semester Progress Section */}
                <section className="bg-muted/30 -mx-4 px-4 py-8 md:rounded md:px-8 border-y md:border border-border">
                  <h2 className="text-[32px] font-bold text-ink mb-6">Semester Progress</h2>
                  
                  {/* Progress Bars */}
                  <div className="grid gap-6 md:grid-cols-2 mb-8">
                    {dashboard.grade === 12 && (
                      <ProgressCard
                        label="First Semester"
                        hours={dashboard.semester1Hours}
                        goal={dashboard.semester1Goal}
                        remaining={dashboard.semester1Remaining}
                        note="Oct–Dec: 1 HW Center & 1 Tutorial hr/mo + 2 any hr."
                      />
                    )}
                    <ProgressCard
                      label="Second Semester"
                      hours={dashboard.semester2Hours}
                      goal={dashboard.semester2Goal}
                      remaining={dashboard.semester2Remaining}
                      note={dashboard.grade === 11 ? "Jan–May junior requirement." : undefined}
                    />
                  </div>

                  {/* Status Cards */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <StatusCard 
                      label="Total Hours" 
                      value={formatHours(dashboard.totalHours)}
                      color="primary"
                    />
                    <StatusCard 
                      label="Remaining" 
                      value={formatHours(dashboard.annualRemaining)}
                      color={dashboard.annualRemaining > 0 ? "success" : "primary"}
                    />
                    <StatusCard
                      label="Information Form"
                      value={dashboard.infoFormComplete ? "Complete" : "Missing"}
                      icon={dashboard.infoFormComplete ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      color={dashboard.infoFormComplete ? "success" : "danger"}
                    />
                    <StatusCard
                      label="Club Dues"
                      value={dashboard.clubDuesPaid ? "Paid" : "Unpaid"}
                      icon={dashboard.clubDuesPaid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      color={dashboard.clubDuesPaid ? "success" : "danger"}
                    />
                  </div>
                </section>

                {/* Monthly Breakdown Table */}
                <section>
                  <h2 className="text-[32px] font-bold text-ink mb-6">Monthly Breakdown</h2>
                  
                  <div className="bg-card border border-border rounded shadow-sm">
                    {/* Tabs */}
                    <div className="flex overflow-x-auto border-b border-border hide-scrollbar" role="tablist">
                      {(dashboard.monthlyHours ?? []).map((month: any) => {
                        const isSelected = selectedMonth === month.month;
                        return (
                          <button
                            key={month.month}
                            type="button"
                            onClick={() => {
                              trackEvent("month_selected", { month: month.month });
                              setSelectedMonth(month.month);
                            }}
                            className={cn(
                              "px-6 py-4 text-[16px] font-medium whitespace-nowrap border-b-2 transition-colors",
                              isSelected
                                ? "border-primary text-primary"
                                : month.hasData
                                  ? "border-transparent text-muted-foreground hover:text-ink hover:bg-muted/30"
                                  : "border-transparent text-muted-foreground/50 opacity-60"
                            )}
                            aria-selected={isSelected}
                            role="tab"
                          >
                            {month.shortLabel}
                          </button>
                        );
                      })}
                    </div>

                    {/* Monthly Table / Detail */}
                    {selectedMonthData && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/20">
                              <th className="px-6 py-4 text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Metric</th>
                              <th className="px-6 py-4 text-[13px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Hours</th>
                            </tr>
                          </thead>
                          <tbody className="text-[16px]">
                            <tr className="border-b border-border">
                              <td className="px-6 py-4 font-medium text-ink">HW Center</td>
                              <td className="px-6 py-4 text-right font-mono font-medium text-ink">{selectedMonthData.hwCenter}</td>
                            </tr>
                            <tr className="border-b border-border">
                              <td className="px-6 py-4 font-medium text-ink">Tutorial</td>
                              <td className="px-6 py-4 text-right font-mono font-medium text-ink">{selectedMonthData.tutorial}</td>
                            </tr>
                            <tr className="bg-muted/10">
                              <td className="px-6 py-4 font-bold text-ink">Total</td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-primary text-[20px]">{formatHours(selectedMonthData.total)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>
      
      <footer className="border-t border-border mt-12 py-8 text-center text-[13px] text-muted-foreground" data-testid="text-help-footer">
        <p>National Honor Society • Contact NHS officers for questions about your hours</p>
      </footer>
    </div>
  );
}

function StatusCard({
  label,
  value,
  icon,
  color = "primary"
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  color?: "primary" | "success" | "danger";
}) {
  return (
    <Card className={cn(
      "rounded bg-card border-border shadow-sm flex items-center p-5 gap-4"
    )}>
      {icon && (
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
          color === "primary" && "bg-primary/10 text-primary",
          color === "success" && "bg-success/10 text-success",
          color === "danger" && "bg-destructive/10 text-destructive"
        )}>
          {icon}
        </div>
      )}
      {!icon && (
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
          color === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
        )}>
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      )}
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn(
          "text-[24px] font-bold mt-0.5",
          !icon ? "font-mono text-ink" : "text-ink"
        )}>
          {value}
        </p>
      </div>
    </Card>
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
  const percent = getProgressPercent(hours, goal);
  const completed = remaining <= 0;

  return (
    <Card className="rounded shadow-sm bg-card border-border">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-[20px] font-bold text-ink">{label}</h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              {completed ? "Requirement met" : `${formatHours(remaining)} hours remaining`}
            </p>
          </div>
          <div className="text-[20px] font-bold text-ink font-mono">
            {formatHours(hours)} / {formatHours(goal)}
          </div>
        </div>

        <div className="h-3 bg-muted rounded-full overflow-hidden mb-4">
          <div 
            className={cn("h-full transition-all duration-1000", completed ? "bg-success" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>

        {note && (
          <p className="text-[13px] text-muted-foreground pt-4 border-t border-border mt-6">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
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
