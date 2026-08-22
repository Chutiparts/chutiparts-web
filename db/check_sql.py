#!/usr/bin/env python3
"""ตรวจไวยากรณ์ไฟล์ .sql ด้วยพาร์เซอร์ของ PostgreSQL ตัวจริง (libpg_query ผ่าน pglast)

ทำไมต้องมี: 2026-08-22 มีการแก้ agent_lookup_fn.sql แล้วลืมปิดวงเล็บ 1 ตัว
ไฟล์ "ดูปกติ" ทุกอย่าง แต่พอเอาไปรันบน Supabase ล้มด้วยข้อความที่ชี้ผิดที่
("INTO specified more than once" ที่บรรทัด 144 ทั้งที่ต้นเหตุอยู่บรรทัด 113)
เพราะวงเล็บที่ค้างทำให้พาร์เซอร์กลืนคำสั่งถัดไปเรื่อย ๆ

⚠️ parse_sql มอง body ใน $$...$$ เป็นแค่ string literal → จับ bug ใน plpgsql ไม่ได้
   ต้องเรียก parse_plpgsql แยกต่อฟังก์ชัน ซึ่งสคริปต์นี้ทำให้แล้ว

ใช้:  pip install pglast && python3 db/check_sql.py db/agent/agent_lookup_fn.sql
คืน exit 1 เมื่อพัง — เอาไปต่อใน pre-commit / CI ได้
"""
import sys, io
from pglast import parse_sql, parse_plpgsql
from pglast.parser import ParseError


def check(path: str) -> bool:
    src = io.open(path, encoding='utf-8').read()
    print(f"ตรวจ {path}")
    try:
        stmts = parse_sql(src)
        print(f"  ✅ SQL ระดับบนสุด parse ผ่าน — {len(stmts)} statement")
    except ParseError as e:
        print(f"  ❌ SQL parse ล้ม: {e}")
        return False

    for st in stmts:
        node = st.stmt
        if type(node).__name__ != 'CreateFunctionStmt':
            continue
        name = '.'.join(x.sval for x in node.funcname)
        lang = next((o.arg.sval for o in (node.options or []) if o.defname == 'language'), None)
        if lang != 'plpgsql':
            print(f"  ⏭  {name} (language={lang}) — ข้าม")
            continue
        one = src[st.stmt_location: st.stmt_location + st.stmt_len]
        try:
            parse_plpgsql(one)
            print(f"  ✅ {name} — plpgsql body parse ผ่าน")
        except ParseError as e:
            print(f"  ❌ {name} — plpgsql body ล้ม: {e}")
            return False
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(f"ใช้: {sys.argv[0]} <ไฟล์.sql> [ไฟล์.sql ...]")
    sys.exit(0 if all([check(p) for p in sys.argv[1:]]) else 1)
