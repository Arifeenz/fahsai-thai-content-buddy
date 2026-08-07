export type Platform = "facebook" | "line" | "instagram" | "tiktok" | "youtube";
export type Tone = "friendly" | "professional" | "playful" | "promo";
export type ContentStatus = "draft" | "approved" | "posted";
export type ContentFeedback = "good" | "neutral" | "bad";
export type DnaDocType = "history" | "menu" | "usp" | "tone" | "audience";
export type Role = "admin" | "user";
export type BusinessCategory = "food_beverage" | "online_shop" | "fortune_telling" | "streamer";
export type SocialPlatform = "facebook" | "instagram" | "line" | "tiktok" | "youtube" | "twitch";
export type ExampleSelectionMode = "latest" | "rating" | "likes" | "random";

export interface GenerateInput {
  businessId: string;
  prompt: string;
  platform: Platform;
  tone: Tone;
  contentId?: string;
}
export interface ContentItem {
  id: string;
  platform: Platform;
  preview: string;
  status: ContentStatus;
  feedback: ContentFeedback | null;
  createdAt: string;
  scheduledDate: string | null;
}
export interface AdminContentItem extends ContentItem {
  owner_name: string;
  owner_email: string;
}
export interface DnaDocument {
  doc_type: DnaDocType;
  content: string;
}
export type SocialLinks = Record<SocialPlatform, string>;
export interface AuthUser {
  name: string;
  email: string;
  picture?: string;
  role: Role;
  business_category?: BusinessCategory;
  last_login_at?: string;
  hide_global_events: boolean;
  email_verified: boolean;
  example_selection_mode: ExampleSelectionMode;
  has_password: boolean;
  is_demo: boolean;
}
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  business_category?: BusinessCategory;
  created_at: string;
  last_login_at?: string;
  is_demo: boolean;
  is_active: boolean;
  email_verified: boolean;
  has_password: boolean;
}
export interface AdminUserDetail {
  user: AdminUser;
  content_count: number;
  recent_content: ContentItem[];
}
export interface PromptTemplate {
  id: number;
  business_category?: BusinessCategory;
  platform: Platform;
  tone?: Tone;
  template_text: string;
  updated_at: string;
}
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
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
  headline: string | null;
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
export interface Quote {
  id: number;
  text: string;
  mood: string;
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
  system_prompt: string | null;
  created_at: string;
}
export interface ExamplePost {
  id: number;
  is_personal: boolean;
  // Free text on personal examples (see examples.tsx), so not always one of
  // the official BusinessCategory values — display with a raw-string fallback.
  business_category?: string;
  platform: Platform;
  caption: string;
  image_url: string | null;
  rating: number | null;
  like_count: number | null;
  created_at: string;
}
export interface AdminExamplePost extends ExamplePost {
  owner_name: string | null;
  owner_email: string | null;
}
export interface FollowerSnapshot {
  id: number;
  platform: Platform;
  follower_count: number;
  recorded_at: string;
}
export interface SupportTicket {
  id: number;
  message: string;
  user_agent: string | null;
  resolved: boolean;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}
