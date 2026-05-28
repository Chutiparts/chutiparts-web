// app/admin/login/page.tsx — Simple admin login
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

function AdminLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/admin/inbox'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push(next)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
      <h1 className="text-2xl font-bold text-center mb-1">🔐 Admin Login</h1>
      <p className="text-sm text-gray-500 text-center mb-6">ChutiBenz Operations</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded mb-4">
          {error}
        </div>
      )}

      <input
        type="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full border-2 border-gray-300 rounded-lg p-3 mb-3 focus:border-yellow-500 focus:outline-none"
      />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full border-2 border-gray-300 rounded-lg p-3 mb-4 focus:border-yellow-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-bold py-3 rounded-lg"
      >
        {loading ? 'กำลังเข้าระบบ...' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Suspense fallback={<div className="text-gray-500">กำลังโหลด...</div>}>
        <AdminLoginForm />
      </Suspense>
    </div>
  )
}
