import { Suspense } from 'react'
import FinishView from './finish-view'

export default function FinishPage() {
    return (
        <Suspense fallback={<p className="p-6">Loading…</p>}>
            <FinishView />
        </Suspense>
    )
}