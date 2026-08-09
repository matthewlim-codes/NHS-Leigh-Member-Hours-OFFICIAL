export interface AdminMember {
  username: string;
  displayName: string;
  grade: number;
  totalHours: number;
  annualGoal: number;
  annualRemaining: number;
  infoFormComplete: boolean;
  clubDuesPaid: boolean;
}

export interface AdminGroup {
  id: string;
  label: string;
  grade: number;
  count: number;
  usernames: string[];
}

export interface AdminMessage {
  id: number;
  title: string;
  body: string;
  category: string;
  targetType: string;
  targetValue: string | null;
  createdBy: string;
  createdAt: string;
}

export interface AdminSummary {
  stats: {
    totalMembers: number;
    missingHours: number;
    unpaidDues: number;
    missingInfoForm: number;
    latestSheetUpdate: AdminMessage | null;
  };
  groups: AdminGroup[];
  members: AdminMember[];
  messages: AdminMessage[];
}

export interface StudentMessage {
  id: number;
  title: string;
  body: string;
  category: string;
  createdBy: string;
  createdAt: string;
  dismissedAt: string | null;
  unread: boolean;
}

export interface StudentInbox {
  unreadCount: number;
  messages: StudentMessage[];
}

export interface CreateAdminMessageInput {
  title: string;
  body: string;
  category: "admin" | "system" | "due_date";
  targetType: "all" | "grade" | "usernames";
  grade?: string;
  usernames?: string[];
}

export async function getAdminSummary(): Promise<AdminSummary> {
  return apiFetch<AdminSummary>("/api/admin/summary");
}

export async function createAdminMessage(input: CreateAdminMessageInput): Promise<{ message: AdminMessage }> {
  return apiFetch<{ message: AdminMessage }>("/api/admin/messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function markSheetUpdated(): Promise<{ message: AdminMessage }> {
  return apiFetch<{ message: AdminMessage }>("/api/admin/sheet-updated", {
    method: "POST",
  });
}

export async function getStudentInbox(): Promise<StudentInbox> {
  return apiFetch<StudentInbox>("/api/messages");
}

export async function dismissStudentMessage(id: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/messages/${id}/dismiss`, {
    method: "POST",
  });
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
