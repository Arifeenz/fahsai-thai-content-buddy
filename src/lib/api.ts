// Mock API layer for FAHSAI. All backend calls flow through here so they can
// later be swapped for a real FastAPI backend (POST /businesses/{id}/generate
// with JWT etc).

export type Platform = "facebook" | "line" | "instagram";
export type Tone = "friendly" | "professional" | "playful" | "promo";
export type ContentStatus = "draft" | "approved" | "posted";
export type DnaDocType = "history" | "menu" | "usp" | "tone";

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
export interface DnaDocument {
  doc_type: DnaDocType;
  content: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sampleCaptions: Record<Platform, string[]> = {
  facebook: [
    "☕ ตื่นเช้ามาที่ยะลาวันนี้ กลิ่นกาแฟหอมกรุ่นรอคุณอยู่นะคะ ✨\nร้านเราคั่วเมล็ดใหม่ทุกวัน หวานนิดขมกำลังดี ดื่มแล้วสดชื่นทั้งวัน 🌤️\nแวะมาทักทายกันได้เลยค่ะ เปิดตั้งแต่ 7 โมงเช้า ถึง 5 โมงเย็น\n#กาแฟยะลา #ร้านกาแฟใต้ #FAHSAI",
    "พิเศษวันนี้! ☀️ เมนูกาแฟส้มสูตรฟ้าใส หวานเปรี้ยวลงตัว เย็นชื่นใจ\nสั่ง 2 แก้วลด 20 บาท เฉพาะช่วงบ่ายเท่านั้นนะคะ\nแวะมาลองกันได้ที่ร้านค่ะ 💛",
  ],
  line: [
    "สวัสดีค่ะลูกค้าคนเก่ง 💛\nวันนี้ร้านเรามีเมนูใหม่ 'ลาเต้มะพร้าวยะลา' หวานมันกลมกล่อม สั่งผ่าน LINE รับส่วนลด 10% เลยค่ะ\nพิมพ์ 'สั่ง' เพื่อสั่งเลยนะคะ ☕✨",
  ],
  instagram: [
    "sun-kissed mornings in Yala ☀️☕\nลาเต้แก้วโปรดของคุณ พร้อมเสิร์ฟที่ FAHSAI Coffee\nเปิดทุกวัน 7:00–17:00\n·\n·\n#yalacoffee #southernthailand #specialtycoffee #ฟ้าใส",
  ],
};

let mockLibrary: ContentItem[] = [
  { id: "c1", platform: "facebook", preview: "โปรโมชั่นสงกรานต์ ลด 20% เฉพาะช่วงบ่าย ☀️", status: "posted", createdAt: "2026-07-20" },
  { id: "c2", platform: "line",     preview: "เมนูใหม่ ลาเต้มะพร้าวยะลา หวานมันกลมกล่อม",   status: "approved", createdAt: "2026-07-22" },
  { id: "c3", platform: "instagram",preview: "sun-kissed mornings in Yala ☕",              status: "draft",    createdAt: "2026-07-25" },
  { id: "c4", platform: "facebook", preview: "ชวนแม่ๆ มาจิบกาแฟฟรี วันแม่ปีนี้ 💐",         status: "draft",    createdAt: "2026-07-27" },
];

let mockDna: Record<DnaDocType, string> = {
  history: "ร้าน FAHSAI Coffee เปิดที่ยะลาปี 2565 เริ่มจากคั่วเมล็ดในบ้านเล็กๆ ก่อนขยายเป็นคาเฟ่ริมถนนสิโรรส",
  menu: "กาแฟดริป ลาเต้ อเมริกาโน่ กาแฟส้ม เค้กมะพร้าว ชาชักใต้",
  usp: "เมล็ดคั่วสดใหม่ทุกวัน บรรยากาศอบอุ่นแบบชายแดนใต้ พนักงานพูดสามภาษา ไทย มลายู อังกฤษ",
  tone: "อบอุ่น เป็นกันเอง ใช้คำว่า 'ค่ะ/ครับ' พูดเหมือนเพื่อนบ้านทักทาย ไม่เป็นทางการ",
};

export const api = {
  async login(_email: string, _password: string) {
    await wait(600);
    return { token: "mock-jwt", user: { name: "คุณฟ้าใส", shop: "FAHSAI Coffee — ยะลา" } };
  },
  async loginWithGoogle() {
    await wait(600);
    return { token: "mock-jwt", user: { name: "คุณฟ้าใส", shop: "FAHSAI Coffee — ยะลา" } };
  },

  async getDna(): Promise<Record<DnaDocType, string>> {
    await wait(300); return { ...mockDna };
  },
  async saveDna(docs: Record<DnaDocType, string>) {
    await wait(600); mockDna = { ...docs }; return { ok: true };
  },

  // POST /businesses/{id}/generate
  async generate(input: GenerateInput): Promise<{ caption: string }> {
    await wait(2000);
    const pool = sampleCaptions[input.platform];
    const caption = pool[Math.floor(Math.random() * pool.length)];
    return { caption };
  },

  async listContent(): Promise<ContentItem[]> {
    await wait(300); return [...mockLibrary].reverse();
  },
  async saveContent(item: Omit<ContentItem, "id" | "createdAt">): Promise<ContentItem> {
    await wait(400);
    const created: ContentItem = {
      ...item,
      id: `c${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    mockLibrary.push(created);
    return created;
  },

  async stats() {
    await wait(200);
    return {
      newPosts: 12,
      approved: 34,
      posted: 21,
      successRate: 98.5,
    };
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
