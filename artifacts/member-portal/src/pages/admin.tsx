import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminMessage,
  getAdminSummary,
  markSheetUpdated,
  type AdminGroup,
  type AdminMember,
} from "@/lib/messages-api";
import { cn } from "@/lib/utils";
import { LogOut, Megaphone, RefreshCw, Search, Send } from "lucide-react";

const summaryQueryKey = ["admin-summary"];

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [targetType, setTargetType] = useState<"all" | "grade" | "usernames">("all");
  const [selectedGrade, setSelectedGrade] = useState("11");
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<"admin" | "system" | "due_date">("admin");

  const { data: user, isError, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });

  useEffect(() => {
    if (isError) setLocation("/login");
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [isError, setLocation, user]);

  const { data, isLoading: summaryLoading, error } = useQuery({
    queryKey: summaryQueryKey,
    queryFn: getAdminSummary,
    enabled: user?.role === "admin",
  });

  const createMessage = useMutation({
    mutationFn: createAdminMessage,
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await queryClient.invalidateQueries({ queryKey: summaryQueryKey });
    },
  });

  const sheetUpdated = useMutation({
    mutationFn: markSheetUpdated,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: summaryQueryKey });
    },
  });

  const logout = useLogout();

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!data) return [];
    if (!normalized) return data.members;
    return data.members.filter((member) =>
      `${member.displayName} ${member.username} ${member.grade}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [data, search]);

  const recipientCount = getRecipientCount(targetType, selectedGrade, selectedUsernames, data?.members ?? []);

  const onSend = (event: React.FormEvent) => {
    event.preventDefault();
    createMessage.mutate({
      title,
      body,
      category,
      targetType,
      grade: targetType === "grade" ? selectedGrade : undefined,
      usernames: targetType === "usernames" ? selectedUsernames : undefined,
    });
  };

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  if (isLoading || (user?.role === "admin" && summaryLoading)) {
    return <div className="min-h-[100dvh] grid place-items-center text-muted-foreground">Loading admin dashboard...</div>;
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Admin</p>
            <h1 className="font-display text-xl font-bold">Member communications</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} disabled={logout.isPending}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-5">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load admin dashboard."}
            </div>
          )}

          {data && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total members" value={data.stats.totalMembers} />
                <StatCard label="Missing hours" value={data.stats.missingHours} />
                <StatCard label="Unpaid dues" value={data.stats.unpaidDues} />
                <StatCard label="Missing info form" value={data.stats.missingInfoForm} />
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    Sheet update broadcast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Last marked updated: {data.stats.latestSheetUpdate ? formatDate(data.stats.latestSheetUpdate.createdAt) : "Never"}
                  </p>
                  <Button onClick={() => sheetUpdated.mutate()} disabled={sheetUpdated.isPending}>
                    {sheetUpdated.isPending ? "Sending..." : "Tell all tutors the hours sheet is up to date"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Smart groups</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {data.groups.map((group) => (
                    <GroupButton
                      key={group.id}
                      group={group}
                      selected={targetType === "grade" && selectedGrade === String(group.grade)}
                      onClick={() => {
                        setTargetType("grade");
                        setSelectedGrade(String(group.grade));
                      }}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Group builder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, username, or grade"
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-72 overflow-auto rounded-xl border border-border">
                    {filteredMembers.map((member) => (
                      <label
                        key={member.username}
                        className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsernames.includes(member.username)}
                          onChange={(event) => {
                            setTargetType("usernames");
                            setSelectedUsernames((current) =>
                              event.target.checked
                                ? [...new Set([...current, member.username])]
                                : current.filter((username) => username !== member.username),
                            );
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{member.displayName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {member.username} · Grade {member.grade} · {formatHours(member.annualRemaining)} hrs remaining
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedUsernames([])}>
                      Clear selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTargetType("usernames");
                        setSelectedUsernames(filteredMembers.map((member) => member.username));
                      }}
                    >
                      Select visible
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Message center
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSend}>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Recipients</span>
                  <select
                    value={targetType}
                    onChange={(event) => setTargetType(event.target.value as "all" | "grade" | "usernames")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All tutors</option>
                    <option value="grade">Smart group by grade</option>
                    <option value="usernames">Selected tutors</option>
                  </select>
                </label>

                {targetType === "grade" && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">Smart group</span>
                    <select
                      value={selectedGrade}
                      onChange={(event) => setSelectedGrade(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="10">Sophomores</option>
                      <option value="11">Juniors</option>
                      <option value="12">Seniors</option>
                    </select>
                  </label>
                )}

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Message type</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as "admin" | "system" | "due_date")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="admin">Admin message</option>
                    <option value="system">System update</option>
                    <option value="due_date">Due date reminder</option>
                  </select>
                </label>

                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Message title" required />
                <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the message tutors will see..." rows={5} required />

                <p className="text-xs text-muted-foreground">
                  This will send to {recipientCount} tutor{recipientCount === 1 ? "" : "s"}.
                </p>

                {createMessage.isError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {createMessage.error instanceof Error ? createMessage.error.message : "Could not send message."}
                  </p>
                )}

                <Button className="w-full" disabled={createMessage.isPending || recipientCount === 0}>
                  {createMessage.isPending ? "Sending..." : "Send message"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Recent messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.messages.length ? (
                data.messages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{message.title}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase text-muted-foreground">
                        {message.category.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{message.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(message.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No messages sent yet.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-4xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function GroupButton({
  group,
  selected,
  onClick,
}: {
  group: AdminGroup;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition",
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
      )}
    >
      <p className="font-semibold">{group.label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{group.count} tutors</p>
    </button>
  );
}

function getRecipientCount(
  targetType: "all" | "grade" | "usernames",
  selectedGrade: string,
  selectedUsernames: string[],
  members: AdminMember[],
): number {
  if (targetType === "all") return members.length;
  if (targetType === "grade") {
    return members.filter((member) => String(member.grade) === selectedGrade).length;
  }
  return selectedUsernames.length;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
