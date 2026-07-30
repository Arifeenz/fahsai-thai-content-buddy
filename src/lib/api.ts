export type Platform = "facebook" | "line" | "instagram";
export type Tone = "friendly" | "professional" | "playful" | "promo";
export type ContentStatus = "draft" | "approved" | "posted";
export type DnaDocType = "history" | "menu" | "usp" | "tone";
export type Role = "admin" | "user";
export type BusinessCategory = "food_beverage" | "online_shop";

export interface GenerateInput {
  businessId: string;
  prompt: string;
  platform: Platform;
  tone: Tone;
}
export interface ContentItem {
  id: string;
  platform: Platform;
  preview: string;
  status: ContentStatus;
  createdAt: string;
}
export interface AdminContentItem extends ContentItem {
  owner_name: string;
  owner_email: string;
}
export interface DnaDocument {
  doc_type: DnaDocType;
  content: string;
}
export interface AuthUser {
  name: string;
  email: string;
  picture?: string;
  role: Role;
  business_category?: BusinessCategory;
  last_login_at?: string;
  hide_global_events: boolean;
  email_verified: boolean;
}
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  business_category?: BusinessCategory;
  created_at: string;
  last_login_at?: string;
}
export interface PromptTemplate {
  id: number;
  business_category?: BusinessCategory;
  platform: Platform;
  tone?: Tone;
  template_text: string;
  updated_at: string;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request to ${path} failed`);
  }
  return res.json();
}

// No Content-Type header here — the browser sets the multipart boundary
// itself when the body is a FormData instance.
async function requestForm<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Request to ${path} failed`);
  }
  return res.json();
}

export interface UpcomingEvent {
  name: string;
  days_until: number;
  suggestion_text: string;
}
export interface EventItem {
  id: number;
  name: string;
  month: number;
  day: number;
  suggestion_text: string;
  is_personal: boolean;
  days_until: number;
}
export interface SecurityEvent {
  id: number;
  event_type: string;
  identifier: string;
  endpoint: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}
export interface GenerationLogEntry {
  id: number;
  user_name: string | null;
  user_email: string | null;
  platform: Platform;
  tone: Tone | null;
  prompt: string;
  caption: string;
  created_at: string;
}
export interface ExamplePost {
  id: number;
  is_personal: boolean;
  business_category?: BusinessCategory;
  platform: Platform;
  caption: string;
  image_url: string | null;
  created_at: string;
}
export interface AdminExamplePost extends ExamplePost {
  owner_name: string | null;
  owner_email: string | null;
}

