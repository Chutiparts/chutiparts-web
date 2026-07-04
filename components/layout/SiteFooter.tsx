// components/layout/SiteFooter.tsx — ChutiBenz global footer (Racing green, TH/EN)
"use client";

import Link from "next/link";
import { useLang } from "@/app/context/LanguageContext";

export default function SiteFooter() {
  const { t } = useLang();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <footer className="cbf">
        <div className="cbf-wrap">
          <div className="cbf-cols">
            <div>
              <h4>ChutiBenz</h4>
              <p className="cbf-about">{t("ft_about")}</p>
            </div>
            <div>
              <h4>{t("ft_explore")}</h4>
              <Link href="/search">{t("nav_browse")}</Link>
              <Link href="/ebooks">{t("nav_ebooks")}</Link>
              <Link href="/vin-check">{t("nav_vin")}</Link>
              <Link href="/articles">{t("nav_knowledge")}</Link>
            </div>
            <div>
              <h4>{t("ft_contact")}</h4>
              <a href="https://line.me/R/ti/p/%40440ifncj" target="_blank" rel="noopener noreferrer">LINE: mr.chuti5988</a>
              <a href="https://wa.me/66818285855" target="_blank" rel="noopener noreferrer">WhatsApp: +66 81-828-5855</a>
              <a href="tel:0818285855">Tel: 081-828-5855</a>
            </div>
          </div>
          <div className="cbf-b">
            <span>{t("ft_rights")}</span>
            <span>{t("ft_badges")}</span>
          </div>
        </div>
      </footer>
    </>
  );
}

const CSS = `
.cbf{background:#17301F;color:#aeb2bd;padding:34px 0 24px;font-size:14px;margin-top:10px}
.cbf-wrap{max-width:1160px;margin:0 auto;padding:0 22px}
.cbf-cols{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:26px}
.cbf h4{color:#F4EFE4;font-size:15px;font-weight:500;margin:0 0 10px}
.cbf-about{margin:0;line-height:1.7;color:#9aa79b}
.cbf a{display:block;color:#aeb2bd;padding:3px 0;text-decoration:none}
.cbf a:hover{color:#B8895A}
.cbf-b{border-top:1px solid #244a32;margin-top:22px;padding-top:14px;font-size:12.5px;color:#7f8492;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media(max-width:860px){.cbf-cols{grid-template-columns:1fr}}
`;
