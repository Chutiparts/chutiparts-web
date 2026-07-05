// app/page.tsx — ChutiBenz Home (redesign, Racing green + brass, TH/EN)
// 2026-07-04: body only — global Header + SiteFooter มาจาก layout.tsx
// Sections: hero (S70 AMG) · trust bar · shop by model · free eBooks slideshow · reviews
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/app/context/LanguageContext";
import { createClient } from "@/utils/supabase/client";

const OA_ID = "@440ifncj";
const LINE_ADD = `https://line.me/R/ti/p/${encodeURIComponent(OA_ID)}`;

const CHIPS = ["W124", "W126", "W140", "W201", "W202", "W210", "W220"];

// ลำดับการ์ด "Shop by model" — จำนวนชิ้นดึงสดจาก Supabase (products.compatible_models)
const MODEL_CODES = ["W124", "W140", "W126", "W202", "W210", "W201", "W220", "W123"];

const EBOOKS = [
  { m: "W124", en: "The German Tank",      th: "รถถังเยอรมัน" },
  { m: "W126", en: "The Godfather",         th: "เจ้าพ่อเซี่ยงไฮ้" },
  { m: "W140", en: "The Whale",             th: "ปลาวาฬปราบเซียน" },
  { m: "W123", en: "The Classic Beauty",    th: "เบนซ์ตาหวาน" },
  { m: "W201", en: "The Baby-Benz",         th: "Baby-Benz" },
  { m: "W202", en: "The Golden C-Class",    th: "C-Class ยุคทอง" },
  { m: "W210", en: "The Twin-Oval E-Class", th: "ตาโปนคลาสสิก" },
];

/* reviews (mixed languages by design) */
const REVIEWS = [
  { text: "Exactly the right part for my W126, well packed and shipped to the UK fast. Will buy again.", who: "James P. · United Kingdom" },
  { text: "ทักไลน์ถามอาการรถ ได้คำตอบตรงจุด อะไหล่แท้ราคาดี ประทับใจมากครับ", who: "คุณสมชาย · กรุงเทพฯ" },
  { text: "Hard-to-find W140 trim, genuine and fairly priced. Mr.Chuti really knows these cars.", who: "Andreas K. · Germany" },
];

