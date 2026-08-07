import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  api,
  platformLabel,
  businessCategoryLabel,
  categoryDisplayLabel,
  type ExamplePost,
  type Platform,
  type BusinessCategory,
} from "@/lib/api";
import { categoryPlatforms, likeCountLabel } from "@/lib/category-platforms";
import { AppShell, PageHeader, useCurrentUser } from "@/components/app-shell";
import { useRequireAuth } from "@/lib/auth-guard";
import { useScreenCapture } from "@/components/screen-capture";
import { StarRating } from "@/components/star-rating";
import { ImagePlus, Trash2, Pencil, Heart, Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/examples")({
  head: () => ({
    meta: [
      { title: "ตัวอย่างโพสต์ — FAHSAI" },
      { name: "description", content: "เก็บตัวอย่างโพสต์ดีๆ ที่เจอ ไว้ให้ AI เรียนรู้สไตล์ของคุณ" },
    ],
  }),
  component: ExamplesPage,
});

function ExamplesPage() {
  const { ready } = useRequireAuth();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: posts = [] } = useQuery({
    queryKey: ["my-example-posts"],
    queryFn: () => api.listMyExamplePosts(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [caption, setCaption] = useState("");
  const [likeCount, setLikeCount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categoryOption, setCategoryOption] = useState<BusinessCategory | "other" | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const effectiveCategoryOption = categoryOption ?? user?.business_category ?? "food_beverage";
  const resolvedCategory =
    effectiveCategoryOption === "other" ? customCategory.trim() : effectiveCategoryOption;
  const platformsForCategory =
    categoryPlatforms[effectiveCategoryOption === "other" ? "default" : effectiveCategoryOption];

  // A platform picked while a different category was selected (e.g. LINE OA
  // under "streamer" before switching to "online_shop") may not exist in the
  // new category's list -- fall back to that category's first option instead
  // of leaving a stale, no-longer-offered platform selected.
  useEffect(() => {
    if (!platformsForCategory.some((p) => p.key === platform)) {
      setPlatform(platformsForCategory[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCategoryOption]);

  function resetForm() {
    setEditingId(null);
    setEditingImageUrl(null);
    setPlatform("facebook");
    setCaption("");
    setLikeCount("");
    setFile(null);
    setCategoryOption(null);
    setCustomCategory("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function edit(post: ExamplePost) {
    setEditingId(post.id);
    setEditingImageUrl(post.image_url);
    setPlatform(post.platform);
    setCaption(post.caption);
    setLikeCount(post.like_count != null ? String(post.like_count) : "");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const isOfficial = !!post.business_category && post.business_category in businessCategoryLabel;
    setCategoryOption(isOfficial ? (post.business_category as BusinessCategory) : "other");
    setCustomCategory(isOfficial ? "" : (post.business_category ?? ""));
  }

  // Any of the 3 image-input paths (click-select, drag&drop, screen capture)
  // funnel through here. Only auto-reads the screenshot for a brand-new
  // entry -- when editing an existing post the caption/like count already
  // hold real data the user tuned by hand, so a re-upload there stays
  // manual to avoid silently clobbering it.
  async function handleImageAttached(newFile: File) {
    setFile(newFile);
    if (editingId) return;
    setExtracting(true);
    try {
      const result = await api.extractExamplePost(newFile);
      if (result.caption) setCaption(result.caption);
      if (result.like_count != null) setLikeCount(String(result.like_count));
      if (result.platform) setPlatform(result.platform);
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
      formData.append("business_category", resolvedCategory);
      formData.append("platform", platform);
      formData.append("caption", caption);
      if (likeCount.trim()) formData.append("like_count", likeCount.trim());
      if (file) formData.append("image", file);
      return editingId
        ? api.updateExamplePost(editingId, formData)
        : api.createExamplePost(formData);
    },
    onSuccess: () => {
      toast.success(editingId ? "บันทึกแล้วค่ะ" : "เพิ่มตัวอย่างแล้วค่ะ ✨");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["my-example-posts"] });
    },
    onError: () => toast.error("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteExamplePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-example-posts"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: number }) => api.rateExamplePost(id, rating),
    onMutate: async ({ id, rating }) => {
      await queryClient.cancelQueries({ queryKey: ["my-example-posts"] });
      const previous = queryClient.getQueryData<ExamplePost[]>(["my-example-posts"]);
      queryClient.setQueryData<ExamplePost[]>(["my-example-posts"], (old) =>
        old?.map((p) => (p.id === id ? { ...p, rating } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["my-example-posts"], context.previous);
      }
      toast.error("ให้คะแนนไม่สำเร็จ ลองใหม่อีกครั้งนะคะ");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["my-example-posts"] });
    },
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
          subtitle="เก็บโพสต์ดีๆ ที่คุณเจอไว้เป็นแนวทาง ให้ AI ช่วยเขียนได้ตรงสไตล์คุณมากขึ้น"
        />

        <div className="glass-card mb-6 rounded-2xl p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              value={effectiveCategoryOption}
              onChange={(e) => setCategoryOption(e.target.value as BusinessCategory | "other")}
              className="rounded-full border border-border bg-input px-3 py-2 text-sm"
            >
              {Object.entries(businessCategoryLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              <option value="other">อื่นๆ (ระบุเอง)</option>
            </select>
            {effectiveCategoryOption === "other" && (
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="ระบุประเภทธุรกิจ เช่น ร้านเสริมสวย"
                className="rounded-full border border-border bg-input px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
              />
            )}
          </div>
          <div className="mb-3 flex gap-2">
            {platformsForCategory.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPlatform(key)}
                className={
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm " +
                  (platform === key
                    ? "border-teal bg-teal/15 text-teal"
                    : "border-border text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                {platformLabel[key]}
              </button>
            ))}
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="วางข้อความของโพสต์ตัวอย่างที่เจอมาตรงนี้ค่ะ..."
            rows={3}
            className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
          />
          <input
            type="number"
            min={0}
            value={likeCount}
            onChange={(e) => setLikeCount(e.target.value)}
            placeholder={likeCountLabel[platform]}
            className="mt-3 w-full rounded-full border border-border bg-input px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-teal"
          />
          {!editingId && (
            <p className="mb-3 text-xs text-muted-foreground">
              แคปหน้าจอหรือลากรูปโพสต์ที่เจอมาวางได้เลย ให้ AI อ่านแคปชั่น/ยอดไลค์ให้อัตโนมัติ
              แล้วค่อยเช็ค/แก้ก่อนบันทึก
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
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
              {editingId && (
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
                disabled={!caption.trim() || !resolvedCategory || saveMutation.isPending || extracting}
                className="btn-gold rounded-full px-6 py-2 text-sm disabled:opacity-60"
              >
                {editingId ? "บันทึกการแก้ไข" : "เพิ่มตัวอย่าง"}
              </button>
            </div>
          </div>
        </div>
        {captureDialog}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.id} className="glass-card overflow-hidden rounded-2xl">
              {post.image_url && (
                <img src={post.image_url} alt="" className="h-40 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
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
                  <div className="ml-auto flex shrink-0 gap-1">
                    <button
                      onClick={() => edit(post)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(post.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="line-clamp-3 text-sm leading-relaxed">{post.caption}</div>
                <div className="mt-2">
                  <StarRating
                    value={post.rating}
                    onChange={(rating) => rateMutation.mutate({ id: post.id, rating })}
                  />
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="glass-card col-span-full rounded-2xl p-10 text-center text-sm text-muted-foreground">
              ยังไม่มีตัวอย่างโพสต์ที่เก็บไว้ค่ะ ลองเพิ่มโพสต์ดีๆ ที่เจอมาดูสิ
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
