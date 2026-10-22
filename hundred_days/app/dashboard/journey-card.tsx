import Link from 'next/link'
import { MILESTONES, todayState, type TodayState } from '@/lib/journey'
import { ProgressBar } from '@/components/retro'

export type JourneyRow = {
  id: string
  title: string
  status: 'active' | 'completed' | 'failed'
  start_date: string
  timezone: string
  ended_at: string | null
  check_ins: { checkin_date: string }[]
}

const STATUS: Record<JourneyRow['status'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-[#000080]' },
  completed: { label: 'Completed', className: 'text-[#006400]' },
  failed: { label: 'Ended', className: 'text-[#505050]' },
}

const TODAY: Record<TodayState, { text: string; className: string }> = {
  done: { text: 'Checked in today', className: 'text-[#006400]' },
  due: { text: 'Check in today', className: 'text-[#000080]' },
  'last-chance': {
    text: 'Last chance: you missed yesterday',
    className: 'bg-[#ffff99] px-1 font-bold',
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
  const href =
    journey.status === 'completed' ? `/journey/${journey.id}/finish` : `/journey/${journey.id}`

  return (
    <Link
      href={href}
      className="sunken flex flex-col gap-2 bg-white p-3 text-black no-underline hover:bg-[#ffffe1] focus-visible:outline-1 focus-visible:outline-offset-[-5px] focus-visible:outline-dotted"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{journey.title}</span>
        <span className={`text-xs font-bold uppercase ${STATUS[journey.status].className}`}>
          {STATUS[journey.status].label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="w-24 shrink-0">Day {done} of 100</span>
        <div className="flex-1">
          <ProgressBar value={done} small />
        </div>
      </div>

      {today && (
        <span className={`w-fit text-xs ${TODAY[today].className}`}>{TODAY[today].text}</span>
      )}

      {journey.status === 'active' && nextMilestone && (
        <p className="text-xs text-[#303030]">
          {nextMilestone === done + 1
            ? `Next check-in is milestone Day ${nextMilestone}: journal required`
            : `Next milestone: Day ${nextMilestone} · ${nextMilestone - done} check-ins away`}
        </p>
      )}

      {journey.status === 'completed' && (
        <p className="text-xs text-[#303030]">Completed {endedOn}</p>
      )}
      {journey.status === 'failed' && (
        <p className="text-xs text-[#303030]">
          Ended after {done} days · {endedOn}
        </p>
      )}
    </Link>
  )
}
