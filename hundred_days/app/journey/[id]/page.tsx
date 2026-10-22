import { Suspense } from 'react'
import JourneyView from './journey-view'

export default function JourneyPage() {
    return (
        <Suspense fallback={<p className="p-6">Loading…</p>}>
            <JourneyView />
        </Suspense>
    )
}