'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { MILESTONES, todayIn, daysBetween } from '@/lib/journey'
import { Alert, ProgressBar, StatusBar, Window } from '@/components/retro'
import { EntryPhotos } from './entry-photos'

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
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

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
            <main className="flex min-h-screen items-center justify-center p-4">
                <Alert kind="info" title="Not found">
                    <p>This journey doesn&apos;t exist, or it isn&apos;t yours.</p>
                    <Link href="/dashboard" className="btn w-fit">
                        Back to dashboard
                    </Link>
                </Alert>
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

    async function deleteJourney() {
        if (!journey) return
        setDeleting(true)
        setError('')

        // Grab photo paths before the rows disappear
        const paths = checkIns.flatMap((c) => c.check_in_photos.map((p) => p.storage_path))

        // 1. Delete the journey (check-ins and photo rows go with it)
        const { data, error: delError } = await supabase
            .from('journeys')
            .delete()
            .eq('id', journey.id)
            .select('id')

        if (delError || !data?.length) {
            setDeleting(false)
            setConfirmDelete(false)
            return setError(delError?.message ?? "Couldn't delete this journey.")
        }

        // 2. Remove the photo files (best effort: leftovers only waste space)
        if (paths.length) await supabase.storage.from('checkin-photos').remove(paths)

        router.replace('/dashboard')
    }

    const graceText = !isActive
        ? journey.status === 'completed'
            ? 'Completed'
            : 'Ended'
        : missedYesterday
            ? 'Grace day: used'
            : 'Grace day: available'

    return (
        <main className="mx-auto flex max-w-5xl flex-col px-4 py-8">
            <Window
                title={`${journey.title}.log · Day ${done} of 100`}
                closeHref="/dashboard"
                bodyClassName=""
            >
                <nav className="menubar">
                    <Link href="/dashboard" className="menu-item">
                        ← Dashboard
                    </Link>
                    {journey.status === 'completed' && (
                        <Link href={`/journey/${journey.id}/finish`} className="menu-item">
                            See how far you came
                        </Link>
                    )}
                    <button type="button" onClick={() => setConfirmDelete(true)} className="menu-item ml-auto">
                        Delete journey…
                    </button>
                </nav>

                <div className="flex flex-col gap-4 p-4">
                    {/* Header */}
                    <header className="flex flex-col gap-2">
                        <h1 className="font-pixel text-3xl font-semibold">{journey.title}</h1>
                        <p className="text-[#303030]">
                            Started {journey.start_date} · {100 - done} days to go
                        </p>
                        <ProgressBar value={done} />
                    </header>

                    {/* Status dialogs */}
                    {journey.status === 'completed' && (
                        <Alert kind="success" title="Journey complete">
                            <p>You finished all 100 days.</p>
                            <Link href={`/journey/${journey.id}/finish`} className="btn btn-primary w-fit">
                                See how far you came
                            </Link>
                        </Alert>
                    )}
                    {journey.status === 'failed' && (
                        <Alert kind="info" title="Journey ended">
                            <p>Streak broken after {done} days. This journey stays here as a record.</p>
                            <Link href="/dashboard" className="btn w-fit">
                                Start a new journey
                            </Link>
                        </Alert>
                    )}
                    {missedYesterday && (
                        <Alert kind="warning" title="Warning">
                            <p>You missed yesterday. Check in today, or this journey ends.</p>
                        </Alert>
                    )}
                    {isActive && checkedInToday && (
                        <Alert kind="success" title="Saved">
                            <p>Done for today. Come back tomorrow for Day {nextDay}.</p>
                        </Alert>
                    )}

                    {/* Error after a partly failed check-in (form is hidden by then) */}
                    {!canCheckIn && error && <p className="text-[#800000]">{error}</p>}

                    <div className="flex flex-wrap items-start gap-4">
                        {/* Check-in */}
                        {canCheckIn && (
                            <Window title={`Day ${nextDay} check-in`} className="min-w-0 flex-[1_1_380px]">
                                <form onSubmit={submitCheckIn} className="flex flex-col gap-3">
                                    <div className="flex flex-wrap justify-between gap-2">
                                        <label htmlFor="journal">What did you do today?</label>
                                        <span className={journalRequired ? 'font-bold text-[#800000]' : 'text-[#303030]'}>
                                            {journalRequired ? 'Milestone: required' : 'Optional'}
                                        </span>
                                    </div>

                                    <textarea
                                        id="journal"
                                        value={journal}
                                        onChange={(e) => setJournal(e.target.value)}
                                        maxLength={5000}
                                        rows={7}
                                        className="field"
                                    />

                                    <fieldset className="border border-[#808080] p-3">
                                        <legend className="px-1">
                                            Photos ({files.length}/{MAX_PHOTOS})
                                        </legend>
                                        <div className="flex flex-col gap-2">
                                            {previews.length > 0 && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {previews.map((url, i) => (
                                                        <div key={url} className="sunken relative bg-white p-1">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={url} alt="" className="aspect-square w-full object-cover" />
                                                            <button
                                                                type="button"
                                                                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                                                className="tbtn absolute right-1 top-1"
                                                                aria-label={`Remove photo ${i + 1}`}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {files.length < MAX_PHOTOS && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <label className="btn">
                                                        Browse…
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            onChange={pickPhotos}
                                                            className="sr-only"
                                                        />
                                                    </label>
                                                    <span className="text-xs text-[#303030]">Max 3 · shrunk to under 1 MB</span>
                                                </div>
                                            )}
                                        </div>
                                    </fieldset>

                                    <p className="text-xs text-[#303030]">Entries can&apos;t be edited after saving.</p>
                                    {error && <p className="text-[#800000]">{error}</p>}

                                    <div className="flex justify-end">
                                        <button disabled={saving} className="btn btn-primary">
                                            {saving ? 'Saving…' : 'Check in'}
                                        </button>
                                    </div>
                                </form>
                            </Window>
                        )}

                        {/* 100-day grid */}
                        <Window title="Progress" className="min-w-0 flex-[1_1_380px]">
                            <div className="flex flex-col gap-3">
                                <div className="day-grid">
                                    {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => {
                                        const entry = byDay.get(n)
                                        const classes = [
                                            'cell',
                                            entry ? 'done' : '',
                                            MILESTONES.includes(n) ? 'ms' : '',
                                            canCheckIn && n === nextDay ? 'next' : '',
                                            selected?.day_number === n ? 'selected' : '',
                                        ].join(' ')
                                        return (
                                            <button
                                                key={n}
                                                type="button"
                                                disabled={!entry}
                                                onClick={() => setSelected(entry ?? null)}
                                                title={entry ? `Day ${n} · ${entry.checkin_date}` : `Day ${n}`}
                                                aria-label={entry ? `Open day ${n}` : `Day ${n}, not done yet`}
                                                className={classes}
                                            >
                                                {n}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 bg-[#000080]" />
                                        Done
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 border border-[#808080] bg-[#ffff99]" />
                                        Milestone
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 outline-2 outline-dotted outline-black" />
                                        Today
                                    </span>
                                </div>
                            </div>
                        </Window>
                    </div>

                    {/* Selected entry */}
                    {selected && (
                        <Window
                            title={`Day ${selected.day_number} · ${selected.checkin_date}`}
                            onClose={() => setSelected(null)}
                        >
                            <div className="flex flex-col gap-3">
                                <p className="sunken whitespace-pre-wrap bg-white p-3 font-mono">
                                    {selected.journal || <span className="text-[#505050]">(no journal)</span>}
                                </p>
                                {selected.check_in_photos.length > 0 && (
                                    <EntryPhotos
                                        key={selected.id}
                                        paths={[...selected.check_in_photos]
                                            .sort((a, b) => a.position - b.position)
                                            .map((p) => p.storage_path)}
                                    />
                                )}
                            </div>
                        </Window>
                    )}
                </div>

                <StatusBar items={[`Day ${done} of 100`, `${100 - done} to go`, graceText]} />
            </Window>

            {/* Delete confirmation */}
            {confirmDelete && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Delete journey"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                >
                    <Alert kind="warning" title="Delete journey">
                        <p className="font-bold">Delete &ldquo;{journey.title}&rdquo;?</p>
                        <p>
                            This removes {done} check-ins and all their photos. It can&apos;t be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={deleteJourney}
                                disabled={deleting}
                                className="btn btn-primary"
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                                autoFocus
                                className="btn"
                            >
                                Cancel
                            </button>
                        </div>
                    </Alert>
                </div>
            )}
        </main>
    )
}