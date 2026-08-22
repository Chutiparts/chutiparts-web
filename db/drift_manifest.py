#!/usr/bin/env python3
"""คำนวณ body_md5 / body_len ของทุกฟังก์ชันในไฟล์ .sql ของ repo
เอาไว้เทียบกับคอลัมน์ body_md5 / body_len ที่ได้จาก db/check_drift.sql

🔴 ครอบแค่ body (ข้อความระหว่าง $$ ... $$) เท่านั้น — เหมือนที่ Postgres เก็บใน prosrc
   ไม่ครอบหัวฟังก์ชัน (args / returns / security definer / set search_path / volatility)
   ของพวกนั้นดูที่คอลัมน์ full_md5 + security_definer + volatility + config แทน

ใช้:  python3 db/drift_manifest.py [ไฟล์.sql ...]     (ไม่ใส่ = ทุกไฟล์ใน db/)
"""
import sys, io, re, hashlib, pathlib

FUNC_RE = re.compile(
    r'create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_."]+)\s*\(', re.I)


def bodies(path):
    """คืน (ชื่อฟังก์ชัน, body) ทีละตัว — body = ข้อความระหว่าง $$ คู่แรกหลังหัวฟังก์ชัน"""
    src = io.open(path, encoding='utf-8').read()
    for m in FUNC_RE.finditer(src):
        name = m.group(1).replace('"', '')
        seg = src[m.end():]
        try:
            a = seg.index('$$') + 2
            b = seg.index('$$', a)
        except ValueError:
            continue                      # ไม่ได้ใช้ dollar-quoting — ข้าม
        yield name, seg[a:b]


def main(paths):
    print(f"{'function':28} {'body_len':>9}  body_md5")
    print('-' * 76)
    n = 0
    for p in paths:
        for name, body in bodies(p):
            n += 1
            print(f"{name:28} {len(body):>9}  {hashlib.md5(body.encode()).hexdigest()}")
    if not n:
        print('(ไม่พบฟังก์ชันที่ใช้ $$ ในไฟล์ที่ระบุ)')
    print('-' * 76)
    print('เทียบกับคอลัมน์ body_md5 / body_len จาก db/check_drift.sql')
    print('⚠️ ต่างกัน ≠ พัง — แปลว่าข้อความไม่เหมือนกันเป๊ะ (คอมเมนต์ต่างก็ทำให้ต่างได้)')
    print('   ถ้าอยากให้ DB = repo ให้เอาไฟล์ใน repo วางทับอีกรอบ (create or replace รันซ้ำได้)')


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        args = sorted(str(p) for p in pathlib.Path('db').rglob('*.sql'))
    main(args)
