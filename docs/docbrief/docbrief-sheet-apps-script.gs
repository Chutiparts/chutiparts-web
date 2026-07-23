/**
 * docbrief → Google Sheet (Apps Script Web App)
 * วางสคริปต์นี้ใน Google Sheet ที่จะใช้เก็บเอกสาร แล้ว Deploy เป็น Web App
 *
 * วิธีติดตั้ง (ทำครั้งเดียว):
 *  1. เปิด Google Sheet ที่ต้องการ
 *  2. เมนู  ส่วนขยาย (Extensions) → Apps Script
 *  3. ลบโค้ดเดิมทั้งหมด แล้ววางไฟล์นี้ลงไป
 *  4. แก้ SECRET ด้านล่างเป็นรหัสลับที่คุณตั้งเอง (ยาว ๆ เดายาก)
 *  5. กด  Deploy → New deployment
 *       - Type: Web app
 *       - Execute as: Me
 *       - Who has access: Anyone       ← จำเป็น (เราป้องกันด้วย SECRET แทน)
 *  6. copy Web app URL ที่ได้
 *  7. ใส่ใน .env.local ของโปรเจกต์:
 *       DOCBRIEF_SHEET_WEBHOOK_URL=<Web app URL>
 *       DOCBRIEF_SHEET_SECRET=<SECRET ตัวเดียวกับข้างล่าง>
 */

// ⚠️ เปลี่ยนเป็นรหัสลับของคุณเอง แล้วใช้ค่าเดียวกันใน .env.local
var SECRET = 'CHANGE-ME-เปลี่ยนเป็นรหัสลับยาวๆ';

// ชื่อแท็บที่จะเขียนลง (สร้างให้อัตโนมัติถ้ายังไม่มี)
var SHEET_NAME = 'documents';

// คอลัมน์ A–N ตามสเปก §10 — ห้ามสลับลำดับ
var HEADERS = [
  'export_key', 'doc_id', 'vendor_name', 'vendor_tax_id', 'doc_no', 'doc_date',
  'subtotal', 'vat', 'grand_total', 'currency', 'source',
  'confirmed_by', 'confirmed_at', 'exported_at',
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    if (body.secret !== SECRET) {
      return json({ ok: false, error: 'unauthorized' });
    }

    var row = body.row;
    if (!row || !row.export_key) {
      return json({ ok: false, error: 'missing export_key' });
    }

    var sheet = getSheet();

    // ---- กันซ้ำอีกชั้น: ถ้า export_key นี้มีอยู่แล้วในคอลัมน์ A ให้คืนแถวเดิม ----
    var keys = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0] === row.export_key) {
        return json({ ok: true, row: String(i + 2), duplicate: true });
      }
    }

    // ---- append ----
    var values = HEADERS.map(function (h) {
      var v = row[h];
      return v === undefined || v === null ? '' : v;
    });
    sheet.appendRow(values);

    return json({ ok: true, row: String(sheet.getLastRow()) });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
