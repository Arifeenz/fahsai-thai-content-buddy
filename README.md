# FAHSAI Content AI

Build "FAHSAI" — an AI content generation web app for SME owners in Thailand's

Deep South. I have attached 6 mockup images of the final UI design. MATCH THE

ATTACHED MOCKUPS AS CLOSELY AS POSSIBLE — same layout structure, same color

palette, same component placement, same visual hierarchy. The entire UI is in

Thai. Use the "Noto Sans Thai" font everywhere.

The attached mockups define these screens (build all of them):

1. LOGIN / REGISTER page — replicate the attached login mockup exactly:

   the same split/centered layout, logo placement, input styling, and button

   style shown in the image. Headline: "FAHSAI — ผู้ช่วยสร้างคอนเทนต์สำหรับร้านของคุณ"

2. DASHBOARD (หน้าแดชบอร์ด) — replicate the dashboard mockup:

   - Same sidebar navigation as in the image (logo top, menu items:

     แดชบอร์ด, สร้างคอนเทนต์, คลังคอนเทนต์, Brand DNA, ตั้งค่า; user profile

     at the bottom)

   - Same stat-card row and content sections as shown

   - Keep the card corner radius, shadows, and spacing consistent with the image

3. BRAND DNA page — replicate the Brand DNA mockup: the form sections /

   cards for entering the shop's identity (history, menu/products, unique

   selling points, tone) exactly as arranged in the image. Saving writes each

   section as a dna_document with doc_type = history / menu / usp / tone.

4. CREATE CONTENT page (สร้างคอนเทนต์) — replicate the generation screen

   mockup: the prompt input area, platform selector (Facebook / LINE OA /

   Instagram), tone/options controls, and generate button placed exactly as

   in the image. The generated result appears in the result panel shown in

   the mockup, as an EDITABLE Thai caption with actions: "อนุมัติ ✓",

   "สร้างใหม่", and after approval "คัดลอกไปโพสต์" (copies to clipboard with a

   Thai success toast).

5. CONTENT LIBRARY (คลังคอนเทนต์) — replicate the history/library mockup:

   the same card/table listing of past posts with date, platform, preview

   text, and status badge (ร่าง / อนุมัติแล้ว / โพสต์แล้ว), matching filters and

   search placement from the image.

6. Any remaining screen in the attached images (e.g. settings/metrics) —

   build it to match its mockup as well.

COLOR & STYLE: extract the exact color palette from the attached images and

define it as CSS/Tailwind design tokens (primary, sidebar, background, card,

accent, success). Do not invent a different palette.

BEHAVIOR NOTES:

- Desktop layout follows the mockups; make it responsive so it collapses to

  a clean mobile layout (sidebar becomes a bottom nav / drawer) — target

  users are shop owners on phones

- All fonts ≥ 16px, warm conversational Thai copy (ไม่ใช้ภาษาราชการ),

  no untranslated English jargon in labels

- Every async action shows a Thai loading message like

  "กำลังสร้างโพสต์ให้อยู่ค่ะ..." and a Thai error message with a retry button

- Mock the AI generation with a 2-second delay returning a realistic Thai

  caption for a coffee shop in Yala. Put ALL mock API calls in a single

  /src/lib/api.ts so they can later be swapped to a real FastAPI backend

  (POST /businesses/{id}/generate with JWT)

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fahsai-thai-content-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/73f5275f-42a7-4ee1-a255-3195994827bf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
