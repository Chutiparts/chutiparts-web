#!/usr/bin/env bash
# seo-smoke.sh — ChutiBenz production SEO smoke test
# รัน:  bash scripts/seo-smoke.sh              (เช็ค production https://chutibenz.com)
#       bash scripts/seo-smoke.sh <URL>        (เช็คโดเมน/preview อื่น)
# ต้องมี curl และรันจากเครื่องที่ต่อเน็ตได้ (เช่น Mac) — ไม่ต้องพึ่ง AI ตัวอื่นมาเทส
# exit 0 = ผ่านหมด · exit 1 = มีจุดไม่ผ่าน (ใช้ต่อใน CI ได้)

set -uo pipefail
BASE="${1:-https://chutibenz.com}"

pass=0; fail=0; warn=0
g(){ printf '\033[32m%s\033[0m' "$1"; }; r(){ printf '\033[31m%s\033[0m' "$1"; }; y(){ printf '\033[33m%s\033[0m' "$1"; }
ok(){ echo "$(g '  ✅ PASS') $1"; pass=$((pass+1)); }
no(){ echo "$(r '  ❌ FAIL') $1"; fail=$((fail+1)); }
wn(){ echo "$(y '  ⚠️  WARN') $1"; warn=$((warn+1)); }
get(){ curl -s -m 20 "$1"; }
canon(){ echo "$1" | grep -oE 'rel="canonical" href="[^"]+"' | head -1 | sed -E 's/.*href="([^"]+)"/\1/'; }

echo "════════════════════════════════════════════════════"
echo " ChutiBenz SEO smoke test"
echo " target : $BASE"
echo " time   : $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════"

# [0] เว็บออนไลน์
echo; echo "[0] เว็บออนไลน์"
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$BASE")
[ "$code" = "200" ] && ok "หน้าแรกตอบ 200" || no "หน้าแรกตอบ $code (คาดหวัง 200)"

# [1] sitemap: โดเมนถูก + มีบทความ
echo; echo "[1] sitemap"
SM=$(get "$BASE/sitemap.xml")
if echo "$SM" | grep -q 'vercel\.app'; then no "sitemap ยังมี vercel.app (โดเมนผิด)"; else ok "sitemap ไม่มี vercel.app"; fi
art_urls=$(echo "$SM" | grep -oE "${BASE}/articles/[a-z0-9-]+" | sort -u)
n_art=$(printf '%s\n' "$art_urls" | grep -c . || true)
[ "${n_art:-0}" -ge 1 ] && ok "sitemap มีบทความ $n_art รายการ" || no "sitemap ไม่มีบทความเลย"

# [2] ไล่เช็คทุกบทความจาก sitemap
echo; echo "[2] บทความแต่ละหน้า (ดึงจาก sitemap)"
if [ -z "$art_urls" ]; then wn "ข้ามเพราะ sitemap ไม่มีบทความ"; else
  while IFS= read -r u; do
    [ -z "$u" ] && continue
    H=$(get "$u"); slug="${u##*/}"
    can=$(canon "$H")
    tw=$(echo "$H" | grep -oE 'name="twitter:title" content="[^"]+"' | head -1 | sed -E 's/.*content="([^"]+)"/\1/')
    ogu=$(echo "$H" | grep -oE 'property="og:url" content="[^"]+"' | head -1 | sed -E 's/.*content="([^"]+)"/\1/')
    [ "$can" = "$u" ] && ok "$slug · canonical ชี้ตัวเอง" || no "$slug · canonical='${can:-ว่าง}' (ควร=$u)"
    if echo "$tw" | grep -q 'คลังอะไหล่'; then no "$slug · twitter:title ติดค่าหน้าแรก"; else ok "$slug · twitter:title เฉพาะหน้า"; fi
    [ "$ogu" = "$u" ] && ok "$slug · og:url ถูก" || wn "$slug · og:url='${ogu:-ว่าง}'"
    if echo "$H" | grep -oE '฿[0-9][0-9,]*' | grep -qx '฿0'; then no "$slug · เจอราคา ฿0 (ควรเป็น 'สอบถามราคา')"; else ok "$slug · ไม่มี ฿0"; fi
  done <<< "$art_urls"
fi

# [3] /intake มีเนื้อหาจริง + canonical
echo; echo "[3] /intake"
IN=$(get "$BASE/intake")
echo "$IN" | grep -q 'ข้อมูลที่ควรเตรียม' && ok "/intake มีเนื้อหาจริงใน HTML" || no "/intake ไม่เจอเนื้อหา (หน้าเปล่า?)"
cin=$(canon "$IN"); [ "$cin" = "$BASE/intake" ] && ok "/intake canonical ชี้ตัวเอง" || no "/intake canonical='${cin:-ว่าง}'"

# [4] /ask + [5] /articles canonical
echo; echo "[4] /ask & /articles"
cask=$(canon "$(get "$BASE/ask")"); [ "$cask" = "$BASE/ask" ] && ok "/ask canonical ชี้ตัวเอง" || no "/ask canonical='${cask:-ว่าง}'"
cart=$(canon "$(get "$BASE/articles")"); [ "$cart" = "$BASE/articles" ] && ok "/articles canonical ชี้ตัวเอง" || no "/articles canonical='${cart:-ว่าง}'"

# [6] LINE id เก่า (mr.chuti5988) ต้องไม่โผล่หน้าไหนเลย — ลิงก์เก่า 404
echo; echo "[6] LINE id เก่า (ต้องหายทุกหน้า)"
for p in "" "/privacy" "/quote" "/articles"; do
  if get "$BASE$p" | grep -q 'mr\.chuti5988'; then no "หน้า ${p:-/} ยังเจอ mr.chuti5988 (ควรเป็น @440ifncj)"; else ok "หน้า ${p:-/} สะอาด (ไม่มี id เก่า)"; fi
done

echo; echo "════════════════════════════════════════════════════"
echo " สรุป:  $(g "PASS $pass")   $(r "FAIL $fail")   $(y "WARN $warn")"
echo "════════════════════════════════════════════════════"
if [ "$fail" -eq 0 ]; then echo "$(g '✅ ผ่านหมด — ของขึ้น production ครบ')"; exit 0
else echo "$(r '❌ มีจุดไม่ผ่าน — ดูบรรทัด FAIL ด้านบน แล้วแก้/redeploy')"; exit 1; fi
