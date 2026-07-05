"use client";
// app/context/FlagsContext.tsx — Feature flags (เปิด/ปิดฟีเจอร์จาก Supabase site_settings)
// ดึงเองตอน mount ผ่าน anon (public read) · ฟีเจอร์เช็ค useFlag(key, fallback) ก่อนแสดง
// fallback = ค่าเริ่มถ้ายังโหลดไม่เสร็จ/ตารางยังไม่มี → ฟีเจอร์ที่ live ให้ fallback=true (ไม่หาย)

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/utils/supabase/client";

type Flags = Record<string, boolean>;
const FlagsCtx = createContext<{ flags: Flags; loaded: boolean }>({ flags: {}, loaded: false });

export function FlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Flags>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("site_settings").select("key,enabled");
        const m: Flags = {};
        (data || []).forEach((r: any) => { m[r.key] = !!r.enabled; });
        setFlags(m);
      } catch {}
      setLoaded(true);
    })();
  }, []);
  return <FlagsCtx.Provider value={{ flags, loaded }}>{children}</FlagsCtx.Provider>;
}

/** true = เปิด · fallback ใช้ตอนยังโหลดไม่เสร็จหรือไม่มี key นั้น */
export function useFlag(key: string, fallback = false): boolean {
  const { flags, loaded } = useContext(FlagsCtx);
  if (key in flags) return flags[key];
  return loaded ? fallback : fallback; // ยังไม่โหลด → ใช้ fallback (กันกระพริบสำหรับฟีเจอร์ที่ live)
}
