"use client";
// components/SalesChat.tsx — ChutiBenz AI Sales Assistant (เวอร์ชันฟรี: ค้นสต็อกจริง + สคริปต์)
// ค้นสินค้าจาก Supabase (published) ตามรุ่น/คีย์เวิร์ด → แนะนำ + ลิงก์ + ปิดด้วย LINE + เก็บ lead
// TODO(LLM): สลับเป็น Claude Haiku ทีหลัง — แค่เปลี่ยนฟังก์ชัน respond() ให้ fetch('/api/sales-chat')
// วางมุมซ้ายล่าง (ContactHub อยู่ขวาล่างแล้ว) · ใช้ได้ทั้ง TH/EN ผ่าน useLang

import { useState, useRef, useEffect } from "react";
import { useLang } from "@/app/context/LanguageContext"; import { useFlag } from "@/app/context/FlagsContext";
import { createClient } from "@/utils/supabase/client";

const LINE_OA = "https://line.me/R/ti/p/%40440ifncj";
const MODELS = ["W124", "W140", "W126", "W202", "W210", "W201"];

type Product = {
  slug: string; name: string; name_en: string | null;
  price: number | null; compatible_models: string[] | null; stock: number | null;
};
type Msg =
  | { from: "bot" | "user"; type: "text"; text: string }
  | { from: "bot"; type: "products"; items: Product[] }
  | { from: "bot"; type: "cta" };

const T = {
  launch: { th: "แชตหาอะไหล่", en: "Find parts" },
  header: { th: "ผู้ช่วยหาอะไหล่ ChutiBenz", en: "ChutiBenz Parts Assistant" },
  greet: {
    th: "สวัสดีครับ 👋 บอกรุ่นรถหรือชิ้นที่ต้องการ เดี๋ยวผมค้นสต็อกให้ทันที",
    en: "Hi 👋 Tell me your model or the part you need — I'll check our stock right away.",
  },
  pickModel: { th: "เลือกรุ่น หรือพิมพ์ค้นหา:", en: "Pick a model or type to search:" },
  placeholder: { th: "พิมพ์ เช่น กระจังหน้า W140", en: "Type e.g. W140 grille" },
  searching: { th: "กำลังค้น…", en: "Searching…" },
  found: { th: "เจอในสต็อกครับ:", en: "Found in stock:" },
  none: {
    th: "ยังไม่เจอในสต็อกตอนนี้ — ทักแอดมินทาง LINE เดี๋ยวหาให้ครับ",
    en: "Not in stock right now — chat our admin on LINE and we'll source it for you.",
  },
  view: { th: "ดูรายละเอียด", en: "View" },
  line: { th: "คุย/สั่งซื้อทาง LINE", en: "Chat / order on LINE" },
  callback: { th: "ให้แอดมินติดต่อกลับ", en: "Request a callback" },
  cbName: { th: "ชื่อ", en: "Name" },
  cbContact: { th: "เบอร์ หรือ LINE ID", en: "Phone or LINE ID" },
  cbConsent: {
    th: "ยินยอมให้เก็บข้อมูลเพื่อติดต่อกลับ",
    en: "I agree to be contacted about my request",
  },
  cbSend: { th: "ส่ง", en: "Send" },
  cbOk: { th: "รับเรื่องแล้ว เดี๋ยวติดต่อกลับครับ 🙏", en: "Got it — we'll contact you soon 🙏" },
  cbErr: { th: "ส่งไม่สำเร็จ ลองใหม่ หรือทัก LINE ครับ", en: "Couldn't send — try again or use LINE." },
  soldHint: { th: "· สอบถามสถานะก่อนสั่ง", en: "· ask availability first" },
};

