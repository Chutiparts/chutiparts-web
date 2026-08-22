-- ═══════════════════════════════════════════════════════════════════════
-- agent_lookup() — voice-agent product lookup as ONE security-definer RPC
-- ─────────────────────────────────────────────────────────────────────
-- ทำไม: worker(ไทย) เดิมยิงผ่าน Vercel(US)→Supabase(SG) = ข้ามแปซิฟิก 2 เด้ง 3-4s
--       ย้าย logic มาไว้ใน DB → worker เรียก rpc ตรง (ไทย→SG เด้งเดียว ~0.3s)
--       + logic อยู่ที่เดียว (worker และ /api/agent/lookup เรียกตัวเดียวกัน = ไม่ drift)
-- ปลอดภัย: security definer คืนเฉพาะ 5 ฟิลด์ (name, price, qty, compatible_models,
--          call_for_price) — ไม่คืนต้นทุน/PII · anon ได้แค่ EXECUTE ตัว rpc
--          (ยังอ่าน stock_records/products ตรงไม่ได้ — RLS lockdown 2026-08-09 คงเดิม)
-- พอร์ตจาก: app/api/agent/lookup/route.ts + lib/search-utils.ts (resolveAliases, scoreMatch)
-- idempotent: create or replace · อ่านอย่างเดียว (เขียนแค่ log best-effort) · รันซ้ำได้
--
-- 🔴 แก้ 2026-08-22 — SKU MODE เดิมค้นแค่ part_number → หลัง migration เปลี่ยน SKU
--    (20260822_tuner_sku_scheme.sql) ลูกค้าที่อ่าน "เลขที่ปั๊มบนตัวอะไหล่" ให้ทางโทรศัพท์
--    ได้คำตอบว่า "ไม่มีของ" ทั้งที่ของอยู่ในสต็อก · ตอนนี้ค้น oem_number_norm และ
--    alt_part_numbers ด้วย
--
-- ⚠️ ก่อนรันไฟล์นี้ทับของเดิม ให้เช็คก่อนว่าฟังก์ชันบน DB ตรงกับไฟล์นี้จริง (กัน drift):
--      select prosrc from pg_proc where proname = 'agent_lookup';
--    ถ้าต่างจากไฟล์นี้ในส่วนอื่นด้วย อย่ารันทับ — เอาเฉพาะบล็อก SKU MODE ไปแก้มือ
-- ═══════════════════════════════════════════════════════════════════════

-- ── helper: normalize (= normalizeText) ──────────────────────────────
create or replace function public._agent_norm(s text)
returns text language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(s,''), '\s+', ' ', 'g')))
$$;

-- ── helper: score 0-100 (= scoreMatch) ───────────────────────────────
create or replace function public._agent_score(p_q text, p_t text)
returns int language plpgsql immutable as $$
declare q text; t text; w text; m int := 0; n int := 0;
begin
  q := public._agent_norm(p_q); t := public._agent_norm(p_t);
  if q = '' then return 0; end if;
  if t = q then return 100; end if;
  if t like q || '%' then return 80; end if;
  if position(q in t) > 0 then return 60; end if;
  foreach w in array regexp_split_to_array(q, '\s+') loop
    n := n + 1;
    if w <> '' and position(w in t) > 0 then m := m + 1; end if;
  end loop;
  if n = 0 then return 0; end if;
  return round((m::numeric / n) * 40)::int;
end $$;

