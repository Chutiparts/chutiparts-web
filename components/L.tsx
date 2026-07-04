"use client";
// components/L.tsx — โชว์ข้อความ 2 ภาษาตามภาษาที่ผู้ใช้เลือก (TH/EN)
// ใช้กับข้อมูลสินค้า: <L th={product.name} en={product.name_en} />
// fallback: ถ้า EN ว่าง → โชว์ TH · ถ้า TH ว่าง → โชว์ EN (ไม่มีวันว่างเปล่า)
// ปลอดภัย: ถ้ายังไม่แปล EN หน้าเว็บจะโชว์ TH เหมือนเดิมทุกจุด

import { useLang } from "@/app/context/LanguageContext";

export default function L({
  th,
  en,
}: {
  th?: string | null;
  en?: string | null;
}) {
  const { lang } = useLang();
  const text = lang === "en" ? en || th || "" : th || en || "";
  return <>{text}</>;
}
