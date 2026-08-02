import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  categoryDisplayLabel,
  type AdminExamplePost,
  type Platform,
} from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { StarRating } from "@/components/star-rating";
import { ImagePlus, Trash2, ArrowUpCircle, Pencil, Search } from "lucide-react";

export const Route = createFileRoute("/admin/examples")({
  head: () => ({
    meta: [
      { title: "ตัวอย่างโพสต์ — แอดมิน FAHSAI" },
      { name: "description", content: "คลังตัวอย่างโพสต์ดีๆ ทั้งของส่วนกลางและที่ผู้ใช้เพิ่มเอง" },
    ],
  }),
  component: AdminExamplesPage,
});

const platforms: Platform[] = ["facebook", "line", "instagram"];

const emptyForm = {
  id: null as number | null,
  businessCategory: "food_beverage" as string,
  platform: "facebook" as Platform,
  caption: "",
};

function AdminExamplesPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data: posts = [] } = useQuery({
    queryKey: ["admin", "example-posts"],
    queryFn: () => api.adminListExamplePosts(),
  });

  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterOwnership, setFilterOwnership] = useState<"all" | "global" | "personal">("all");

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (filterPlatform === "all" || p.platform === filterPlatform) &&
          (filterCategory === "all" || p.business_category === filterCategory) &&
          (filterOwnership === "all" ||
            (filterOwnership === "global" ? !p.is_personal : p.is_personal)) &&
          (search.trim() === "" || p.caption.toLowerCase().includes(search.toLowerCase())),
      ),
    [posts, search, filterPlatform, filterCategory, filterOwnership],
  );

  // Personal examples can carry a free-text category (see examples.tsx) —
  // surface whatever categories actually show up in the data, official or
  // not, so an emerging unofficial one is immediately filterable/countable.
  const availableCategories = useMemo(
    () => Array.from(new Set(posts.map((p) => p.business_category).filter((c): c is string => !!c))),
    [posts],
  );

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
    });
    // A promoted personal post can carry a free-text category outside the
    // 3 official options this <select> offers — the dropdown will just show
    // blank in that edge case rather than silently picking the wrong one.
    setEditingImageUrl(post.image_url);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("business_category", form.businessCategory);
      formData.append("platform", form.platform);
      formData.append("caption", form.caption);
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
          subtitle={`คลังกลาง + ที่ผู้ใช้เพิ่มเอง (${filtered.length}/${posts.length})`}
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
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
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
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            {editingImageUrl && !file && (
              <img src={editingImageUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : editingImageUrl ? "เปลี่ยนรูปภาพ" : "แนบรูปภาพ (ถ้ามี)"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
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
                disabled={!form.caption.trim() || saveMutation.isPending}
                className="btn-gold rounded-full px-5 py-2 text-sm disabled:opacity-60"
              >
                {form.id ? "บันทึกการแก้ไข" : "เพิ่มเข้าคลังกลาง"}
              </button>
            </div>
          </div>
        </div>

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
          {filtered.map((post) => (
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
          {filtered.length === 0 && (
            <div className="glass-card rounded-2xl p-10 text-center text-sm text-muted-foreground">
              {posts.length === 0
                ? "ยังไม่มีตัวอย่างโพสต์ในระบบเลยค่ะ"
                : "ไม่พบตัวอย่างที่ตรงกับตัวกรองค่ะ"}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