export default function HomePage() {
  const { lang, t } = useLang();
  const [slide, setSlide] = useState(0);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  // slideshow auto-rotate
  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % EBOOKS.length), 4500);
    return () => clearInterval(id);
  }, []);
  const go = (d: number) => setSlide((s) => (s + d + EBOOKS.length) % EBOOKS.length);

  // live part counts per model from Supabase (published only)
  useEffect(() => {
    const sb = createClient();
    sb.from("products")
      .select("compatible_models")
      .eq("is_published", true)
      .then(({ data }) => {
        const c: Record<string, number> = {};
        for (const row of data ?? []) {
          for (const m of (row.compatible_models as string[] | null) ?? []) {
            c[m] = (c[m] ?? 0) + 1;
          }
        }
        setCounts(c);
      });
  }, []);

  const comingSoon = lang === "en" ? "Coming soon" : "เร็ว ๆ นี้";
  const partLabel = (code: string) => {
    if (counts === null) return "…";
    const n = counts[code] ?? 0;
    return n > 0 ? `${n} ${t("parts")}` : comingSoon;
  };

  return (
    <div className="cb-home">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* hero */}
      <div className="cb-hero"><div className="cb-wrap cb-hero-grid">
        <div>
          <div className="cb-eyebrow">{t("eyebrow")}</div>
          <h1 className="cb-h1">
            {t("hero_h1_a")}<br />
            {t("hero_h1_b")} <span className="g">{t("hero_h1_g")}</span>
          </h1>
          <div className="cb-chips">
            {CHIPS.map((m, i) => (
              <Link key={m} href={`/search?model=${m}`} className={"cb-chip" + (i === 0 ? " first" : "")}>
                {m}{m === "W220" && <span className="cb-new">new</span>}
              </Link>
            ))}
          </div>
          <div className="cb-trustline">{t("trustline")}</div>
          <div className="cb-cta">
            <Link href="/search" className="cb-btn-gold">{t("cta_browse")}</Link>             <Link href="/ask" style={{ display: 'inline-block', padding: '12px 22px', border: '1.5px solid #B8895A', color: '#F4EFE4', borderRadius: 8, textDecoration: 'none', fontWeight: 600, marginLeft: 10 }}>{lang === "en" ? "Ask for a part" : "ฝากคำถามหาอะไหล่"}</Link>
          </div>
        </div>
        <div className="cb-hero-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-s70.jpg" alt="Mercedes-Benz S70 AMG V12" />
          <div className="cb-hero-cap"><b>S70 AMG · V12</b></div>
        </div>
      </div></div>

      {/* trust bar */}
      <div className="cb-tbar"><div className="cb-wrap cb-tbar-row">
        <span>{t("tb_oem")}</span>
        <span>{t("tb_ship")}</span>
        <span>{t("tb_reply")}</span>
      </div></div>

      {/* shop by model */}
      <section className="cb-blk"><div className="cb-wrap">
        <div className="cb-sechead">
          <h2>{t("shop_model")}</h2>
          <Link href="/search">{t("view_all")}</Link>
        </div>
        <div className="cb-cars">
          {MODEL_CODES.map((code) => (
            <Link className="cb-carcard" key={code} href={`/search?model=${code}`}>
              <div className="cb-carimg"><img src={`/models/${code}.jpg`} alt={code} loading="lazy" /></div>
              <div className="cb-cc"><div className="n">{code}</div><div className="p">{partLabel(code)}</div></div>
            </Link>
          ))}
          <Link className="cb-carcard cb-allcard" href="/search">{t("all_models")}</Link>
        </div>
      </div></section>

      {/* free eBooks slideshow */}
      <section className="cb-blk cb-blk-cream"><div className="cb-wrap">
        <div className="cb-sechead cb-sechead-block">
          <h2>{t("eb_head")}</h2>
          <div className="cb-muted">{t("eb_sub")}</div>
        </div>
        <div className="cb-slidebox">
          <button className="cb-sarrow l" onClick={() => go(-1)} aria-label="prev">‹</button>
          <button className="cb-sarrow r" onClick={() => go(1)} aria-label="next">›</button>
          {EBOOKS.map((e, i) => (
            <div className={"cb-pick" + (i === slide ? " on" : "")} key={e.m}>
              <div className="cb-pick-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/ebooks-covers/${e.m}.jpg`} alt={`${e.m} eBook`} loading="lazy" />
              </div>
              <div className="cb-pick-body">
                <span className="cb-free-tag">{t("eb_free")}</span>
                <h3>{e.m} — {lang === "en" ? e.en : e.th}</h3>
                <div className="cb-pno">{t("eb_desc")}</div>
                <div className="cb-pick-row">
                  <a className="cb-btn-line" href={LINE_ADD} target="_blank" rel="noopener noreferrer">{t("eb_get")}</a>
                  <span className="cb-muted cb-note">{t("eb_note")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="cb-sdots">
          {EBOOKS.map((_, i) => (
            <button key={i} className={i === slide ? "on" : ""} onClick={() => setSlide(i)} aria-label={`slide ${i + 1}`} />
          ))}
        </div>
      </div></section>

      {/* reviews */}
      <section className="cb-blk"><div className="cb-wrap">
        <div className="cb-sechead">
          <h2>{t("rev_head")}</h2>
          <Link href="/articles">{t("rev_all")}</Link>
        </div>
        <div className="cb-revs">
          {REVIEWS.map((r, i) => (
            <div className="cb-rev" key={i}>
              <div className="cb-stars">★★★★★</div>
              <p>{r.text}</p>
              <div className="cb-who">{r.who}</div>
            </div>
          ))}
        </div>
      </div></section>
    </div>
  );
}

const CSS = `
.cb-home{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Sarabun","Noto Sans Thai",Tahoma,sans-serif;color:#1b2b20;background:#fff}
.cb-home *{box-sizing:border-box}
.cb-wrap{max-width:1160px;margin:0 auto;padding:0 22px}
.cb-hero{background:#17301F;color:#F4EFE4;padding:54px 0 46px}
.cb-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}
.cb-eyebrow{color:#B8895A;font-size:12px;letter-spacing:4px;font-family:Georgia,serif;margin-bottom:14px}
.cb-h1{font-family:Georgia,serif;font-weight:500;font-size:44px;line-height:1.12;margin:0 0 8px;max-width:15em}
.cb-h1 .g{color:#B8895A}
.cb-chips{display:flex;flex-wrap:wrap;gap:9px;margin:24px 0 14px}
.cb-chip{border:1px solid #3c5343;color:#cdd8cd;font-family:Georgia,serif;font-size:15px;padding:7px 16px;border-radius:8px;cursor:pointer;position:relative;transition:.15s;text-decoration:none}
.cb-chip:hover,.cb-chip.first{border-color:#B8895A;color:#e3c9a8}
.cb-new{position:absolute;top:-8px;right:-8px;background:#B8895A;color:#17301F;font-family:sans-serif;font-size:9px;padding:0 5px;border-radius:7px;font-weight:600}
.cb-trustline{color:#97a599;font-size:14px;margin:6px 0 22px}
.cb-cta{display:flex;gap:12px;flex-wrap:wrap}
.cb-btn-gold{background:#B8895A;color:#17301F;font-weight:600;font-size:14px;padding:11px 20px;border-radius:9px;text-decoration:none;display:inline-block}
.cb-btn-gold:hover{background:#c99b70}
.cb-hero-media{position:relative}
.cb-hero-media img{width:100%;border-radius:14px;display:block;box-shadow:0 24px 60px rgba(0,0,0,.45);border:1px solid rgba(184,137,90,.35)}
.cb-hero-cap{position:absolute;left:16px;bottom:16px;background:rgba(15,36,22,.82);backdrop-filter:blur(4px);border:1px solid rgba(184,137,90,.45);border-radius:10px;padding:8px 14px;line-height:1.35}
.cb-hero-cap b{display:block;color:#B8895A;font-size:14px;letter-spacing:.5px}
.cb-tbar{background:#0f2416;color:#b3c0b3}
.cb-tbar-row{display:flex;gap:18px;flex-wrap:wrap;padding:14px 22px;font-size:13.5px;justify-content:space-between}
.cb-blk{padding:44px 0}
.cb-blk-cream{background:#f5f2e8;padding:40px 0}
.cb-sechead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px}
.cb-sechead-block{display:block;margin-bottom:16px}
.cb-sechead h2{font-family:Georgia,serif;font-weight:500;font-size:26px;margin:0;color:#1b2b20}
.cb-sechead a{color:#8a6038;font-size:14px;text-decoration:none}
.cb-muted{color:#847f72;font-size:14px}
.cb-cars{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.cb-carcard{border:.5px solid #e4e0d3;border-radius:12px;overflow:hidden;background:#fff;transition:.15s;cursor:pointer;text-decoration:none;color:inherit}
.cb-carcard:hover{border-color:#B8895A;transform:translateY(-2px)}
.cb-carimg{height:104px;background:#efeadd;display:flex;align-items:center;justify-content:center;font-size:42px}
.cb-cc{padding:11px 12px;text-align:center}
.cb-cc .n{font-size:16px;font-weight:600;color:#1b2b20}
.cb-cc .p{font-size:12.5px;color:#847f72;margin-top:2px}
.cb-allcard{display:flex;align-items:center;justify-content:center;color:#8a6038;font-size:14px}
.cb-slidebox{position:relative}
.cb-pick{display:none;gap:22px;border:.5px solid #e4e0d3;border-radius:16px;padding:18px;align-items:center;background:#fff;animation:cbfade .6s ease}
.cb-pick.on{display:flex}
@keyframes cbfade{from{opacity:.25}to{opacity:1}}
.cb-pick-img{width:158px;height:222px;border-radius:10px;overflow:hidden;background:#e3ddcd;flex-shrink:0;box-shadow:0 8px 20px rgba(28,29,44,.18)}
.cb-pick-img img{width:100%;height:100%;object-fit:cover}
.cb-pick-body{flex:1}
.cb-free-tag{display:inline-block;background:#B8895A;color:#3a2f12;font-size:12px;font-weight:700;letter-spacing:.3px;padding:3px 11px;border-radius:6px}
.cb-pick-body h3{font-size:20px;font-weight:500;margin:9px 0 3px;color:#1b2b20}
.cb-pno{font-size:13px;color:#847f72}
.cb-pick-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px}
.cb-btn-line{background:#06C755;color:#fff;font-size:15px;font-weight:600;padding:11px 22px;border-radius:10px;text-decoration:none;display:inline-flex;align-items:center;gap:7px}
.cb-note{font-size:13px}
.cb-sdots{display:flex;gap:8px;justify-content:center;margin-top:16px}
.cb-sdots button{width:9px;height:9px;border-radius:50%;background:#d8d0be;cursor:pointer;transition:.2s;border:none;padding:0}
.cb-sdots button.on{background:#8a6038;width:26px;border-radius:5px}
.cb-sarrow{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:.5px solid #e4e0d3;background:#fff;color:#17301F;font-size:18px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center}
.cb-sarrow.l{left:-14px}.cb-sarrow.r{right:-14px}
.cb-revs{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.cb-rev{border:.5px solid #e4e0d3;border-radius:12px;padding:16px;background:#fbf9f4}
.cb-stars{color:#B8895A;font-size:14px;letter-spacing:2px}
.cb-rev p{font-size:14px;line-height:1.6;margin:8px 0 10px;color:#3f3d36}
.cb-who{font-size:12.5px;color:#847f72}
@media(max-width:860px){
  .cb-hero-grid{grid-template-columns:1fr;gap:26px}
  .cb-hero-media{order:2}
  .cb-h1{font-size:32px}
  .cb-cars{grid-template-columns:repeat(2,1fr)}
  .cb-revs{grid-template-columns:1fr}
  .cb-pick{flex-direction:column;align-items:stretch}
  .cb-pick-img{width:130px;height:182px;margin:0 auto}
  .cb-sarrow{display:none}
}
`;
