"use client";
// app/context/LanguageContext.tsx — ChutiBenz site-wide TH/EN i18n
// ค่าเริ่มต้น = EN (ตลาดต่างประเทศ) · จำภาษาไว้ใน localStorage
// UI/chrome เท่านั้น — ข้อมูลสินค้ายังภาษาเดียว (ทำ 2 ภาษาเฟสสุดท้าย)

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "th";

/* ---------- dictionary (ใช้ร่วม Header / Footer / Home) ---------- */
export const DICT: Record<string, { en: string; th: string }> = {
  // utility bar
  ship_top:      { en: "Ships worldwide · EMS / DHL", th: "ส่งทั่วโลก · EMS / DHL" },
  reviews:       { en: "Reviews", th: "รีวิว" },
  faq:           { en: "FAQ", th: "คำถามที่พบบ่อย" },
  diagnose:      { en: "Diagnose your car", th: "เช็คอาการรถ" },
  contact:       { en: "Contact", th: "ติดต่อ" },
  // nav
  nav_home:      { en: "Home", th: "หน้าแรก" },
  nav_browse:    { en: "Browse by car", th: "เลือกตามรุ่นรถ" },
  nav_ebooks:    { en: "eBooks", th: "อีบุ๊ค" },
  nav_vin:       { en: "VIN check", th: "เช็ค VIN" },
  nav_knowledge: { en: "Knowledge", th: "คลังความรู้" },
  nav_shops:     { en: "Garages & shops", th: "อู่ / ร้านอะไหล่" },
  nav_about:     { en: "About", th: "เกี่ยวกับเรา" },
  nav_cart:      { en: "Cart", th: "ตะกร้าสินค้า" },
  cta_intake:    { en: "Diagnose your car", th: "ส่งอาการรถ" },
  // hero
  eyebrow:       { en: "CLASSIC MERCEDES-BENZ PARTS", th: "อะไหล่เมอร์เซเดส-เบนซ์ คลาสสิก" },
  hero_h1_a:     { en: "Genuine parts for classic", th: "อะไหล่แท้ Mercedes-Benz" },
  hero_h1_b:     { en: "Mercedes-Benz", th: "คลาสสิก" },
  hero_h1_g:     { en: "— all in one place", th: "— จบในที่เดียว" },
  trustline:     { en: "OEM genuine · 15-day warranty · Ships worldwide", th: "OEM แท้ · รับประกัน 15 วัน · ส่งทั่วโลก" },
  cta_browse:    { en: "Browse by car", th: "เลือกตามรุ่นรถ" },
  // trust bar
  tb_oem:        { en: "✔ 100% OEM genuine — inspected", th: "✔ OEM แท้ 100% — ผ่านการตรวจ" },
  tb_ship:       { en: "✔ Ships worldwide", th: "✔ ส่งทั่วโลก" },
  tb_reply:      { en: "✔ Fast reply — LINE / WhatsApp", th: "✔ ตอบไว — LINE / WhatsApp" },
  // shop by model
  shop_model:    { en: "Shop by model", th: "เลือกซื้อตามรุ่น" },
  view_all:      { en: "View all models →", th: "ดูรุ่นทั้งหมด →" },
  parts:         { en: "parts", th: "ชิ้น" },
  all_models:    { en: "+ All models", th: "+ รุ่นทั้งหมด" },
  // ebooks
  eb_head:       { en: "Free model eBooks", th: "eBook คู่มือรายรุ่น แจกฟรี" },
  eb_sub:        { en: "Owner's guides for 7 classic Mercedes models — get yours free on LINE", th: "คู่มือรายรุ่น Mercedes คลาสสิก 7 รุ่น — รับฟรีทาง LINE" },
  eb_free:       { en: "FREE eBook", th: "eBook แจกฟรี" },
  eb_desc:       { en: "Owner’s guide: known faults, parts & care tips", th: "คู่มือรุ่น: อาการเสียยอดฮิต อะไหล่ & วิธีดูแล" },
  eb_get:        { en: "Get it free on LINE", th: "รับฟรีทาง LINE" },
  eb_note:       { en: "Add friend → we send your PDF", th: "แอดเพื่อน → เราส่ง PDF ให้" },
  // reviews
  rev_head:      { en: "What customers say", th: "ลูกค้าพูดถึงเรา" },
  rev_all:       { en: "All reviews →", th: "รีวิวทั้งหมด →" },
  // footer
  ft_about:      { en: "Genuine used & NOS parts for classic Mercedes-Benz. Curated by Mr.Chuti — a real V12 owner and specialist.", th: "อะไหล่แท้ มือสอง & NOS สำหรับ Mercedes-Benz คลาสสิก คัดโดย Mr.Chuti เจ้าของ V12 ตัวจริง" },
  ft_explore:    { en: "Explore", th: "เมนู" },
  ft_contact:    { en: "Contact", th: "ติดต่อ" },
  ft_rights:     { en: "© 2026 ChutiBenz · Mercedes-Benz Parts", th: "© 2026 ChutiBenz · อะไหล่ Mercedes-Benz" },
  ft_badges:     { en: "OEM genuine · 15-day warranty · Worldwide shipping", th: "OEM แท้ · รับประกัน 15 วัน · ส่งทั่วโลก" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const LanguageCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("cb_lang");
      if (s === "en" || s === "th") setLangState(s);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem("cb_lang", l); } catch {}
    try { document.documentElement.lang = l; } catch {}
  };

  const t = (k: string) => DICT[k]?.[lang] ?? k;

  return <LanguageCtx.Provider value={{ lang, setLang, t }}>{children}</LanguageCtx.Provider>;
}

export const useLang = () => useContext(LanguageCtx);