export interface ApprovalByMode {
  mode: string;
  generations: number;
  approved: number;
}
export interface FeedbackByMode {
  mode: string;
  good: number;
  total_rated: number;
}
export interface DnaCompletenessRow {
  filled_count: number;
  user_count: number;
  total_generations: number;
  total_approved: number;
}
export interface AdminKpi {
  approval_by_mode: ApprovalByMode[];
  feedback_by_mode: FeedbackByMode[];
  dna_completeness: DnaCompletenessRow[];
  retained_users: number;
  active_users: number;
  avg_days_to_first_content: number | null;
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
  async demoLogin(businessCategory: BusinessCategory): Promise<{ user: AuthUser }> {
    return request("/auth/demo-login", {
      method: "POST",
      body: JSON.stringify({ business_category: businessCategory }),
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
  async updateExampleSelectionMode(
    example_selection_mode: ExampleSelectionMode,
  ): Promise<{ user: AuthUser }> {
    return request("/me/example-selection-mode", {
      method: "PATCH",
      body: JSON.stringify({ example_selection_mode }),
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
  async changePassword(currentPassword: string | null, newPassword: string): Promise<void> {
    await request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  },

  async getDna(): Promise<Record<DnaDocType, string>> {
    return request("/brand-dna");
  },
  async saveDna(docs: Record<DnaDocType, string>): Promise<Record<DnaDocType, string>> {
    return request("/brand-dna", { method: "PUT", body: JSON.stringify(docs) });
  },
  async draftDna(
    text: string,
  ): Promise<Record<DnaDocType, string> & { missing_fields: DnaDocType[] }> {
    return request("/brand-dna/draft", { method: "POST", body: JSON.stringify({ text }) });
  },

  async getSocialLinks(): Promise<SocialLinks> {
    return request("/social-links");
  },
  async saveSocialLinks(links: SocialLinks): Promise<SocialLinks> {
    return request("/social-links", { method: "PUT", body: JSON.stringify(links) });
  },

  async createFollowerSnapshot(
    platform: Platform,
    follower_count: number,
  ): Promise<FollowerSnapshot> {
    return request("/follower-snapshot", {
      method: "POST",
      body: JSON.stringify({ platform, follower_count }),
    });
  },
  async listFollowerSnapshots(): Promise<FollowerSnapshot[]> {
    const { snapshots } = await request<{ snapshots: FollowerSnapshot[] }>("/follower-snapshot");
    return snapshots;
  },
  async createSupportTicket(message: string): Promise<SupportTicket> {
    return request("/support-tickets", {
      method: "POST",
      body: JSON.stringify({ message, user_agent: navigator.userAgent }),
    });
  },

  async generate(input: GenerateInput): Promise<{
    caption: string;
    image_prompt: string | null;
    image_prompt_th: string | null;
    content_id: string;
  }> {
    return request("/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: input.prompt,
        platform: input.platform,
        tone: input.tone,
        content_id: input.contentId,
      }),
    });
  },
  async generateFromImage(
    formData: FormData,
  ): Promise<{ caption: string; image_urls: string[]; content_id: string }> {
    return requestForm("/generate-from-image", formData);
  },
  async generateVideoScript(
    caption: string,
    platform: Platform,
    tone: Tone,
  ): Promise<{ video_script: string }> {
    return request("/generate-video-script", {
      method: "POST",
      body: JSON.stringify({ caption, platform, tone }),
    });
  },

  async listContent(): Promise<ContentItem[]> {
    const { items } = await request<{ items: ContentItem[] }>("/content");
    return items;
  },
  async saveContent(
    item: Omit<ContentItem, "id" | "createdAt" | "feedback" | "scheduledDate"> & {
      mode?: "idea" | "photo";
      scheduled_date?: string;
    },
  ): Promise<ContentItem> {
    return request("/content", { method: "POST", body: JSON.stringify(item) });
  },
  async setContentFeedback(id: string, feedback: ContentFeedback): Promise<ContentItem> {
    return request(`/content/${id}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ feedback }),
    });
  },
  async updateContentSchedule(id: string, scheduledDate: string | null): Promise<ContentItem> {
    return request(`/content/${id}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({ scheduled_date: scheduledDate }),
    });
  },
  async markContentPosted(id: string): Promise<ContentItem> {
    return request(`/content/${id}/mark-posted`, { method: "PATCH" });
  },
  async deleteContent(id: string): Promise<void> {
    await request(`/content/${id}`, { method: "DELETE" });
  },
  async updateContent(
    id: string,
    updates: { preview?: string; status?: ContentStatus; scheduled_date?: string },
  ): Promise<ContentItem> {
    return request(`/content/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
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
  async getEventHeadline(eventId: number): Promise<string | null> {
    const { headline } = await request<{ headline: string | null }>(`/events/${eventId}/headline`);
    return headline;
  },
  async getDailyQuote(): Promise<string | null> {
    const { text } = await request<{ text: string | null }>("/quotes/daily");
    return text;
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
  async adminGetKpi(): Promise<AdminKpi> {
    return request("/admin/kpi");
  },
  async adminListSecurityEvents(): Promise<SecurityEvent[]> {
    const { events } = await request<{ events: SecurityEvent[] }>("/admin/security-events");
    return events;
  },
  async adminListGenerationLogs(): Promise<GenerationLogEntry[]> {
    const { logs } = await request<{ logs: GenerationLogEntry[] }>("/admin/generation-log");
    return logs;
  },
  async adminListUsers(page = 1, pageSize = 20, search = ""): Promise<Paginated<AdminUser>> {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("page_size", String(pageSize));
    if (search.trim()) qs.set("search", search.trim());
    const {
      users,
      total,
      page: p,
      page_size,
    } = await request<{
      users: AdminUser[];
      total: number;
      page: number;
      page_size: number;
    }>(`/admin/users?${qs.toString()}`);
    return { items: users, total, page: p, page_size };
  },
  async adminGetUser(id: number): Promise<AdminUserDetail> {
    return request(`/admin/users/${id}`);
  },
  async adminUpdateUserRole(id: number, role: Role): Promise<{ user: AdminUser }> {
    return request(`/admin/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },
  async adminSetUserActive(id: number, isActive: boolean): Promise<{ user: AdminUser }> {
    return request(`/admin/users/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  },
  async adminListContent(page = 1, pageSize = 20): Promise<Paginated<AdminContentItem>> {
    const {
      items,
      total,
      page: p,
      page_size,
    } = await request<{
      items: AdminContentItem[];
      total: number;
      page: number;
      page_size: number;
    }>(`/admin/content?page=${page}&page_size=${pageSize}`);
    return { items, total, page: p, page_size };
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

  async adminListQuotes(): Promise<Quote[]> {
    const { quotes } = await request<{ quotes: Quote[] }>("/admin/quotes");
    return quotes;
  },
  async adminCreateQuote(data: { text: string; mood: string }): Promise<Quote> {
    return request("/admin/quotes", { method: "POST", body: JSON.stringify(data) });
  },
  async adminUpdateQuote(id: number, data: { text: string; mood: string }): Promise<Quote> {
    return request(`/admin/quotes/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
  async adminDeleteQuote(id: number): Promise<void> {
    await request(`/admin/quotes/${id}`, { method: "DELETE" });
  },

  async listMyExamplePosts(): Promise<ExamplePost[]> {
    const { posts } = await request<{ posts: ExamplePost[] }>("/example-posts");
    return posts;
  },
  async extractExamplePost(
    imageFile: File,
  ): Promise<{ caption: string; like_count: number | null; platform: Platform | null }> {
    const formData = new FormData();
    formData.append("image", imageFile);
    return requestForm("/example-posts/extract", formData);
  },
  async createExamplePost(formData: FormData): Promise<ExamplePost> {
    return requestForm("/example-posts", formData);
  },
  async updateExamplePost(id: number, formData: FormData): Promise<ExamplePost> {
    return requestForm(`/example-posts/${id}`, formData, "PUT");
  },
  async deleteExamplePost(id: number): Promise<void> {
    await request(`/example-posts/${id}`, { method: "DELETE" });
  },
  async rateExamplePost(id: number, rating: number): Promise<ExamplePost> {
    return request(`/example-posts/${id}/rating`, {
      method: "PATCH",
      body: JSON.stringify({ rating }),
    });
  },
  async adminRateExamplePost(id: number, rating: number): Promise<ExamplePost> {
    return request(`/admin/example-posts/${id}/rating`, {
      method: "PATCH",
      body: JSON.stringify({ rating }),
    });
  },
  async adminListExamplePosts(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      platform?: Platform | "all";
      businessCategory?: string;
      ownership?: "all" | "global" | "personal";
    } = {},
  ): Promise<Paginated<AdminExamplePost>> {
    const qs = new URLSearchParams();
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.pageSize ?? 20));
    if (params.search?.trim()) qs.set("search", params.search.trim());
    if (params.platform && params.platform !== "all") qs.set("platform", params.platform);
    if (params.businessCategory && params.businessCategory !== "all") {
      qs.set("business_category", params.businessCategory);
    }
    if (params.ownership && params.ownership !== "all") qs.set("ownership", params.ownership);
    const { posts, total, page, page_size } = await request<{
      posts: AdminExamplePost[];
      total: number;
      page: number;
      page_size: number;
    }>(`/admin/example-posts?${qs.toString()}`);
    return { items: posts, total, page, page_size };
  },
  async adminListExamplePostCategories(): Promise<string[]> {
    const { categories } = await request<{ categories: string[] }>(
      "/admin/example-posts/categories",
    );
    return categories;
  },
  async adminListSupportTickets(page = 1, pageSize = 20): Promise<Paginated<SupportTicket>> {
    const {
      tickets,
      total,
      page: p,
      page_size,
    } = await request<{
      tickets: SupportTicket[];
      total: number;
      page: number;
      page_size: number;
    }>(`/admin/support-tickets?page=${page}&page_size=${pageSize}`);
    return { items: tickets, total, page: p, page_size };
  },
  async adminResolveSupportTicket(id: number, resolved: boolean): Promise<SupportTicket> {
    return request(`/admin/support-tickets/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolved }),
    });
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
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const statusLabel: Record<ContentStatus, string> = {
  draft: "ร่าง",
  approved: "อนุมัติแล้ว",
  posted: "โพสต์แล้ว",
};

export const businessCategoryLabel: Record<BusinessCategory, string> = {
  food_beverage: "ร้านอาหาร/เครื่องดื่ม",
  online_shop: "ขายของออนไลน์",
  fortune_telling: "ดูดวง",
  streamer: "สตรีมเมอร์/เกมเมอร์",
};

export const socialPlatformLabel: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  line: "LINE OA",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
};

// Every category gets the general-purpose platforms; streamers additionally
// get the platforms they actually go live on.
const BASE_SOCIAL_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "line", "tiktok"];
export const socialPlatformsByCategory: Record<BusinessCategory, SocialPlatform[]> = {
  food_beverage: BASE_SOCIAL_PLATFORMS,
  online_shop: BASE_SOCIAL_PLATFORMS,
  fortune_telling: BASE_SOCIAL_PLATFORMS,
  streamer: [...BASE_SOCIAL_PLATFORMS, "youtube", "twitch"],
};

export const exampleSelectionModeLabel: Record<ExampleSelectionMode, string> = {
  latest: "ล่าสุด",
  rating: "ตามคะแนน",
  likes: "ตามยอดไลค์",
  random: "สุ่ม",
};

// Personal example posts can carry a free-text category (see examples.tsx)
// that isn't one of the official values above — fall back to showing it as-is.
export function categoryDisplayLabel(category: string | undefined | null): string {
  if (!category) return "—";
  return (businessCategoryLabel as Record<string, string>)[category] ?? category;
}
