'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { daysBetween } from '@/lib/journey'
import { StatusBar, Window } from '@/components/retro'
import { EntryPhotos } from '../entry-photos'

type Photo = { storage_path: string; position: number }
type CheckIn = {
  id: string
  day_number: number
  checkin_date: string
  journal: string
  check_in_photos: Photo[]
}
type Journey = { id: string; title: string; status: string }

function photoPaths(c: CheckIn) {
  return [...c.check_in_photos].sort((a, b) => a.position - b.position).map((p) => p.storage_path)
}

function wordCount(text: string) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function EntryWindow({ entry, label }: { entry?: CheckIn; label: string }) {
  if (!entry) return null
  return (
    <Window title={`Day ${entry.day_number} · ${label}`} className="min-w-0">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-[#303030]">{entry.checkin_date}</p>
        <p className="sunken whitespace-pre-wrap bg-white p-3 font-mono">
          {entry.journal || <span className="text-[#505050]">(no journal)</span>}
        </p>
        {entry.check_in_photos.length > 0 && (
          <EntryPhotos key={entry.id} paths={photoPaths(entry)} />
        )}
      </div>
    </Window>
  )
}

export default function FinishView() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [journey, setJourney] = useState<Journey | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')

      const { data: j } = await supabase
        .from('journeys')
        .select('id, title, status')
        .eq('id', id)
        .maybeSingle()

      // Only finished journeys get this page
      if (!j || j.status !== 'completed') return router.replace(`/journey/${id}`)

      const { data: c } = await supabase
        .from('check_ins')
        .select('id, day_number, checkin_date, journal, check_in_photos(storage_path, position)')
        .eq('journey_id', id)
        .order('day_number')

      setJourney(j)
      setCheckIns(c ?? [])
    }
    load()
  }, [id, router])

  if (!journey) return <p className="p-6">Loading…</p>

  // ---------- Stats ----------
  const byDay = new Map(checkIns.map((c) => [c.day_number, c]))
  const first = byDay.get(1)
  const last = byDay.get(100)
  const calendarDays = first && last ? daysBetween(first.checkin_date, last.checkin_date) + 1 : 100
  const missedDays = calendarDays - 100

  const stats = [
    { label: 'Check-ins', value: checkIns.length },
    { label: 'Journal entries', value: checkIns.filter((c) => c.journal.trim()).length },
    {
      label: 'Words written',
      value: checkIns.reduce((n, c) => n + wordCount(c.journal), 0).toLocaleString(),
    },
    { label: 'Photos', value: checkIns.reduce((n, c) => n + c.check_in_photos.length, 0) },
  ]

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-4 py-8">
      <Window title="Congratulations!" closeHref={`/journey/${id}`} bodyClassName="">
        <div className="flex flex-col gap-6 p-4">
          {/* Header */}
          <header className="flex items-start gap-4">
            <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
              <circle cx="16" cy="16" r="13" fill="#008000" stroke="#000" strokeWidth="2" />
              <path d="M9 16 L14 21 L23 11" fill="none" stroke="#fff" strokeWidth="3" />
            </svg>
            <div className="flex flex-col gap-1">
              <h1 className="font-pixel text-3xl font-semibold">100 days of {journey.title}</h1>
              {first && last && (
                <p className="text-[#303030]">
                  {first.checkin_date} → {last.checkin_date}
                </p>
              )}
              <p>
                {missedDays > 0
                  ? `Took ${calendarDays} days, with ${missedDays} missed along the way.`
                  : 'Not a single day missed.'}
              </p>
            </div>
          </header>

          {/* Stats */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="sunken bg-white p-3 text-center">
                <p className="font-pixel text-3xl font-semibold text-[#000080]">{s.value}</p>
                <p className="text-xs text-[#303030]">{s.label}</p>
              </div>
            ))}
          </section>

          {/* Then vs now */}
          <section className="flex flex-col gap-3">
            <h2 className="font-pixel text-xl font-semibold">Then vs. now</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <EntryWindow entry={first} label="Where you started" />
              <EntryWindow entry={last} label="Where you ended" />
            </div>
          </section>

          {/* Milestones in between */}
          <section className="flex flex-col gap-3">
            <h2 className="font-pixel text-xl font-semibold">Along the way</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <EntryWindow entry={byDay.get(10)} label="Milestone" />
              <EntryWindow entry={byDay.get(50)} label="Milestone" />
            </div>
          </section>

          {/* Next */}
          <footer className="flex flex-wrap justify-end gap-2">
            <Link href={`/journey/${id}`} className="btn">
              Browse all 100 days
            </Link>
            <Link href="/dashboard" className="btn btn-primary">
              Start another journey
            </Link>
          </footer>
        </div>

        <StatusBar items={['Journey complete', `${calendarDays} calendar days`, `${missedDays} missed`]} />
      </Window>
    </main>
  )
}
