import { Facebook, Instagram, MessageCircle, Music2, Youtube, type LucideIcon } from "lucide-react";
import type { BusinessCategory, Platform } from "@/lib/api";

export type CategoryKey = BusinessCategory | "default";

// Platforms new content can be created for. LINE OA was retired as a
// target (the backend rejects it); "line" stays in the Platform type only so
// content created before then still shows its label.
export const CREATABLE_PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];
export const RETIRED_PLATFORMS: Platform[] = ["line"];

// Options for a platform picker that may be editing an existing row: an old
// LINE OA row keeps its own value selectable (the backend allows leaving it
// unchanged) but LINE OA is never offered for anything else.
export function platformOptions(current?: Platform | null): Platform[] {
  return current && RETIRED_PLATFORMS.includes(current)
    ? [...CREATABLE_PLATFORMS, current]
    : CREATABLE_PLATFORMS;
}

const PLATFORM_ICONS: Record<Platform, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  line: MessageCircle,
  tiktok: Music2,
  youtube: Youtube,
};

const ALL_CREATABLE = CREATABLE_PLATFORMS.map((key) => ({ key, icon: PLATFORM_ICONS[key] }));

// Every business category gets the same four platforms. Shared between
// /create (what to generate for) and /examples (what a saved reference post
// was actually posted to) so the two never drift apart.
export const categoryPlatforms: Record<CategoryKey, { key: Platform; icon: LucideIcon }[]> = {
  food_beverage: ALL_CREATABLE,
  online_shop: ALL_CREATABLE,
  fortune_telling: ALL_CREATABLE,
  streamer: ALL_CREATABLE,
  default: ALL_CREATABLE,
};

// Per-platform label for a "how many likes did this get" input -- Facebook
// calls it a like, Instagram/TikTok surface it as a heart. The LINE OA entry
// is only for editing posts saved before LINE OA was retired.
export const likeCountLabel: Record<Platform, string> = {
  facebook: "ยอดไลค์ของโพสต์นี้ (ถ้าทราบ)",
  instagram: "ยอดหัวใจ/ถูกใจของโพสต์นี้ (ถ้าทราบ)",
  line: "ยอดการมีส่วนร่วมของโพสต์นี้ (ถ้าทราบ)",
  tiktok: "ยอดถูกใจของโพสต์นี้ (ถ้าทราบ)",
  youtube: "ยอดถูกใจของโพสต์นี้ (ถ้าทราบ)",
};
