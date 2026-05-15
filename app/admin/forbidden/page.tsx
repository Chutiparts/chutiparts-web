// app/admin/forbidden/page.tsx — Shown when user logged in but lacks admin role
export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-gray-600 mb-6">
          คุณยังไม่ใช่ admin ของระบบ — ติดต่อทีมเพื่อขอสิทธิ์
        </p>
        <a href="/" className="text-blue-600 hover:underline">← กลับหน้าแรก</a>
      </div>
    </div>
  )
}
