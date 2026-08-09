import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dismissStudentMessage, getStudentInbox, type StudentMessage } from "@/lib/messages-api";
import { ArrowLeft, CheckCircle2, Inbox } from "lucide-react";

const inboxQueryKey = ["student-inbox"];

export default function MessagesPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isError, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });

  useEffect(() => {
    if (isError) setLocation("/login");
    if (user?.role === "admin") setLocation("/admin");
  }, [isError, setLocation, user]);

  const { data, isLoading: inboxLoading } = useQuery({
    queryKey: inboxQueryKey,
    queryFn: getStudentInbox,
    enabled: Boolean(user && user.role !== "admin"),
  });

  const dismiss = useMutation({
    mutationFn: dismissStudentMessage,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: inboxQueryKey });
    },
  });

  if (isLoading || inboxLoading) {
    return <div className="min-h-[100dvh] grid place-items-center text-muted-foreground">Loading messages...</div>;
  }

  if (!user || user.role === "admin") return null;

  const unread = data?.messages.filter((message) => message.unread) ?? [];
  const read = data?.messages.filter((message) => !message.unread) ?? [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-primary" />
            {data?.unreadCount ?? 0} unread
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Messages</p>
          <h1 className="font-display text-4xl font-bold">Inbox</h1>
          <p className="mt-2 text-muted-foreground">
            Admin messages, sheet updates, system updates, and due date reminders appear here.
          </p>
        </div>

        <MessageSection
          title="Unread"
          empty="No unread messages."
          messages={unread}
          onDismiss={(id) => dismiss.mutate(id)}
          dismissingId={dismiss.variables}
        />

        <MessageSection
          title="Read"
          empty="Dismissed messages will appear here."
          messages={read}
          onDismiss={(id) => dismiss.mutate(id)}
          dismissingId={dismiss.variables}
        />
      </main>
    </div>
  );
}

function MessageSection({
  title,
  empty,
  messages,
  onDismiss,
  dismissingId,
}: {
  title: string;
  empty: string;
  messages: StudentMessage[];
  onDismiss: (id: number) => void;
  dismissingId?: number;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {messages.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">{empty}</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              onDismiss={() => onDismiss(message.id)}
              dismissing={dismissingId === message.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MessageCard({
  message,
  onDismiss,
  dismissing,
}: {
  message: StudentMessage;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  return (
    <Card className={message.unread ? "border-primary/30" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{message.title}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                {message.category.replace("_", " ")}
              </span>
              {message.unread && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-primary">
                  New
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(message.createdAt)} · {message.createdBy}
            </p>
          </div>
          {!message.unread && <CheckCircle2 className="h-5 w-5 text-primary" />}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{message.body}</p>

        {message.unread && (
          <Button className="mt-4" size="sm" onClick={onDismiss} disabled={dismissing}>
            {dismissing ? "Marking..." : "Mark as read"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