export const api = {
  async login(email: string, password: string): Promise<{ user: AuthUser }> {
    return request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  },
  async signup(name: string, email: string, password: string): Promise<{ user: AuthUser }> {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
  // Real Google login: credential is the ID token from Google Identity Services,
  // verified server-side in the FastAPI backend (backend/main.py).
  async loginWithGoogle(credential: string): Promise<{ user: AuthUser }> {
    return request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) });
  },
  async getMe(): Promise<{ user: AuthUser }> {
    return request("/auth/me");
  },
  async updateMe(business_category: BusinessCategory): Promise<{ user: AuthUser }> {
    return request("/me", { method: "PATCH", body: JSON.stringify({ business_category }) });
  },
  async setHideGlobalEvents(hide_global_events: boolean): Promise<{ user: AuthUser }> {
    return request("/me/calendar-preference", {
      method: "PATCH",
      body: JSON.stringify({ hide_global_events }),
    });
  },
  async logout() {
    await request("/auth/logout", { method: "POST" });
  },
  async verifyEmail(token: string): Promise<void> {
    await request("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
  },
  async resendVerification(): Promise<void> {
    await request("/auth/resend-verification", { method: "POST" });
  },
  async forgotPassword(email: string): Promise<void> {
    await request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  },
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },

  async getDna(): Promise<Record<DnaDocType, string>> {
    return request("/brand-dna");
  },
  async saveDna(docs: Record<DnaDocType, string>): Promise<Record<DnaDocType, string>> {
    return request("/brand-dna", { method: "PUT", body: JSON.stringify(docs) });
  },

  async generate(input: GenerateInput): Promise<{ caption: string }> {
    return request("/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: input.prompt, platform: input.platform, tone: input.tone }),
    });
  },

  async listContent(): Promise<ContentItem[]> {
    const { items } = await request<{ items: ContentItem[] }>("/content");
    return items;
  },
  async saveContent(item: Omit<ContentItem, "id" | "createdAt">): Promise<ContentItem> {
    return request("/content", { method: "POST", body: JSON.stringify(item) });
  },

  async stats() {
    return request<{
      newPosts: number;
      approved: number;
      posted: number;
      successRate: number;
      pendingReview: number;
      daysSinceLastPost: number | null;
    }>("/stats");
  },
  async getUpcomingEvent(): Promise<UpcomingEvent | null> {
    const { event } = await request<{ event: UpcomingEvent | null }>("/events/upcoming");
    return event;
  },
  async listEvents(): Promise<EventItem[]> {
    const { events } = await request<{ events: EventItem[] }>("/events");
    return events;
  },
  async createEvent(data: { name: string; month: number; day: number }): Promise<EventItem> {
    return request("/events", { method: "POST", body: JSON.stringify(data) });
  },
  async deleteEvent(id: number): Promise<void> {
    await request(`/events/${id}`, { method: "DELETE" });
  },

  async adminGetStats(): Promise<{
    total_users: number;
    total_content: number;
    new_users_week: number;
    new_content_week: number;
    security_events_week: number;
    openai_spend_this_month: number;
    openai_monthly_budget_usd: number;
  }> {
    return request("/admin/stats");
  },
  async adminListSecurityEvents(): Promise<SecurityEvent[]> {
    const { events } = await request<{ events: SecurityEvent[] }>("/admin/security-events");
    return events;
  },
  async adminListGenerationLogs(): Promise<GenerationLogEntry[]> {
    const { logs } = await request<{ logs: GenerationLogEntry[] }>("/admin/generation-log");
    return logs;
  },
  async adminListUsers(): Promise<AdminUser[]> {
    const { users } = await request<{ users: AdminUser[] }>("/admin/users");
    return users;
  },
  async adminListContent(): Promise<AdminContentItem[]> {
    const { items } = await request<{ items: AdminContentItem[] }>("/admin/content");
    return items;
  },
  async adminListPromptTemplates(): Promise<PromptTemplate[]> {
    const { templates } = await request<{ templates: PromptTemplate[] }>("/admin/prompt-templates");
    return templates;
  },
  async adminCreatePromptTemplate(
    data: Omit<PromptTemplate, "id" | "updated_at">,
  ): Promise<PromptTemplate> {
    return request("/admin/prompt-templates", { method: "POST", body: JSON.stringify(data) });
  },
  async adminUpdatePromptTemplate(
    id: number,
    data: Omit<PromptTemplate, "id" | "updated_at">,
  ): Promise<PromptTemplate> {
    return request(`/admin/prompt-templates/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  async adminDeletePromptTemplate(id: number): Promise<void> {
    await request(`/admin/prompt-templates/${id}`, { method: "DELETE" });
  },

  async adminListEvents(): Promise<EventItem[]> {
    const { events } = await request<{ events: EventItem[] }>("/admin/events");
    return events;
  },
  async adminCreateEvent(
    data: Omit<EventItem, "id" | "is_personal" | "days_until">,
  ): Promise<EventItem> {
    return request("/admin/events", { method: "POST", body: JSON.stringify(data) });
  },
  async adminUpdateEvent(
    id: number,
    data: Omit<EventItem, "id" | "is_personal" | "days_until">,
  ): Promise<EventItem> {
    return request(`/admin/events/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  async adminDeleteEvent(id: number): Promise<void> {
    await request(`/admin/events/${id}`, { method: "DELETE" });
  },

  async listMyExamplePosts(): Promise<ExamplePost[]> {
    const { posts } = await request<{ posts: ExamplePost[] }>("/example-posts");
    return posts;
  },
  async createExamplePost(formData: FormData): Promise<ExamplePost> {
    return requestForm("/example-posts", formData);
  },
  async deleteExamplePost(id: number): Promise<void> {
    await request(`/example-posts/${id}`, { method: "DELETE" });
  },
  async adminListExamplePosts(): Promise<AdminExamplePost[]> {
    const { posts } = await request<{ posts: AdminExamplePost[] }>("/admin/example-posts");
    return posts;
  },
  async adminCreateExamplePost(formData: FormData): Promise<ExamplePost> {
    return requestForm("/admin/example-posts", formData);
  },
  async adminUpdateExamplePost(id: number, formData: FormData): Promise<ExamplePost> {
    return requestForm(`/admin/example-posts/${id}`, formData, "PUT");
  },
  async adminDeleteExamplePost(id: number): Promise<void> {
    await request(`/admin/example-posts/${id}`, { method: "DELETE" });
  },
  async adminPromoteExamplePost(id: number): Promise<ExamplePost> {
    return request(`/admin/example-posts/${id}/promote`, { method: "POST" });
  },
};

export const platformLabel: Record<Platform, string> = {
  facebook: "Facebook",
  line: "LINE OA",
  instagram: "Instagram",
};

export const statusLabel: Record<ContentStatus, string> = {
  draft: "ร่าง",
  approved: "อนุมัติแล้ว",
  posted: "โพสต์แล้ว",
};

export const businessCategoryLabel: Record<BusinessCategory, string> = {
  food_beverage: "ร้านอาหาร/เครื่องดื่ม",
  online_shop: "ขายของออนไลน์",
};
