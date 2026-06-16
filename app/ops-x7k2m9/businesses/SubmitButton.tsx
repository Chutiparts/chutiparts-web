'use client'
// app/ops-x7k2m9/businesses/SubmitButton.tsx
// ปุ่ม submit ที่มีสถานะ "กำลังทำงาน…" + กดได้ครั้งเดียว (กันกดซ้ำ → กัน insert ซ้ำ)
import { useFormStatus } from 'react-dom'

export function SubmitButton({
  children, pendingText, className,
}: {
  children: React.ReactNode
  pendingText: string
  className: string
}) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${className} ${pending ? 'opacity-60 cursor-wait' : ''}`}>
      {pending ? pendingText : children}
    </button>
  )
}
