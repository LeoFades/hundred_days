'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Window } from '@/components/retro'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handle(mode: 'login' | 'signup') {
    setError('')
    setLoading(true)

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)
    if (error) return setError(error.message)
    router.push('/dashboard')
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Window title="Log in to 100 Days" className="w-full max-w-sm" closeHref="/">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handle('login')
          }}
          className="flex flex-col gap-3"
        >
          <p>Type your email and password. New here? Fill them in and press Sign up.</p>

          <label className="flex flex-col gap-1">
            Email:
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </label>

          <label className="flex flex-col gap-1">
            Password (8+ characters):
            <input
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </label>

          {error && <p className="text-[#800000]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="submit" disabled={loading} className="btn btn-primary">
              Log in
            </button>
            <button type="button" disabled={loading} onClick={() => handle('signup')} className="btn">
              Sign up
            </button>
          </div>
        </form>
      </Window>
    </main>
  )
}
