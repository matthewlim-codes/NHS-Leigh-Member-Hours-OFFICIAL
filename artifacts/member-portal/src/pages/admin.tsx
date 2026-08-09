import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, LogOut, RefreshCw } from "lucide-react";

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
      setConfirming(false);
      await queryClient.invalidateQueries({ queryKey: summaryQueryKey });
    },
    onError: () => {
      setConfirming(false);
    },
  });

  const logout = useLogout();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  const lastUpdate = data?.stats.latestSheetUpdate
    ? formatDate(data.stats.latestSheetUpdate.createdAt)
    : "Never";

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
            <h1 className="font-display text-xl font-bold">Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} disabled={logout.isPending}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Sheet update broadcast
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Notifies all members that the hours sheet has been updated. Last sent:{" "}
              <span className="font-medium text-foreground">{lastUpdate}</span>.
            </p>

            {sheetUpdated.isSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Broadcast sent successfully.
              </div>
            )}

            {sheetUpdated.isError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {sheetUpdated.error instanceof Error
                  ? sheetUpdated.error.message
                  : "Failed to send broadcast."}
              </div>
            )}

            {!confirming ? (
              <Button
                variant="outline"
                onClick={() => setConfirming(true)}
                disabled={sheetUpdated.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Send sheet update broadcast
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-amber-400/40 bg-amber-50 p-4 dark:bg-amber-950/30">
                <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This will notify <strong>all members</strong>. Are you sure the sheet is ready?
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => sheetUpdated.mutate()}
                    disabled={sheetUpdated.isPending}
                  >
                    {sheetUpdated.isPending ? "Sending…" : "Yes, send it"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(false)}
                    disabled={sheetUpdated.isPending}
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
