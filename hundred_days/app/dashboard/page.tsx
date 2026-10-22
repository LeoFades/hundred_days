'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { JourneyCard, summarize, type JourneyRow } from './journey-card'

const URGENCY = { 'last-chance': 0, due: 1, done: 2 } as const

export default function DashboardPage() {
    const router = useRouter()
    const [email, setEmail] = useState<string | null>(null)
    const [journeys, setJourneys] = useState<JourneyRow[]>([])
    const [title, setTitle] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const loadJourneys = useCallback(async () => {
        await supabase.rpc('refresh_my_journeys')
        const { data } = await supabase
            .from('journeys')
            .select('id, title, status, start_date, timezone, ended_at, check_ins(checkin_date)')
            .order('created_at', { ascending: false })
        setJourneys(data ?? [])
    }, [])

    useEffect(() => {
        async function init() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return router.replace('/login')
            setEmail(user.email ?? '')
            await loadJourneys()
        }
        init()
    }, [router, loadJourneys])

    async function createJourney(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return
        setError('')
        setSaving(true)

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        const { error } = await supabase
            .from('journeys')
            .insert({ title: title.trim(), timezone })

        setSaving(false)
        if (error) return setError(error.message)
        setTitle('')
        await loadJourneys()
    }

    async function signOut() {
        await supabase.auth.signOut()
        router.replace('/login')
    }

    if (email === null) return <p className="p-6">Loading…</p>

    // Active: most urgent first. Past: everything else, newest first.
    const active = journeys
        .filter((j) => j.status === 'active')
        .sort((a, b) => URGENCY[summarize(a).today!] - URGENCY[summarize(b).today!])
    const past = journeys.filter((j) => j.status !== 'active')

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Your journeys</h1>
                <button onClick={signOut} className="rounded border px-3 py-1 text-sm">
                    Sign out
                </button>
            </header>
            <p className="text-sm text-gray-500">Logged in as {email}</p>

            {/* New journey */}
            {active.length < 2 ? (
                <form onSubmit={createJourney} className="flex flex-col gap-2 rounded border p-4">
                    <label className="text-sm font-medium">Start a new 100-day journey</label>
                    <div className="flex gap-2">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                            placeholder="e.g. Draw every day"
                            className="flex-1 rounded border px-3 py-2"
                        />
                        <button
                            disabled={saving || !title.trim()}
                            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
                        >
                            {saving ? 'Starting…' : 'Start'}
                        </button>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </form>
            ) : (
                <p className="rounded border p-4 text-sm text-gray-600">
                    You have 2 active journeys. Finish one to start another.
                </p>
            )}

            {/* Active */}
            <section className="flex flex-col gap-2">
                <h2 className="font-medium">Active</h2>
                {active.length ? (
                    active.map((j) => <JourneyCard key={j.id} journey={j} />)
                ) : (
                    <p className="text-sm text-gray-500">No active journeys. Start one above.</p>
                )}
            </section>

            {/* Past */}
            {past.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="font-medium">Past</h2>
                    {past.map((j) => <JourneyCard key={j.id} journey={j} />)}
                </section>
            )}
        </main>
    )
}