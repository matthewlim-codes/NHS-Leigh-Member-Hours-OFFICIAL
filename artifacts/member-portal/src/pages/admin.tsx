import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

const summaryQueryKey = ["admin-summary"];

interface AdminSummary {
  stats: {
    latestSheetUpdate: { id: number; title: string; body: string; category: string; createdAt: string } | null;
  };
}

async function getAdminSummary(): Promise<AdminSummary> {
  const res = await fetch("/api/admin/summary", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load admin summary");
  return res.json() as Promise<AdminSummary>;
}

async function markSheetUpdated(): Promise<void> {
  const res = await fetch("/api/admin/sheet-updated", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to send broadcast");
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { data: user, isError, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });

  useEffect(() => {
    if (isError) setLocation("/login");
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [isError, setLocation, user]);

  const { data } = useQuery({
    queryKey: summaryQueryKey,
    queryFn: getAdminSummary,
    enabled: user?.role === "admin",
  });

  const sheetUpdated = useMutation({
    mutationFn: markSheetUpdated,
    onSuccess: async () => {
      trackEvent("sheet_broadcast_sent");
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: summaryQueryKey });
    },
    onError: () => {
      setConfirming(false);
    },
  });

  const logout = useLogout();

  const onLogout = () => {
    trackEvent("sign_out", { role: "admin" });
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-medium text-[16px]">Loading admin...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  const lastUpdate = data?.stats.latestSheetUpdate
    ? formatDate(data.stats.latestSheetUpdate.createdAt)
    : "Never updated";

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-bold text-[16px]">NHS Admin</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            disabled={logout.isPending}
            className="text-muted-foreground hover:text-ink h-8 px-2 font-medium"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12">
        <div className="mb-8">
          <h1 className="text-[40px] font-bold text-ink leading-tight">Admin Dashboard</h1>
          <p className="text-[16px] text-muted-foreground mt-2">Manage sheet synchronizations and system status.</p>
        </div>

        <Card className="rounded border border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border pb-6 pt-6 px-6 md:px-8">
            <CardTitle className="text-[24px] font-bold flex items-center gap-3">
              Google Sheet Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/20 rounded border border-border">
              <div>
                <p className="text-[13px] uppercase tracking-wider font-semibold text-muted-foreground">Last Successful Sync</p>
                <p className="text-[16px] font-medium text-ink mt-1">{lastUpdate}</p>
              </div>
              <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success"></div>
                System Ready
              </div>
            </div>

            {sheetUpdated.isSuccess && (
              <div className="flex items-center gap-3 rounded bg-success/10 border border-success/20 px-4 py-3 text-[16px] text-success-foreground font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                Data sync broadcast sent successfully.
              </div>
            )}

            {sheetUpdated.isError && (
              <div className="flex items-center gap-3 rounded bg-destructive/10 border border-destructive/20 px-4 py-3 text-[16px] text-destructive font-medium">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                {sheetUpdated.error instanceof Error
                  ? sheetUpdated.error.message
                  : "Failed to send broadcast."}
              </div>
            )}

            {!confirming ? (
              <Button
                onClick={() => setConfirming(true)}
                disabled={sheetUpdated.isPending}
                className="w-full sm:w-auto h-12 px-6 text-[16px] font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Update from Google Sheet
              </Button>
            ) : (
              <div className="space-y-4 rounded border border-destructive/30 bg-destructive/5 p-6 mt-4">
                <div className="flex items-start gap-3 text-destructive">
                  <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
                  <div>
                    <h4 className="font-bold text-[18px]">Confirm Data Sync</h4>
                    <p className="text-[16px] mt-1 opacity-90">
                      This will sync the latest data from the Google Sheet and notify all members. Continue?
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    size="lg"
                    onClick={() => sheetUpdated.mutate()}
                    disabled={sheetUpdated.isPending}
                    className="h-12 px-6 text-[16px] font-semibold rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {sheetUpdated.isPending ? "Syncing Data..." : "Confirm Update"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={sheetUpdated.isPending}
                    className="h-12 px-6 text-[16px] font-semibold rounded border-border hover:bg-muted"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
