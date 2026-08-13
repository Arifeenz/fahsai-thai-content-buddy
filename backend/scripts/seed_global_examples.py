"""Seeds the global (user_id IS NULL) example_posts pool with hand-authored
captions for every business category, so a brand-new user with no personal
examples of their own still gets decent few-shot grounding on their first
generation (see list_example_posts_for_generation in db.py).

Every caption here is written from scratch for this library -- never copy
real captions scraped from another business's real posts into this file;
that's a copyright problem once it's baked into paid generation prompts.
Deliberately mixed voices per category (casual/rambly human, playful,
classic promo) rather than one uniform "polished marketing" tone, so the
model has more than one flavor of copy to draw from.

Usage: python scripts/seed_global_examples.py
Safe to re-run: skips categories that already have global examples instead
of creating duplicates.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from db import create_example_post, get_connection, set_example_post_rating

ADMIN_ID = 6  # arifeen.charawae@gmail.com, provenance for these hand-authored examples

EXAMPLES = {
    "food_beverage": [
        ("facebook", "เมื่อกี้มีป้าลูกค้าบอกว่ากาแฟร้านเราหอมกว่าที่กินมาทั้งชีวิต 55555 ป้าา หนูซึ้งมากกก ขอบคุณนะคะ"),
        ("instagram", "เมนูใหม่ประจำสัปดาห์ กาแฟส้มเย็น เปรี้ยวหวานลงตัว ใครชอบของแปลกต้องลองเลยค่ะ"),
        ("line", "วันนี้ตื่นมาฝนตกหนักมาก ลูกค้าบางคนยังมาซื้อกาแฟทั้งที่เปียกมาเลยค่ะ ขอบคุณที่ยังอุดหนุนกันนะคะ รักลูกค้าที่สุด"),
        ("tiktok", "แอบชงกาแฟผิดสูตรไปแก้วนึงเมื่อเช้า แต่ลูกค้าบอกอร่อยกว่าเดิม 555 เอาวะ งั้นสูตรใหม่ละกัน"),
        ("facebook", "เค้กมะพร้าวออกจากเตาใหม่ๆ วันนี้มีจำนวนจำกัดนะคะ ใครอยากได้รีบทักก่อนหมดค่ะ"),
    ],
    "online_shop": [
        ("facebook", "แพ็คของจนดึกเมื่อคืนเลยค่ะ 555 แต่พอเห็นลูกค้าทักมาบอกว่าของถึงไวมาก หายเหนื่อยเลย ขอบคุณนะคะทุกคน"),
        ("instagram", "ครีมบำรุงผิวหน้าสูตรอ่อนโยน ใช้ได้ทุกสภาพผิว ลูกค้าหลายคนบอกหน้าเนียนขึ้นใน 2 อาทิตย์ค่ะ"),
        ("tiktok", "มีลูกค้าทักมาถามว่าทำไมกระเป๋าราคานี้ถูกจัง กลัวว่าจะไม่ดี เลยมาอัดคลิปแกะของจริงให้ดูเลยค่ะ ไม่ได้โม้"),
        ("line", "วันนี้จัดโปรแบบงงๆ นิดนึง ซื้อ 2 ชิ้นลด 10% แต่ถ้าทักมาทัน 5 คนแรกลดเพิ่มอีก 5% ค่ะ เอาใจคนตาไว 😂"),
        ("facebook", "เสื้อยืดคอกลมลายใหม่เข้าร้านแล้วค่ะ ไซส์ S-XXL มีครบ สั่งวันนี้ส่งพรุ่งนี้เลยค่ะ"),
    ],
    "fortune_telling": [
        ("facebook", "นั่งดูไพ่มาทั้งวันเลยวันนี้ มีเคสนึงที่ทำเอาหนูขนลุกเพราะตรงมาก เดี๋ยวมาเล่าให้ฟังในคอมเมนต์นะคะ"),
        ("instagram", "ดวงประจำสัปดาห์นี้ ราศีไหนการเงินพุ่ง ราศีไหนต้องระวังเรื่องคนรอบข้าง ทักมาดูดวงส่วนตัวได้เลยค่ะ"),
        ("tiktok", "มีคนถามว่าทำไมทำนายแม่นขนาดนี้ จริงๆ ก็ฝึกมาสิบกว่าปีค่ะ ไม่ได้เดามั่วนะ 555"),
        ("line", "วันนี้เปิดคิวรอบเย็นเพิ่ม ใครรอมานานละก็มาได้เลยค่ะ จองไวๆ ก่อนคิวเต็มเหมือนทุกทีนะ 🙏"),
        ("facebook", "รวมทริคจัดบ้านเสริมดวงง่ายๆ มาฝากกันค่ะ ใครอยากปรับฮวงจุ้ยบ้านลองทำตามดูได้เลย"),
    ],
    "streamer": [
        ("facebook", "เมื่อคืนแพ้รวดเดียว 5 เกมครับ 555 อารมณ์เสียมากแต่แชทยังฮาไม่หยุดเลย ขอบคุณที่ทนดูผมแพ้นะครับ"),
        ("instagram", "ไฮไลท์ช็อตเทพเมื่อคืนนี้ ใครดูสดทันบ้างยกมือหน่อย"),
        ("tiktok", "มีคนในแชทถามว่าทำไมเสียงแหบ จริงๆ คือกรี๊ดใส่เกมมาทั้งคืนครับ 555 วันนี้พักเสียงหน่อย"),
        ("line", "แจ้งตารางไลฟ์ประจำสัปดาห์ครับ จันทร์-พฤหัส 2 ทุ่ม ใครแอบอยากรู้ว่าผมนอนกี่โมงก็ลองมาดูสิครับ 😂"),
        ("facebook", "ศุกร์นี้กลับมาสายเกมสยองขวัญอีกครั้ง ใครใจไม่แข็งเตรียมมาลุ้นไปด้วยกันครับ"),
    ],
}


def existing_global_categories() -> set[str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT business_category FROM example_posts WHERE user_id IS NULL"
    ).fetchall()
    conn.close()
    return {r["business_category"] for r in rows}


def main() -> None:
    already_seeded = existing_global_categories()
    total = 0
    for category, posts in EXAMPLES.items():
        if category in already_seeded:
            print(f"{category}: already has global examples, skipping")
            continue
        for platform, caption in posts:
            row = create_example_post(None, category, platform, caption, None, ADMIN_ID, None)
            set_example_post_rating(row["id"], None, 5)
            total += 1
        print(f"{category}: {len(posts)} global examples added")
    print(f"\nTotal: {total} global example posts created.")


if __name__ == "__main__":
    main()