export default function SalesChat() {
  const { lang } = useLang();   const salesChatOn = useFlag("sales_chat", true);
  const t = (k: keyof typeof T) => T[k][lang === "en" ? "en" : "th"];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", consent: false });
  const [formMsg, setFormMsg] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ from: "bot", type: "text", text: t("greet") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, showForm]);

  const pname = (p: Product) => (lang === "en" ? p.name_en || p.name : p.name);

  async function searchParts(text: string): Promise<Product[]> {
    const supabase = createClient();
    const codes = (text.toUpperCase().match(/W\d{3}/g) || []);
    let q = supabase
      .from("products")
      .select("slug,name,name_en,price,compatible_models,stock")
      .eq("is_published", true)
      .limit(6);
    if (codes.length) {
      q = q.overlaps("compatible_models", codes);
    } else {
      const kw = text.replace(/[,%()]/g, " ").trim();
      if (kw) q = q.or(`name.ilike.%${kw}%,name_en.ilike.%${kw}%`);
    }
    const { data } = await q;
    return (data as Product[]) || [];
  }

  async function respond(text: string) {
    setLastQuery(text);
    setBusy(true);
    try {
      const items = await searchParts(text);
      if (items.length) {
        setMsgs((m) => [
          ...m,
          { from: "bot", type: "text", text: t("found") },
          { from: "bot", type: "products", items },
          { from: "bot", type: "cta" },
        ]);
      } else {
        setMsgs((m) => [...m, { from: "bot", type: "text", text: t("none") }, { from: "bot", type: "cta" }]);
      }
    } catch {
      setMsgs((m) => [...m, { from: "bot", type: "text", text: t("none") }, { from: "bot", type: "cta" }]);
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    const v = text.trim();
    if (!v || busy) return;
    setMsgs((m) => [...m, { from: "user", type: "text", text: v }]);
    setInput("");
    respond(v);
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim() || !form.consent) return;
    const isLine = /[a-zA-Z@]/.test(form.contact) && !/^\+?\d[\d\s-]+$/.test(form.contact);
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: isLine ? "" : form.contact,
          line_id: isLine ? form.contact : "",
          consent: true,
          topic: "parts",
          source: "direct",
          detail: "[AI chat] " + lastQuery,
          website: "",
        }),
      });
      const j = await r.json();
      setFormMsg(j?.ok ? t("cbOk") : t("cbErr"));
      if (j?.ok) { setShowForm(false); setForm({ name: "", contact: "", consent: false }); }
    } catch {
      setFormMsg(t("cbErr"));
    }
  }

  const GREEN = "#17301F", BRASS = "#B8895A", CREAM = "#F4EFE4";

  if (!salesChatOn) return null;
  return (
    <>
      {/* launcher — bottom LEFT (ContactHub is bottom-right) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("launch")}
          style={{ position: "fixed", left: 16, bottom: 16, zIndex: 60, background: GREEN, color: "#fff",
            border: `1.5px solid ${BRASS}`, borderRadius: 999, padding: "12px 18px", fontWeight: 600,
            boxShadow: "0 6px 20px rgba(0,0,0,.25)", cursor: "pointer" }}
        >
          💬 {t("launch")}
        </button>
      )}

      {open && (
        <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 61, width: "min(360px, calc(100vw - 32px))",
          height: "min(540px, calc(100vh - 100px))", background: "#fff", borderRadius: 16, overflow: "hidden",
          display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,.3)", border: `1px solid ${BRASS}` }}>
          {/* header */}
          <div style={{ background: GREEN, color: "#fff", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t("header")}</span>
            <button onClick={() => setOpen(false)} aria-label="close" style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>

          {/* body */}
          <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: 12, background: CREAM }}>
            {msgs.map((m, i) => {
              if (m.type === "text")
                return (
                  <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
                    <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 12, fontSize: 14, lineHeight: 1.5,
                      background: m.from === "user" ? GREEN : "#fff", color: m.from === "user" ? "#fff" : "#1a1a1a",
                      border: m.from === "user" ? "none" : "1px solid #e7e3d8" }}>{m.text}</div>
                  </div>
                );
              if (m.type === "products")
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {m.items.map((p) => (
                      <a key={p.slug} href={`/products/${p.slug}`} style={{ display: "block", background: "#fff", border: "1px solid #e7e3d8",
                        borderRadius: 10, padding: "8px 10px", marginBottom: 6, textDecoration: "none", color: "#1a1a1a" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{pname(p)}</div>
                        <div style={{ fontSize: 13, color: GREEN, fontWeight: 700, marginTop: 2 }}>
                          {p.price != null ? `฿${p.price.toLocaleString()}` : ""}
                          {p.stock != null && p.stock <= 1 ? <span style={{ color: "#8a8a8a", fontWeight: 400 }}> {t("soldHint")}</span> : null}
                          <span style={{ color: BRASS, float: "right" }}>{t("view")} →</span>
                        </div>
                      </a>
                    ))}
                  </div>
                );
              // cta
              return (
                <div key={i} style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <a href={LINE_OA} target="_blank" rel="noopener noreferrer" style={{ background: "#06C755", color: "#fff",
                    padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>💬 {t("line")}</a>
                  <button onClick={() => { setShowForm(true); setFormMsg(""); }} style={{ background: "#fff", color: GREEN,
                    border: `1px solid ${BRASS}`, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t("callback")}</button>
                </div>
              );
            })}
            {busy && <div style={{ fontSize: 13, color: "#8a8a8a", padding: "4px 2px" }}>{t("searching")}</div>}

            {/* callback form */}
            {showForm && (
              <form onSubmit={submitLead} style={{ background: "#fff", border: "1px solid #e7e3d8", borderRadius: 10, padding: 10, marginTop: 4 }}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("cbName")}
                  style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, marginBottom: 6 }} />
                <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder={t("cbContact")}
                  style={{ width: "100%", padding: "7px 9px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13, marginBottom: 6 }} />
                <label style={{ display: "flex", gap: 6, fontSize: 12, color: "#555", marginBottom: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} style={{ marginTop: 2 }} />
                  <span>{t("cbConsent")}</span>
                </label>
                <button type="submit" disabled={!form.name.trim() || !form.contact.trim() || !form.consent}
                  style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", opacity: !form.name.trim() || !form.contact.trim() || !form.consent ? 0.5 : 1 }}>{t("cbSend")}</button>
              </form>
            )}
            {formMsg && <div style={{ fontSize: 13, color: GREEN, marginTop: 6, fontWeight: 600 }}>{formMsg}</div>}

            {/* model quick chips — show only at start */}
            {msgs.length <= 1 && !busy && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "#777", marginBottom: 6 }}>{t("pickModel")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {MODELS.map((code) => (
                    <button key={code} onClick={() => send(code)} style={{ background: "#fff", border: `1px solid ${BRASS}`,
                      color: GREEN, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{code}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* input */}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }}
            style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid #eee", background: "#fff" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("placeholder")}
              style={{ flex: 1, padding: "9px 11px", border: "1px solid #ddd", borderRadius: 999, fontSize: 14, outline: "none" }} />
            <button type="submit" disabled={busy} style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 999,
              width: 40, height: 38, fontSize: 16, cursor: "pointer" }}>➤</button>
          </form>
        </div>
      )}
    </>
  );
}
