"use client";
// components/PartsIntakeForm.tsx — AI Reception Desk (ฝากคำถามหาอะไหล่)
// เก็บ lead อะไหล่ให้ครบตาม AI Scope · โพสต์เข้า /api/leads (topic=parts) → contact_leads → Parts OpsBrief
// กติกา: รับเรื่อง+ถามข้อมูล+บอกส่งรูปทาง LINE · ไม่ยืนยันของ/ราคา/ไม่รับจอง

import { useState } from "react";
import { useLang } from "@/app/context/LanguageContext";

const LINE_OA = "https://line.me/R/ti/p/%40440ifncj";
const MODELS = ["W124", "W140", "W126", "W202", "W210", "W201", "W220", "W123"];

const T = {
  title: { th: "ฝากคำถามหาอะไหล่ Mercedes-Benz", en: "Ask us to find your Mercedes-Benz part" },
  lead: {
    th: "แจ้งรุ่นรถ ชิ้นอะไหล่ที่ต้องการ และช่องทางติดต่อกลับ ทีมงานจะช่วยตรวจสอบและติดต่อกลับให้ครับ",
    en: "Tell us your model, the part you need, and how to reach you. Our team will check and get back to you.",
  },
  name: { th: "ชื่อ", en: "Name" },
  contact: { th: "เบอร์ หรือ LINE ID", en: "Phone or LINE ID" },
  channel: { th: "สะดวกให้ติดต่อกลับทาง", en: "Contact me back via" },
  chLine: { th: "LINE", en: "LINE" },
  chCall: { th: "โทร", en: "Call" },
  model: { th: "รุ่นรถ", en: "Model" },
  year: { th: "ปีรถ (ถ้ามี)", en: "Year (if known)" },
  part: { th: "อะไหล่ที่ต้องการ", en: "Part you need" },
  partNo: { th: "Part number (ถ้ามี)", en: "Part number (if any)" },
  photo: { th: "มีรูปตัวอย่างไหม", en: "Do you have a sample photo?" },
  photoYes: { th: "มี (ส่งทาง LINE)", en: "Yes (send via LINE)" },
  photoNo: { th: "ยังไม่มี", en: "Not yet" },
  urgent: { th: "ต้องการของด่วนไหม", en: "How urgent?" },
  urgentNo: { th: "ปกติ", en: "Normal" },
  urgentYes: { th: "ด่วน", en: "Urgent" },
  detail: { th: "รายละเอียดเพิ่มเติม", en: "More details" },
  consent: { th: "ยินยอมให้เก็บข้อมูลเพื่อติดต่อกลับ", en: "I agree to be contacted about my request" },
  submit: { th: "ส่งคำถาม", en: "Send request" },
  sending: { th: "กำลังส่ง…", en: "Sending…" },
  okTitle: { th: "รับเรื่องแล้ว 🙏", en: "Got it 🙏" },
  okBody: {
    th: "ทีมงานจะตรวจสอบและติดต่อกลับให้ครับ · ถ้ามีรูปอะไหล่ ส่งเพิ่มทาง LINE ได้เลยเพื่อให้หาไวขึ้น",
    en: "Our team will check and contact you. Have a photo? Send it on LINE so we can find it faster.",
  },
  sendPhoto: { th: "ส่งรูปทาง LINE", en: "Send photo on LINE" },
  ref: { th: "เลขอ้างอิง", en: "Ref" },
  errContact: { th: "กรอกเบอร์หรือ LINE อย่างน้อย 1 ช่อง", en: "Please add a phone or LINE ID" },
  errReq: { th: "กรุณากรอกข้อมูลที่มี *", en: "Please fill the required (*) fields" },
  errSend: { th: "ส่งไม่สำเร็จ ลองใหม่ หรือทัก LINE", en: "Couldn't send — try again or use LINE" },
};

const GREEN = "#17301F", BRASS = "#B8895A", CREAM = "#F4EFE4";

