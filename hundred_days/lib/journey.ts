export const MILESTONES = [1, 10, 50, 100]

// "Today" as YYYY-MM-DD in a timezone
export function todayIn(tz: string) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

// Whole days from date a to date b (both YYYY-MM-DD)
export function daysBetween(a: string, b: string) {
    return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

export type TodayState = 'done' | 'due' | 'last-chance'

export function todayState(startDate: string, lastDate: string | undefined, tz: string): TodayState {
    const today = todayIn(tz)
    if (lastDate === today) return 'done'
    const gap = lastDate ? daysBetween(lastDate, today) : daysBetween(startDate, today) + 1
    return gap >= 2 ? 'last-chance' : 'due'
}