'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { EntryPhotos } from './entry-photos'
import { MILESTONES, todayIn, daysBetween } from '@/lib/journey'

type Journey = {
    id: string
    title: string
    status: 'active' | 'completed' | 'failed'
    start_date: string
    timezone: string
}
type Photo = { storage_path: string; position: number }
type CheckIn = {
    id: string
    day_number: number
    checkin_date: string
    journal: string
    check_in_photos: Photo[]
}


const MAX_PHOTOS = 3





function errorMessage(err: unknown) {
    return (err as { message?: string })?.message ?? 'Something went wrong.'
}

export default function JourneyView() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [userId, setUserId] = useState('')
    const [journey, setJourney] = useState<Journey | null>(null)
    const [checkIns, setCheckIns] = useState<CheckIn[]>([])
    const [notFound, setNotFound] = useState(false)
    const [selected, setSelected] = useState<CheckIn | null>(null)
    const [journal, setJournal] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    // Preview URLs for picked photos (cleaned up when the list changes)
    const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
    useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.replace('/login')
        setUserId(user.id)

        await supabase.rpc('refresh_my_journeys')

        const { data: j } = await supabase
            .from('journeys')
            .select('id, title, status, start_date, timezone')
            .eq('id', id)
            .maybeSingle()
        if (!j) return setNotFound(true)

        const { data: c } = await supabase
            .from('check_ins')
            .select('id, day_number, checkin_date, journal, check_in_photos(storage_path, position)')
            .eq('journey_id', id)
            .order('day_number')

        setJourney(j)
        setCheckIns(c ?? [])
    }, [id, router])

    useEffect(() => {
        load()
    }, [load])

    if (notFound) {
        return (
            <main className="p-6">
                <p>Journey not found.</p>
                <Link href="/dashboard" className="underline">Back to dashboard</Link>
            </main>
        )
    }
    if (!journey) return <p className="p-6">Loading…</p>

    // ---------- Derived state ----------
    const today = todayIn(journey.timezone)
    const done = checkIns.length
    const last = checkIns.at(-1)
    const checkedInToday = last?.checkin_date === today
    const gap = last
        ? daysBetween(last.checkin_date, today)
        : daysBetween(journey.start_date, today) + 1
    const isActive = journey.status === 'active'
    const missedYesterday = isActive && !checkedInToday && gap === 2
    const nextDay = done + 1
    const journalRequired = MILESTONES.includes(nextDay)
    const canCheckIn = isActive && !checkedInToday
    const byDay = new Map(checkIns.map((c) => [c.day_number, c]))

    function pickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
        const picked = Array.from(e.target.files ?? [])
        setFiles((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS))
        e.target.value = '' // allow picking the same file again after removing it
    }

    async function submitCheckIn(e: React.FormEvent) {
        e.preventDefault()
        if (!journey) return
        if (journalRequired && !journal.trim()) {
            return setError(`Day ${nextDay} is a milestone. Write a journal entry.`)
        }
        setError('')
        setSaving(true)

        try {
            // 1. Compress first, so a bad photo stops everything before saving
            const blobs = await Promise.all(files.map(compressImage))

            // 2. Save the check-in
            const { data: checkIn, error: ciError } = await supabase
                .from('check_ins')
                .insert({ journey_id: journey.id, journal: journal.trim() })
                .select('id')
                .single()
            if (ciError) throw ciError

            // 3. Upload photos into {userId}/{checkInId}/
            for (const [i, blob] of blobs.entries()) {
                const position = i + 1
                const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
                const path = `${userId}/${checkIn.id}/${position}.${ext}`

                const { error: upError } = await supabase.storage
                    .from('checkin-photos')
                    .upload(path, blob, { contentType: blob.type })
                if (upError) throw new Error(`Check-in saved, but photo ${position} failed: ${upError.message}`)

                const { error: rowError } = await supabase
                    .from('check_in_photos')
                    .insert({ check_in_id: checkIn.id, storage_path: path, position })
                if (rowError) throw new Error(`Check-in saved, but photo ${position} failed: ${rowError.message}`)
            }

            setJournal('')
            setFiles([])
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setSaving(false)
            await load()
        }
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
                ← Dashboard
            </Link>

            {/* Header */}
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold">{journey.title}</h1>
                <p className="text-sm text-gray-500">
                    Day {done} / 100 · started {journey.start_date}
                </p>
                <div className="h-2 w-full overflow-hidden rounded bg-gray-100">
                    <div className="h-full bg-green-500" style={{ width: `${done}%` }} />
                </div>
            </header>

            {/* Status banners */}
            {journey.status === 'completed' && (
                <div className="rounded border border-green-300 bg-green-50 p-4">
                    <p className="font-medium">🎉 You finished all 100 days.</p>
                    <Link href={`/journey/${journey.id}/finish`} className="mt-2 inline-block text-sm underline">
                        See how far you came →
                    </Link>
                </div>
            )}
            {journey.status === 'failed' && (
                <div className="rounded border bg-gray-50 p-4">
                    <p className="font-medium">Streak broken after {done} days.</p>
                    <p className="text-sm text-gray-600">This journey stays here as a record.</p>
                    <Link href="/dashboard" className="mt-2 inline-block text-sm underline">
                        Start a new journey
                    </Link>
                </div>
            )}
            {missedYesterday && (
                <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
                    ⚠️ You missed yesterday. Check in today or this journey fails.
                </div>
            )}
            {isActive && checkedInToday && (
                <div className="rounded border border-green-300 bg-green-50 p-4 text-sm">
                    ✅ Done for today. Come back tomorrow for Day {nextDay}.
                </div>
            )}

            {/* Check-in form */}
            {canCheckIn && (
                <form onSubmit={submitCheckIn} className="flex flex-col gap-3 rounded border p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">Day {nextDay} check-in</span>
                        <span className={`text-xs ${journalRequired ? 'text-amber-700' : 'text-gray-500'}`}>
                            {journalRequired ? 'Milestone: journal required' : 'Journal optional'}
                        </span>
                    </div>

                    <textarea
                        value={journal}
                        onChange={(e) => setJournal(e.target.value)}
                        maxLength={5000}
                        rows={5}
                        placeholder="What did you do today?"
                        className="rounded border px-3 py-2"
                    />

                    {/* Photos */}
                    <div className="flex flex-col gap-2">
                        {previews.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {previews.map((url, i) => (
                                    <div key={url} className="relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={url} alt="" className="aspect-square w-full rounded object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                            className="absolute right-1 top-1 rounded bg-black/70 px-2 text-xs text-white"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {files.length < MAX_PHOTOS && (
                            <label className="cursor-pointer text-sm text-gray-600 underline">
                                + Add photos ({files.length}/{MAX_PHOTOS})
                                <input type="file" accept="image/*" multiple onChange={pickPhotos} className="hidden" />
                            </label>
                        )}
                    </div>

                    <p className="text-xs text-gray-500">Entries can&apos;t be edited after saving.</p>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button disabled={saving}
                        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
                        {saving ? 'Saving…' : 'Check in'}
                    </button>
                </form>
            )}

            {/* Error after a partly failed check-in (form is hidden by then) */}
            {!canCheckIn && error && <p className="text-sm text-red-600">{error}</p>}

            {/* 100-day grid */}
            <section className="flex flex-col gap-2">
                <h2 className="font-medium">Progress</h2>
                <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
                        const entry = byDay.get(n)
                        const isMilestone = MILESTONES.includes(n)
                        const isNext = canCheckIn && n === nextDay
                        return (
                            <button
                                key={n}
                                disabled={!entry}
                                onClick={() => setSelected(entry ?? null)}
                                title={entry ? `Day ${n} · ${entry.checkin_date}` : `Day ${n}`}
                                className={[
                                    'aspect-square rounded text-[10px]',
                                    entry ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100 text-gray-400',
                                    isMilestone ? 'ring-2 ring-amber-400' : '',
                                    isNext ? 'outline outline-2 outline-black' : '',
                                ].join(' ')}
                            >
                                {n}
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Selected entry */}
            {selected && (
                <section className="flex flex-col gap-3 rounded border p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">
                            Day {selected.day_number} · {selected.checkin_date}
                        </span>
                        <button onClick={() => setSelected(null)} className="text-sm text-gray-500">
                            Close
                        </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">
                        {selected.journal || <span className="text-gray-400">(no journal)</span>}
                    </p>
                    {selected.check_in_photos.length > 0 && (
                        <EntryPhotos
                            key={selected.id}
                            paths={[...selected.check_in_photos]
                                .sort((a, b) => a.position - b.position)
                                .map((p) => p.storage_path)}
                        />
                    )}
                </section>
            )}
        </main>
    )
}