export default function PartsIntakeForm() {
  const { lang } = useLang();
  const t = (k: keyof typeof T) => T[k][lang === "en" ? "en" : "th"];
  const [f, setF] = useState({
    name: "", contact: "", channel: "line", car_model: "", car_year: "",
    part_wanted: "", part_number: "", photo: "no", urgent: "no", detail: "", consent: false, website: "",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [err, setErr] = useState("");
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 15, marginTop: 5 };
  const lbl: React.CSSProperties = { fontSize: 13, color: "#555", fontWeight: 600, display: "block", marginTop: 14 };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.name.trim() || !f.car_model.trim() || !f.part_wanted.trim() || !f.consent) { setErr(t("errReq")); return; }
    if (!f.contact.trim()) { setErr(t("errContact")); return; }
    const isLine = /[a-zA-Z@._-]/.test(f.contact) && !/^\+?\d[\d\s-]{6,}$/.test(f.contact.trim());
    setBusy(true);
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "parts", source: "direct",
          name: f.name,
          phone: isLine ? "" : f.contact,
          line_id: isLine ? f.contact : "",
          car_model: f.car_model,
          car_year: f.car_year,
          part_wanted: f.part_wanted,
          part_number: f.part_number,
          photo_channel: f.photo === "yes" ? "LINE" : "ยังไม่ส่ง",
          urgent: f.urgent === "yes",
          detail: [f.detail, `ติดต่อกลับ: ${f.channel === "call" ? "โทร" : "LINE"}`].filter(Boolean).join(" · "),
          consent: true,
          website: f.website,
        }),
      });
      const j = await r.json();
      if (j?.ok) setDone({ ref: j.ref || "" });
      else setErr(t("errSend"));
    } catch { setErr(t("errSend")); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={{ background: "#fff", border: `1px solid ${BRASS}`, borderRadius: 14, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginBottom: 8 }}>{t("okTitle")}</div>
        <div style={{ fontSize: 15, color: "#444", lineHeight: 1.6, marginBottom: 16 }}>{t("okBody")}</div>
        {done.ref && <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{t("ref")}: {done.ref}</div>}
        <a href={LINE_OA} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", background: "#06C755", color: "#fff", padding: "12px 22px", borderRadius: 10, fontWeight: 600, textDecoration: "none" }}>💬 {t("sendPhoto")}</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e7e3d8", borderRadius: 14, padding: "22px 20px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: GREEN }}>{t("title")}</div>
      <div style={{ fontSize: 14, color: "#666", marginTop: 6, lineHeight: 1.55 }}>{t("lead")}</div>

      <label style={lbl}>{t("name")} *
        <input value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></label>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
        <label style={lbl}>{t("contact")} *
          <input value={f.contact} onChange={(e) => set("contact", e.target.value)} style={inp} placeholder="08x… / @lineid" /></label>
        <label style={lbl}>{t("channel")}
          <select value={f.channel} onChange={(e) => set("channel", e.target.value)} style={inp}>
            <option value="line">{t("chLine")}</option>
            <option value="call">{t("chCall")}</option>
          </select></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
        <label style={lbl}>{t("model")} *
          <input list="cbmodels" value={f.car_model} onChange={(e) => set("car_model", e.target.value)} style={inp} placeholder="W124 / W140…" />
          <datalist id="cbmodels">{MODELS.map((m) => <option key={m} value={m} />)}</datalist></label>
        <label style={lbl}>{t("year")}
          <input value={f.car_year} onChange={(e) => set("car_year", e.target.value.replace(/[^0-9]/g, ""))} style={inp} placeholder="1995" maxLength={4} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
        <label style={lbl}>{t("part")} *
          <input value={f.part_wanted} onChange={(e) => set("part_wanted", e.target.value)} style={inp} placeholder={lang === "en" ? "e.g. front grille" : "เช่น กระจังหน้า"} /></label>
        <label style={lbl}>{t("partNo")}
          <input value={f.part_number} onChange={(e) => set("part_number", e.target.value)} style={inp} /></label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={lbl}>{t("photo")}
          <select value={f.photo} onChange={(e) => set("photo", e.target.value)} style={inp}>
            <option value="no">{t("photoNo")}</option>
            <option value="yes">{t("photoYes")}</option>
          </select></label>
        <label style={lbl}>{t("urgent")}
          <select value={f.urgent} onChange={(e) => set("urgent", e.target.value)} style={inp}>
            <option value="no">{t("urgentNo")}</option>
            <option value="yes">{t("urgentYes")}</option>
          </select></label>
      </div>

      <label style={lbl}>{t("detail")}
        <textarea value={f.detail} onChange={(e) => set("detail", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></label>

      {/* honeypot */}
      <input value={f.website} onChange={(e) => set("website", e.target.value)} name="website" tabIndex={-1} autoComplete="off"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} aria-hidden="true" />

      <label style={{ display: "flex", gap: 8, marginTop: 16, fontSize: 13, color: "#555", alignItems: "flex-start" }}>
        <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} style={{ marginTop: 3 }} />
        <span>{t("consent")} *</span>
      </label>

      {err && <div style={{ color: "#A32D2D", fontSize: 13, marginTop: 10 }}>{err}</div>}

      <button type="submit" disabled={busy}
        style={{ width: "100%", marginTop: 16, background: GREEN, color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? t("sending") : t("submit")}
      </button>
    </form>
  );
}
