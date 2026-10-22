'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

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
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
            <h1 className="text-2xl font-semibold">100 Days</h1>

            <input type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-sm rounded border px-3 py-2" />
            <input type="password" placeholder="Password (8+ characters)" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full max-w-sm rounded border px-3 py-2" />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex w-full max-w-sm gap-2">
                <button onClick={() => handle('login')} disabled={loading}
                    className="flex-1 rounded bg-black px-3 py-2 text-white disabled:opacity-50">
                    Log in
                </button>
                <button onClick={() => handle('signup')} disabled={loading}
                    className="flex-1 rounded border px-3 py-2 disabled:opacity-50">
                    Sign up
                </button>
            </div>
        </main>
    )
}