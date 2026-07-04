// components/layout/Header.tsx — ChutiBenz global header (Racing green + brass, TH/EN)
// 2026-07-04: redesign — 2-tier nav + EN/TH toggle · คง CartLink (useCart) · real routes
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/app/context/CartContext";
import { useLang } from "@/app/context/LanguageContext";

const OA_ID = "@440ifncj";
const LINE_ADD = `https://line.me/R/ti/p/${encodeURIComponent(OA_ID)}`;

const NAV = [
  { href: "/", key: "nav_home" },
  { href: "/search", key: "nav_browse" },
  { href: "/ebooks", key: "nav_ebooks" },
  { href: "/vin-check", key: "nav_vin" },
  { href: "/articles", key: "nav_knowledge" },
  { href: "/businesses", key: "nav_shops" },
  { href: "/about", key: "nav_about" },
];

function CartLink() {
  const { totalItems } = useCart();
  const { t } = useLang();
  return (
    <Link href="/cart" aria-label={t("nav_cart")} className="cbh-cart">
      <span className="cbh-cart-ico">🛒</span>
      {totalItems > 0 && <span className="cbh-cart-badge">{totalItems}</span>}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { lang, setLang, t } = useLang();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* utility bar */}
      <div className="cbh-util">
        <div className="cbh-wrap">
          <span>{t("ship_top")}</span>
          <span className="cbh-util-r">
            <a href="/intake">{t("diagnose")}</a>
            <a href={LINE_ADD} target="_blank" rel="noopener noreferrer">{t("contact")}</a>
            <span className="cbh-lang">
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
              <button className={lang === "th" ? "on" : ""} onClick={() => setLang("th")}>TH</button>
            </span>
          </span>
        </div>
      </div>

      {/* main nav */}
      <header className="cbh-nav">
        <div className="cbh-wrap cbh-navrow">
          <Link href="/" className="cbh-logo" aria-label="ChutiBenz">
            Chuti<b>Benz</b>
          </Link>

          <nav className="cbh-menu">
            {NAV.map((it) => {
              const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
              return (
                <Link key={it.href} href={it.href} className={active ? "active" : ""}>
                  {t(it.key)}
                </Link>
              );
            })}
          </nav>

          <div className="cbh-right">
            <CartLink />
            <Link href="/intake" className="cbh-cta">{t("cta_intake")}</Link>
            <button className="cbh-hamb" aria-label="Menu" onClick={() => setOpen(!open)}>
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {open && (
          <nav className="cbh-mobile">
            {NAV.map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)}>{t(it.key)}</Link>
            ))}
            <Link href="/cart" onClick={() => setOpen(false)}>🛒 {t("nav_cart")}</Link>
            <Link href="/intake" className="cbh-mobile-cta" onClick={() => setOpen(false)}>{t("cta_intake")}</Link>
          </nav>
        )}
      </header>
    </>
  );
}

const CSS = `
.cbh-util{background:#0f2416;color:#b3c0b3;font-size:12.5px}
.cbh-util .cbh-wrap{display:flex;justify-content:space-between;align-items:center;height:38px}
.cbh-util a{color:#cdd8cd;margin-left:16px;cursor:pointer;text-decoration:none}
.cbh-util a:hover{color:#fff}
.cbh-util-r{display:flex;align-items:center}
.cbh-lang{display:inline-flex;gap:5px;margin-left:16px}
.cbh-lang button{font-family:inherit;font-size:12px;border:none;background:none;color:#b3c0b3;cursor:pointer;padding:2px 8px;border-radius:11px}
.cbh-lang button.on{background:#B8895A;color:#17301F;font-weight:600}
.cbh-nav{background:#17301F;color:#F4EFE4;position:sticky;top:0;z-index:40}
.cbh-wrap{max-width:1160px;margin:0 auto;padding:0 22px}
.cbh-navrow{display:flex;align-items:center;gap:20px;height:60px}
.cbh-logo{font-family:Georgia,serif;font-size:22px;font-weight:500;letter-spacing:.5px;white-space:nowrap;color:#F4EFE4;text-decoration:none}
.cbh-logo b{color:#B8895A;font-weight:500}
.cbh-menu{display:flex;gap:18px;flex:1;font-size:14.5px}
.cbh-menu a{color:#cdd8cd;text-decoration:none;white-space:nowrap}
.cbh-menu a:hover,.cbh-menu a.active{color:#B8895A}
.cbh-right{display:flex;align-items:center;gap:10px}
.cbh-cart{position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;color:#F4EFE4;text-decoration:none}
.cbh-cart-ico{font-size:19px;line-height:1}
.cbh-cart-badge{position:absolute;top:2px;right:2px;min-width:17px;height:17px;padding:0 4px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#B8895A;color:#fff;font-size:10px;font-weight:700}
.cbh-cta{background:#B8895A;color:#17301F;font-weight:600;font-size:14px;padding:9px 16px;border-radius:9px;text-decoration:none;white-space:nowrap}
.cbh-cta:hover{background:#c99b70}
.cbh-hamb{display:none;font-size:22px;background:none;border:none;color:#F4EFE4;cursor:pointer}
.cbh-mobile{display:flex;flex-direction:column;padding:8px 22px 16px;gap:2px;background:#17301F;border-top:1px solid #244a32}
.cbh-mobile a{color:#cdd8cd;text-decoration:none;padding:9px 4px;font-size:15px}
.cbh-mobile a:hover{color:#B8895A}
.cbh-mobile-cta{background:#B8895A;color:#17301F!important;font-weight:600;border-radius:9px;text-align:center;margin-top:8px}
@media(max-width:900px){
  .cbh-menu{display:none}
  .cbh-cta{display:none}
  .cbh-hamb{display:block}
  .cbh-util-r a{display:none}
}
`;
