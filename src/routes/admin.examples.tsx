import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  type Platform,
  type BusinessCategory,
} from "@/lib/api";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useRequireAdmin } from "@/lib/admin-guard";
import { ImagePlus, Trash2, ArrowUpCircle } from "lucide-react";

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

function AdminExamplesPage() {
  const { ready } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data: posts = [] } = useQuery({
    queryKey: ["admin", "example-posts"],
    queryFn: () => api.adminListExamplePosts(),
  });

  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>("food_beverage");
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "example-posts"] });
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("business_category", businessCategory);
      formData.append("platform", platform);
      formData.append("caption", caption);
      if (file) formData.append("image", file);
      return api.adminCreateExamplePost(formData);
    },
    onSuccess: () => {
      toast.success("เพิ่มเข้าคลังกลางแล้วค่ะ");
      setCaption("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refresh();
    },
    onError: () => toast.error("เพิ่มไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"),
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
          subtitle={`คลังกลาง + ที่ผู้ใช้เพิ่มเอง (${posts.length})`}
        />

        <div className="glass-card mb-6 grid gap-3 rounded-2xl p-5 md:grid-cols-2">
          <select
            value={businessCategory}
            onChange={(e) => setBusinessCategory(e.target.value as BusinessCategory)}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            {Object.entries(businessCategoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="rounded-full border border-border bg-input px-3 py-2 text-sm"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </select>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="ข้อความตัวอย่างโพสต์ที่ไปหามา..."
            className="rounded-xl border border-border bg-input p-3 text-sm md:col-span-2"
          />
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : "แนบรูปภาพ (ถ้ามี)"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!caption.trim() || createMutation.isPending}
              className="btn-gold ml-auto rounded-full px-5 py-2 text-sm disabled:opacity-60"
            >
              เพิ่มเข้าคลังกลาง
            </button>
          </div>
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
                    {post.business_category ? businessCategoryLabel[post.business_category] : "—"}
                  </span>
                  {post.is_personal && (
                    <span className="text-[11px] text-muted-foreground">
                      {post.owner_name} • {post.owner_email}
                    </span>
                  )}
                </div>
                <div className="line-clamp-2 text-sm leading-relaxed">{post.caption}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                {post.is_personal && (
                  <button
                    onClick={() => promoteMutation.mutate(post.id)}
                    title="โปรโมทเข้าคลังกลาง"
                    className="rounded-lg p-2 text-muted-foreground hover:bg-teal/15 hover:text-teal"
                  >
                    <ArrowUpCircle className="h-4 w-4" />
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
              ยังไม่มีตัวอย่างโพสต์ในระบบเลยค่ะ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
