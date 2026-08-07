import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  categoryDisplayLabel,
  type AdminExamplePost,
  type Platform,
} from "@/lib/api";
import { categoryPlatforms, likeCountLabel, type CategoryKey } from "@/lib/category-platforms";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { useScreenCapture } from "@/components/screen-capture";
import { StarRating } from "@/components/star-rating";
import { Pagination } from "@/components/pagination";
import {
  ImagePlus,
  Trash2,
  ArrowUpCircle,
  Pencil,
  Search,
  Heart,
  Camera,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/admin/examples")({
  head: () => ({
    meta: [
      { title: "ตัวอย่างโพสต์ — แอดมิน FAHSAI" },
      { name: "description", content: "คลังตัวอย่างโพสต์ดีๆ ทั้งของส่วนกลางและที่ผู้ใช้เพิ่มเอง" },
    ],
  }),
  component: AdminExamplesPage,
});

const platforms: Platform[] = ["facebook", "line", "instagram", "tiktok", "youtube"];
const PAGE_SIZE = 20;

const emptyForm = {
  id: null as number | null,
  businessCategory: "food_beverage" as string,
  platform: "facebook" as Platform,
  caption: "",
  likeCount: "",
};

function AdminExamplesPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const platformsForForm =
    categoryPlatforms[
      form.businessCategory in categoryPlatforms ? (form.businessCategory as CategoryKey) : "default"
    ];

  // A platform picked under a different category may not exist in the newly
  // selected category's list -- fall back to that category's first option
  // instead of leaving a stale, no-longer-offered platform selected.
  useEffect(() => {
    if (!platformsForForm.some((p) => p.key === form.platform)) {
      setForm((f) => ({ ...f, platform: platformsForForm[0].key }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.businessCategory]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterOwnership, setFilterOwnership] = useState<"all" | "global" | "personal">("all");
  const [page, setPage] = useState(1);

  // Debounce search text so every keystroke doesn't fire a request; reset to
  // page 1 whenever the effective search term or any filter changes so the
  // user doesn't land on an out-of-range page for the new result set.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterPlatform, filterCategory, filterOwnership]);

  const { data } = useQuery({
    queryKey: [
      "admin",
      "example-posts",
      { page, search: debouncedSearch, filterPlatform, filterCategory, filterOwnership },
    ],
    queryFn: () =>
      api.adminListExamplePosts({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        platform: filterPlatform,
        businessCategory: filterCategory,
        ownership: filterOwnership,
      }),
    placeholderData: keepPreviousData,
  });
  const posts = data?.items ?? [];
  const total = data?.total ?? 0;

  // Categories fetched separately (unpaginated, unfiltered) so the filter
  // dropdown keeps surfacing every category in use — including unofficial
  // free-text ones from promoted personal posts — regardless of what's on
  // the current page.
  const { data: availableCategories = [] } = useQuery({
    queryKey: ["admin", "example-posts", "categories"],
    queryFn: () => api.adminListExamplePostCategories(),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "example-posts"] });
  }

  function resetForm() {
    setForm(emptyForm);
    setFile(null);
    setEditingImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function edit(post: AdminExamplePost) {
    setForm({
      id: post.id,
      businessCategory: post.business_category ?? "food_beverage",
      platform: post.platform,
      caption: post.caption,
      likeCount: post.like_count != null ? String(post.like_count) : "",
    });
    // A promoted personal post can carry a free-text category outside the
    // 3 official options this <select> offers — the dropdown will just show
    // blank in that edge case rather than silently picking the wrong one.
    setEditingImageUrl(post.image_url);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Any of the 3 image-input paths (click-select, drag&drop, screen capture)
  // funnel through here. Only auto-reads the screenshot for a brand-new
  // entry -- when editing an existing post the caption/like count already
  // hold real data tuned by hand, so a re-upload there stays manual to
  // avoid silently clobbering it.
  async function handleImageAttached(newFile: File) {
    setFile(newFile);
    if (form.id) return;
    setExtracting(true);
    try {
      const result = await api.extractExamplePost(newFile);
      if (result.caption) setForm((f) => ({ ...f, caption: result.caption }));
      if (result.like_count != null) {
        setForm((f) => ({ ...f, likeCount: String(result.like_count) }));
      }
      if (result.platform) setForm((f) => ({ ...f, platform: result.platform! }));
      toast.success("อ่านข้อมูลจากภาพให้แล้วค่ะ เช็คความถูกต้องก่อนบันทึกนะคะ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "อ่านภาพไม่สำเร็จ ลองกรอกเองนะคะ");
    } finally {
      setExtracting(false);
    }
  }

  const { startScreenCapture, captureDialog } = useScreenCapture(handleImageAttached);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("business_category", form.businessCategory);
      formData.append("platform", form.platform);
      formData.append("caption", form.caption);
      if (form.likeCount.trim()) formData.append("like_count", form.likeCount.trim());
      if (file) formData.append("image", file);
      return form.id
        ? api.adminUpdateExamplePost(form.id, formData)
        : api.adminCreateExamplePost(formData);
    },
    onSuccess: () => {
      toast.success(form.id ? "บันทึกแล้วค่ะ" : "เพิ่มเข้าคลังกลางแล้วค่ะ");
      resetForm();
      refresh();
    },
    onError: () => toast.error("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"),
  });

  const promoteMutation = useMutation({
    mutationFn: (id: number) => api.adminPromoteExamplePost(id),
    onSuccess: () => {
      toast.success("โปรโมทเข้าคลังกลางแล้วค่ะ");
      refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.adminDeleteExamplePost(id),
    onSuccess: refresh,
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: number }) =>
      api.adminRateExamplePost(id, rating),
    onSuccess: refresh,
  });

  if (!ready) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          กำลังโหลด...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8">
        <PageHeader
          title="ตัวอย่างโพสต์"
          subtitle={`คลังกลาง + ที่ผู้ใช้เพิ่มเอง (ทั้งหมด ${total} รายการ)`}
        />

        <div className="glass-card mb-6 grid gap-3 rounded-2xl p-5 md:grid-cols-2">
          <select
            value={form.businessCategory}
            onChange={(e) => setForm({ ...form, businessCategory: e.target.value })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            {Object.entries(businessCategoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            {platformsForForm.map(({ key }) => (
              <option key={key} value={key}>
                {platformLabel[key]}
              </option>
            ))}
          </select>
          <textarea
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
            rows={3}
            placeholder="ข้อความตัวอย่างโพสต์ที่ไปหามา..."
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <input
            type="number"
            min={0}
            value={form.likeCount}
            onChange={(e) => setForm({ ...form, likeCount: e.target.value })}
            placeholder={likeCountLabel[form.platform]}
            className="rounded-full border border-border bg-input px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-teal md:col-span-2"
          />
          {!form.id && (
            <p className="text-xs text-muted-foreground md:col-span-2">
              แคปหน้าจอหรือลากรูปโพสต์ที่เจอมาวางได้เลย ให้ AI อ่านแคปชั่น/ยอดไลค์ให้อัตโนมัติ
              แล้วค่อยเช็ค/แก้ก่อนบันทึก
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            {editingImageUrl && !file && (
              <img src={editingImageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            )}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingImage(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingImage(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingImage(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped && dropped.type.startsWith("image/")) handleImageAttached(dropped);
              }}
              className={
                "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition " +
                (isDraggingImage
                  ? "border-teal bg-teal/10 text-teal"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : editingImageUrl ? "เปลี่ยนรูปภาพ" : "แนบ/ลากรูปภาพมาวาง (ถ้ามี)"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) handleImageAttached(picked);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={startScreenCapture}
              className="flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Camera className="h-4 w-4" /> จับภาพหน้าจอ
            </button>
            {extracting && (
              <span className="flex items-center gap-1.5 text-xs text-teal">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังอ่านข้อมูลจากภาพ...
              </span>
            )}
            <div className="ml-auto flex gap-2">
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-full border border-border px-5 py-2 text-sm"
                >
                  ยกเลิก
                </button>
              )}
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.caption.trim() || saveMutation.isPending || extracting}
                className="btn-gold rounded-full px-5 py-2 text-sm disabled:opacity-60"
              >
                {form.id ? "บันทึกการแก้ไข" : "เพิ่มเข้าคลังกลาง"}
              </button>
            </div>
          </div>
        </div>
        {captureDialog}

        <div className="glass-card mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาข้อความในตัวอย่าง..."
              className="w-full rounded-full border border-border bg-input py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
            />
          </div>
          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value as typeof filterOwnership)}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="all">ทั้งหมด</option>
            <option value="global">เฉพาะคลังกลาง</option>
            <option value="personal">เฉพาะส่วนตัว</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="all">ทุกประเภทธุรกิจ</option>
            {availableCategories.map((value) => (
              <option key={value} value={value}>
                {categoryDisplayLabel(value)}
              </option>
            ))}
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value as typeof filterPlatform)}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            <option value="all">ทุกแพลตฟอร์ม</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="glass-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 rounded-2xl p-4"
            >
              {post.image_url ? (
                <img
                  src={post.image_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-xl bg-white/5" />
              )}
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[11px] " +
                      (post.is_personal
                        ? "bg-white/5 text-muted-foreground"
                        : "bg-teal/15 text-teal")
                    }
                  >
                    {post.is_personal ? "ส่วนตัว" : "กลาง"}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {platformLabel[post.platform]}
                  </span>
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    {categoryDisplayLabel(post.business_category)}
                  </span>
                  {post.like_count != null && (
                    <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                      <Heart className="h-3 w-3" />
                      {post.like_count.toLocaleString()}
                    </span>
                  )}
                  {post.is_personal && (
                    <span className="text-[11px] text-muted-foreground">
                      {post.owner_name} • {post.owner_email}
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-sm leading-relaxed">{post.caption}</div>
                {!post.is_personal && (
                  <div className="mt-2">
                    <StarRating
                      value={post.rating}
                      onChange={(rating) => rateMutation.mutate({ id: post.id, rating })}
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {post.is_personal ? (
                  <button
                    onClick={() => promoteMutation.mutate(post.id)}
                    title="โปรโมทเข้าคลังกลาง"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-teal/15 hover:text-teal"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => edit(post)}
                    title="แก้ไข"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(post.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {total === 0 &&
              !debouncedSearch &&
              filterPlatform === "all" &&
              filterCategory === "all" &&
              filterOwnership === "all"
                ? "ยังไม่มีตัวอย่างโพสต์ในระบบเลยค่ะ"
                : "ไม่พบตัวอย่างที่ตรงกับตัวกรองค่ะ"}
            </div>
          )}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}
