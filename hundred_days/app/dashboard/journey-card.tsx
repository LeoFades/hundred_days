import Link from 'next/link'
import { MILESTONES, todayState, type TodayState } from '@/lib/journey'

export type JourneyRow = {
    id: string
    title: string
    status: 'active' | 'completed' | 'failed'
    start_date: string
    timezone: string
    ended_at: string | null
    check_ins: { checkin_date: string }[]
}

const STATUS_STYLE: Record<JourneyRow['status'], string> = {
    active: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-gray-200 text-gray-600',
}

const TODAY_CHIP: Record<TodayState, { text: string; className: string }> = {
    done: { text: '✅ Checked in today', className: 'bg-green-50 text-green-800' },
    due: { text: '⏳ Check in today', className: 'bg-blue-50 text-blue-800' },
    'last-chance': {
        text: '⚠️ Last chance: you missed yesterday',
        className: 'bg-amber-50 text-amber-800',
    },
}

export function summarize(j: JourneyRow) {
    const done = j.check_ins.length
    const last = j.check_ins.reduce<string | undefined>(
        (max, c) => (!max || c.checkin_date > max ? c.checkin_date : max),
        undefined
    )
    const today = j.status === 'active' ? todayState(j.start_date, last, j.timezone) : null
    const nextMilestone = MILESTONES.find((m) => m > done)
    return { done, today, nextMilestone }
}

export function JourneyCard({ journey }: { journey: JourneyRow }) {
    const { done, today, nextMilestone } = summarize(journey)
    const endedOn = journey.ended_at ? new Date(journey.ended_at).toLocaleDateString() : ''

    return (
        <Link
            href={journey.status === 'completed' ? `/journey/${journey.id}/finish` : `/journey/${journey.id}`}
            className="flex flex-col gap-2 rounded border p-4 hover:bg-gray-50"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{journey.title}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[journey.status]}`}>
                    {journey.status}
                </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-24 shrink-0">Day {done} / 100</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-gray-100">
                    <div className="h-full bg-green-500" style={{ width: `${done}%` }} />
                </div>
            </div>

            {today && (
                <span className={`w-fit rounded px-2 py-1 text-xs ${TODAY_CHIP[today].className}`}>
                    {TODAY_CHIP[today].text}
                </span>
            )}

            {journey.status === 'active' && nextMilestone && (
                <p className="text-xs text-gray-500">
                    {nextMilestone === done + 1
                        ? `🏁 Next check-in is milestone Day ${nextMilestone}: journal required`
                        : `Next milestone: Day ${nextMilestone} · ${nextMilestone - done} check-ins away`}
                </p>
            )}

            {journey.status === 'completed' && (
                <p className="text-xs text-gray-500">🎉 Completed {endedOn}</p>
            )}
            {journey.status === 'failed' && (
                <p className="text-xs text-gray-500">Ended after {done} days · {endedOn}</p>
            )}
        </Link>
    )
}