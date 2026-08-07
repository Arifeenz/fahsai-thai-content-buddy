import { Facebook, Instagram, MessageCircle, Music2, Youtube, type LucideIcon } from "lucide-react";
import type { BusinessCategory, Platform } from "@/lib/api";

export type CategoryKey = BusinessCategory | "default";

// Which platforms actually fit each business's real posting habits in
// Thailand -- e.g. LINE OA is core infrastructure for food/retail/fortune
// telling (ordering, booking, broadcast promos) but streamers essentially
// never use it to reach an audience, so it's swapped for TikTok/YouTube there.
// Shared between /create (what to generate for) and /examples (what a saved
// reference post was actually posted to) so the two never drift apart.
export const categoryPlatforms: Record<CategoryKey, { key: Platform; icon: LucideIcon }[]> = {
  food_beverage: [
    { key: "facebook", icon: Facebook },
    { key: "line", icon: MessageCircle },
    { key: "instagram", icon: Instagram },
  ],
  online_shop: [
    { key: "facebook", icon: Facebook },
    { key: "line", icon: MessageCircle },
    { key: "instagram", icon: Instagram },
    { key: "tiktok", icon: Music2 },
  ],
  fortune_telling: [
    { key: "facebook", icon: Facebook },
    { key: "line", icon: MessageCircle },
    { key: "instagram", icon: Instagram },
  ],
  streamer: [
    { key: "facebook", icon: Facebook },
    { key: "instagram", icon: Instagram },
    { key: "tiktok", icon: Music2 },
    { key: "youtube", icon: Youtube },
  ],
  default: [
    { key: "facebook", icon: Facebook },
    { key: "line", icon: MessageCircle },
    { key: "instagram", icon: Instagram },
  ],
};

// Per-platform label for a "how many likes did this get" input -- Facebook
// calls it a like, Instagram/TikTok surface it as a heart, LINE OA posts
// don't have a public like count at all so it falls back to a neutral term.
export const likeCountLabel: Record<Platform, string> = {
  facebook: "ยอดไลค์ของโพสต์นี้ (ถ้าทราบ)",
  instagram: "ยอดหัวใจ/ถูกใจของโพสต์นี้ (ถ้าทราบ)",
  line: "ยอดการมีส่วนร่วมของโพสต์นี้ (ถ้าทราบ)",
  tiktok: "ยอดถูกใจของโพสต์นี้ (ถ้าทราบ)",
  youtube: "ยอดถูกใจของโพสต์นี้ (ถ้าทราบ)",
};
