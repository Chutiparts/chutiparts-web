/**
 * docbrief → Google Sheet (Apps Script Web App) — เวอร์ชัน hardened
 *
 * ป้องกัน 4 ชั้น:
 *   1. HMAC signature — รหัสลับไม่ถูกส่งผ่านเน็ต (แค่ลายเซ็นที่คำนวณจากรหัส)
 *   2. Timestamp — คำขอเก่ากว่า 5 นาทีถูกปฏิเสธ (กันดักจับแล้วยิงซ้ำ)
 *   3. Rate limit — เขียนได้ไม่เกิน 60 แถว/นาที
 *   4. บันทึกทุกคำขอที่ถูกปฏิเสธ (ดูได้ที่ Executions)
 *
 * ── วิธีติดตั้ง/อัปเดต ──────────────────────────────────
 *  1. Extensions → Apps Script → วางไฟล์นี้ทับของเดิม
 *  2. แก้ SECRET ด้านล่างให้ตรงกับ DOCBRIEF_SHEET_SECRET ใน .env.local + Vercel
 *  3. Cmd+S บันทึก
 *  4. Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *     (ใช้ Manage deployments เพื่อให้ URL เดิมไม่เปลี่ยน)
 *
 * ── ช่วงเปลี่ยนผ่าน ─────────────────────────────────────
 *  ALLOW_LEGACY = true  → รับทั้งแบบเก่า (secret ตรง ๆ) และแบบใหม่ (signature)
 *                          ใช้ระหว่างที่เว็บยังไม่ deploy โค้ดใหม่ จะได้ไม่พัง
 *  พอเว็บ deploy เสร็จและทดสอบผ่านแล้ว → เปลี่ยนเป็น false แล้ว deploy ซ้ำ
 */

// ⚠️ ต้องตรงกับ DOCBRIEF_SHEET_SECRET
var SECRET = 'CHANGE-ME-ใส่รหัสเดียวกับใน-env-local';

// ตั้งเป็น false หลังเว็บ deploy โค้ดใหม่แล้ว (ปิดทางเก่าให้สนิท)
var ALLOW_LEGACY = true;

var SHEET_NAME = 'documents';
var MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 นาที
var MAX_WRITES_PER_MIN = 60;

// คอลัมน์ A–N ตามสเปก §10 — ห้ามสลับลำดับ
var HEADERS = [
  'export_key', 'doc_id', 'vendor_name', 'vendor_tax_id', 'doc_no', 'doc_date',
  'subtotal', 'vat', 'grand_total', 'currency', 'source',
  'confirmed_by', 'confirmed_at', 'exported_at',
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return reject('no body');

    var body = JSON.parse(e.postData.contents);
    var row = null;

    // ---- ชั้น 1+2: ตรวจ signature + timestamp (ทางใหม่) ----
    if (body.sig && body.ts && body.payload) {
      var age = Math.abs(Date.now() - Number(body.ts));
      if (!(age < MAX_CLOCK_SKEW_MS)) return reject('stale request (' + Math.round(age / 1000) + 's)');

      var expected = sign(String(body.ts) + '.' + body.payload);
      if (!safeEqual(expected, String(body.sig))) return reject('bad signature');

      row = JSON.parse(body.payload);

    // ---- ทางเก่า (ปิดได้ด้วย ALLOW_LEGACY) ----
    } else if (ALLOW_LEGACY && body.secret) {
      if (body.secret !== SECRET) return reject('bad secret');
      row = body.row;
      Logger.log('WARN: ใช้ทางเก่า (secret ตรง ๆ) — ควรอัปเดตฝั่งเว็บให้ใช้ signature');

    } else {
      return reject('missing signature');
    }

    if (!row || !row.export_key) return reject('missing export_key');

    // ---- ชั้น 3: rate limit ----
    if (!underRateLimit()) return reject('rate limit exceeded');

    var sheet = getSheet();

    // กันซ้ำ: ถ้า export_key นี้มีแล้ว คืนแถวเดิม
    var last = sheet.getLastRow();
    if (last >= 2) {
      var keys = sheet.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (keys[i][0] === row.export_key) {
          return json({ ok: true, row: String(i + 2), duplicate: true });
        }
      }
    }

    sheet.appendRow(HEADERS.map(function (h) {
      var v = row[h];
      return v === undefined || v === null ? '' : v;
    }));

    return json({ ok: true, row: String(sheet.getLastRow()) });
  } catch (err) {
    Logger.log('ERROR: ' + err);
    return json({ ok: false, error: String(err) });
  }
}

// ===== ความปลอดภัย =====

function sign(message) {
  var raw = Utilities.computeHmacSha256Signature(message, SECRET);
  return raw.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

/** เทียบแบบใช้เวลาคงที่ — กันเดาทีละตัวจากเวลาที่ตอบกลับ */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function underRateLimit() {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'w' + Math.floor(Date.now() / 60000); // หน้าต่างละ 1 นาที
    var n = Number(cache.get(key) || 0) + 1;
    cache.put(key, String(n), 120);
    return n <= MAX_WRITES_PER_MIN;
  } catch (err) {
    return true; // cache พัง → ปล่อยผ่าน ดีกว่าบล็อกงานจริง
  }
}

/** ปฏิเสธ + บันทึกไว้ดูย้อนหลังได้ที่ Executions */
function reject(reason) {
  Logger.log('REJECTED: ' + reason);
  return json({ ok: false, error: 'unauthorized' }); // ไม่บอกเหตุผลจริงกับผู้เรียก
}

// ===== Sheet =====

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== เครื่องมือ =====

/** รันเพื่อสร้างแท็บ documents + ขอสิทธิ์ครั้งแรก */
function setup() {
  var s = getSheet();
  Logger.log('พร้อมใช้งาน · แท็บ: ' + s.getName() + ' · แถวปัจจุบัน: ' + s.getLastRow());
}
