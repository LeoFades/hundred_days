'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { StatusBar, Window } from '@/components/retro'
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
    <main className="mx-auto flex max-w-4xl flex-col px-4 py-8">
      <Window title="100 Days · My journeys" bodyClassName="">
        <nav className="menubar">
          <span className="mr-auto truncate px-2 text-xs text-[#303030]">{email}</span>
          <button onClick={signOut} className="menu-item">
            Sign out
          </button>
        </nav>

        <div className="flex flex-col gap-5 p-4">
          <h1 className="font-pixel text-3xl font-semibold">My journeys</h1>

          {/* New journey */}
          {active.length < 2 ? (
            <fieldset className="border border-[#808080] p-3">
              <legend className="px-1">Start a new 100-day journey</legend>
              <form onSubmit={createJourney} className="flex flex-wrap gap-2">
                <label htmlFor="journey-title" className="sr-only">
                  Journey name
                </label>
                <input
                  id="journey-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Draw every day"
                  className="field min-w-[200px] flex-1"
                />
                <button disabled={saving || !title.trim()} className="btn btn-primary">
                  {saving ? 'Starting…' : 'Start'}
                </button>
              </form>
              {error && <p className="mt-2 text-[#800000]">{error}</p>}
            </fieldset>
          ) : (
            <p className="sunken bg-white p-3">
              You have 2 active journeys. Finish one to start another.
            </p>
          )}

          {/* Active */}
          <section className="flex flex-col gap-2">
            <h2 className="font-bold">Active ({active.length} of 2)</h2>
            {active.length ? (
              <ul className="flex flex-col gap-2">
                {active.map((j) => (
                  <li key={j.id}>
                    <JourneyCard journey={j} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[#303030]">No active journeys. Start one above.</p>
            )}
          </section>

          {/* Past */}
          {past.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-bold">Past ({past.length})</h2>
              <ul className="flex flex-col gap-2">
                {past.map((j) => (
                  <li key={j.id}>
                    <JourneyCard journey={j} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <StatusBar
          items={[
            `${active.length} of 2 active`,
            `${past.length} past`,
            `${journeys.filter((j) => j.status === 'completed').length} completed`,
          ]}
        />
      </Window>
    </main>
  )
}