-- ── helper: compatible_models → jsonb array (รองรับ text[] / text / jsonb) ──
create or replace function public._agent_compat(v anyelement)
returns jsonb language plpgsql immutable as $$
declare j jsonb; s text;
begin
  if v is null then return '[]'::jsonb; end if;
  j := to_jsonb(v);
  if jsonb_typeof(j) = 'array' then return j; end if;
  if jsonb_typeof(j) = 'string' then
    s := btrim(j #>> '{}');
    if s = '' then return '[]'::jsonb; end if;
    return to_jsonb(regexp_split_to_array(s, '[,\s]+'));
  end if;
  return jsonb_build_array(j);
end $$;

-- ── helper: log ทุก query ลง search_queries channel=voice-agent (best-effort) ──
create or replace function public._agent_log(p_text text, p_resolved text, p_count int)
returns void language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into search_queries(query_text, resolved, model, channel, result_count, had_results)
    values (left(coalesce(p_text,''),200), left(coalesce(p_resolved,''),200),
            null, 'voice-agent', coalesce(p_count,0), coalesce(p_count,0) > 0);
  exception when others then null;  -- ห้ามทำให้ lookup ล้ม
  end;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
-- MAIN: agent_lookup(p_q, p_sku) → jsonb  (status: found | multiple | not_found)
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.agent_lookup(p_q text default '', p_sku text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sku  text := left(coalesce(btrim(p_sku), ''), 40);
  v_q    text := left(coalesce(btrim(p_q),   ''), 80);
  v_sku_norm    text;
  v_alias_canon text;
  v_search      text;
  v_raw_tokens  text[];
  v_tokens      text[];
  n_rows int := 0;
  rows_json jsonb;
  pick jsonb;
begin
  -- ================= SKU MODE =================
  if v_sku <> '' then
    v_sku_norm := regexp_replace(v_sku, '[^a-zA-Z0-9]', '', 'g');
    select jsonb_build_object(
             'name', s.name,
             'price', case when coalesce(s.price,0) > 0 then s.price else null end,
             'qty', s.live_qty,
             'compatible_models', public._agent_compat(s.compatible_models),
             'call_for_price', not (coalesce(s.price,0) > 0)
           )
      into pick
    from (
      select p.name, p.price, p.part_number, p.compatible_models,
             coalesce((select sum(sr.qty)::int from stock_records sr
                       where sr.sku = p.part_number and sr.deleted_at is null), 0) as live_qty,
             case when lower(regexp_replace(coalesce(p.part_number,''),'[^a-zA-Z0-9]','','g'))
                       = lower(v_sku_norm) then 2
                  when v_sku_norm <> '' and lower(coalesce(p.oem_number_norm,'')) = lower(v_sku_norm) then 1
                  else 0 end as is_exact
      from products p
      where p.is_published = true
        and (p.part_number ilike '%'||v_sku||'%'
             or (v_sku_norm <> '' and p.part_number_norm ilike '%'||v_sku_norm||'%')
             -- ลูกค้าอ่านเลขที่ปั๊มบนตัวอะไหล่ให้ทางโทรศัพท์ = เลข OEM ไม่ใช่ SKU ร้าน
             or (v_sku_norm <> '' and p.oem_number_norm ilike '%'||v_sku_norm||'%')
             -- รหัสเดิมของอะไหล่ที่เคยเปลี่ยน SKU (เก็บไว้ใน alt_part_numbers ตอน migration)
             -- ถ้าไม่มีบรรทัดนี้ พนักงาน/บิลเก่า/โพสต์เก่าที่ยังใช้รหัสเดิมจะได้คำตอบว่า "ไม่มีของ"
             or (v_sku_norm <> '' and exists (
                   select 1 from unnest(coalesce(p.alt_part_numbers, array[]::text[])) as alt
                    where regexp_replace(alt, '[^a-zA-Z0-9]', '', 'g') ilike '%'||v_sku_norm||'%'))
      order by is_exact desc
      limit 5
    ) s
    limit 1;

    perform public._agent_log(v_sku, v_sku, case when pick is null then 0 else 1 end);
    if pick is null then
      return jsonb_build_object('status','not_found','query',v_sku);
    end if;
    return jsonb_build_object('status','found','query',v_sku,'result',pick);
  end if;

  -- ================= VOICE MODE (q) =================
  if v_q = '' then
    return jsonb_build_object('status','not_found','query','','note','ต้องส่ง p_sku หรือ p_q');
  end if;

  -- resolveAliases: ทั้งประโยค (exact → substring)
  select canonical into v_alias_canon from search_aliases
   where active = true and alias ilike lower(v_q)
   order by weight desc nulls last limit 1;
  if v_alias_canon is null then
    select canonical into v_alias_canon from search_aliases
     where active = true and alias ilike '%'||lower(v_q)||'%'
     order by weight desc nulls last limit 1;
  end if;
  v_search := coalesce(v_alias_canon, v_q);

  -- tokenize (len>=2) + per-token alias (เหมือนหน้า /search)
  v_raw_tokens := array(select w from unnest(regexp_split_to_array(v_search,'\s+')) w
                        where char_length(w) >= 2);
  if coalesce(array_length(v_raw_tokens,1),0) >= 2 then
    v_tokens := array(
      select coalesce(
        (select a.canonical from search_aliases a
          where a.active = true and lower(a.alias) = lower(t)
          order by weight desc nulls last limit 1), t)
      from unnest(v_raw_tokens) t);
  else
    v_tokens := array[v_search];
  end if;

  -- ค้นสินค้า: ทุก token ต้องเจอ (AND) · จัดอันดับด้วย score · live qty จาก stock_records
  with matched as (
    select p.name, p.price, p.part_number, p.compatible_models,
           greatest(public._agent_score(v_search, coalesce(p.name,'')),
                    public._agent_score(v_search, coalesce(p.part_number,''))) as score,
           coalesce((select sum(sr.qty)::int from stock_records sr
                     where sr.sku = p.part_number and sr.deleted_at is null), 0) as live_qty
    from products p
    where p.is_published = true
      and not exists (
        -- token ที่ "ไม่ตรง" (is not true → null/false นับเป็นไม่ตรง กัน NULL poison)
        select 1 from unnest(v_tokens) tk
        where (
             p.name        ilike '%'||tk||'%'
          or p.description ilike '%'||tk||'%'
          or p.part_number ilike '%'||tk||'%'
          or p.oem_number  ilike '%'||tk||'%'
          or (regexp_replace(tk,'[^a-zA-Z0-9]','','g') <> '' and (
                p.part_number_norm ilike '%'||regexp_replace(tk,'[^a-zA-Z0-9]','','g')||'%'
             or p.oem_number_norm  ilike '%'||regexp_replace(tk,'[^a-zA-Z0-9]','','g')||'%'))
        ) is not true
      )
    order by score desc
    limit 20
  )
  select count(*)::int,
         jsonb_agg(
           jsonb_build_object(
             'name', name,
             'price', case when coalesce(price,0) > 0 then price else null end,
             'qty', live_qty,
             'compatible_models', public._agent_compat(compatible_models),
             'call_for_price', not (coalesce(price,0) > 0)
           ) order by score desc)
    into n_rows, rows_json
  from matched;

  n_rows := coalesce(n_rows, 0);
  perform public._agent_log(v_q, v_search, n_rows);

  if n_rows = 0 then
    return jsonb_build_object('status','not_found','query',v_q);
  elsif n_rows = 1 then
    return jsonb_build_object('status','found','query',v_q,'result', rows_json->0);
  else
    return jsonb_build_object(
      'status','multiple','query',v_q,'count',n_rows,
      'results', (select jsonb_agg(e) from (select e from jsonb_array_elements(rows_json) e limit 3) z));
  end if;
end $$;

-- ── grants: anon เรียกได้เฉพาะ rpc ตัวนี้ (คืนฟิลด์ปลอดภัยเท่านั้น) ──
revoke all on function public.agent_lookup(text,text) from public;
grant execute on function public.agent_lookup(text,text) to anon, authenticated, service_role;

-- ── ทดสอบเร็ว (รันแยกใน SQL editor) ──
-- select public.agent_lookup('', 'SW-AMG01');            -- โหมด sku
-- select public.agent_lookup('ไฟท้าย ปลาวาฬ', '');       -- โหมดคำพูด + alias
-- select public.agent_lookup('รหัสมั่วๆไม่มีจริง', '');   -- ควรได้ not_found
