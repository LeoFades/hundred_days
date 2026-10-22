'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { daysBetween } from '@/lib/journey'
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

function EntryCard({ entry, label }: { entry?: CheckIn; label: string }) {
    if (!entry) return null
    return (
        <article className="flex flex-col gap-3 rounded border p-4">
            <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                <p className="font-medium">
                    Day {entry.day_number} · {entry.checkin_date}
                </p>
            </div>
            <p className="whitespace-pre-wrap text-sm">
                {entry.journal || <span className="text-gray-400">(no journal)</span>}
            </p>
            {entry.check_in_photos.length > 0 && (
                <EntryPhotos key={entry.id} paths={photoPaths(entry)} />
            )}
        </article>
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
        { label: 'Words written', value: checkIns.reduce((n, c) => n + wordCount(c.journal), 0).toLocaleString() },
        { label: 'Photos', value: checkIns.reduce((n, c) => n + c.check_in_photos.length, 0) },
    ]

    return (
        <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
            <Link href={`/journey/${id}`} className="text-sm text-gray-500 hover:underline">
                ← Back to journey
            </Link>

            {/* Header */}
            <header className="flex flex-col gap-1 text-center">
                <p className="text-4xl">🎉</p>
                <h1 className="text-3xl font-semibold">100 days of {journey.title}</h1>
                {first && last && (
                    <p className="text-gray-500">
                        {first.checkin_date} → {last.checkin_date}
                    </p>
                )}
            </header>

            {/* Stats */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {stats.map((s) => (
                    <div key={s.label} className="rounded border p-4 text-center">
                        <p className="text-2xl font-semibold">{s.value}</p>
                        <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                ))}
            </section>
            <p className="-mt-4 text-center text-sm text-gray-600">
                {missedDays > 0
                    ? `Took ${calendarDays} days, with ${missedDays} missed along the way.`
                    : 'Not a single day missed.'}
            </p>

            {/* Then vs now */}
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Then vs. now</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <EntryCard entry={first} label="Where you started" />
                    <EntryCard entry={last} label="Where you ended" />
                </div>
            </section>

            {/* Milestones in between */}
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Along the way</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <EntryCard entry={byDay.get(10)} label="Milestone" />
                    <EntryCard entry={byDay.get(50)} label="Milestone" />
                </div>
            </section>

            {/* Next */}
            <footer className="flex flex-wrap justify-center gap-3">
                <Link href={`/journey/${id}`} className="rounded border px-4 py-2 text-sm">
                    Browse all 100 days
                </Link>
                <Link href="/dashboard" className="rounded bg-black px-4 py-2 text-sm text-white">
                    Start another journey
                </Link>
            </footer>
        </main>
    )
}