'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export function EntryPhotos({ paths }: { paths: string[] }) {
    const [urls, setUrls] = useState<string[]>([])
    const key = paths.join('|') // stable value so we don't refetch on every render

    useEffect(() => {
        let cancelled = false
        supabase.storage
            .from('checkin-photos')
            .createSignedUrls(key.split('|'), 60 * 60)
            .then(({ data }) => {
                if (cancelled) return
                setUrls((data ?? []).map((d) => d.signedUrl).filter((u): u is string => Boolean(u)))
            })
        return () => {
            cancelled = true
        }
    }, [key])

    if (!urls.length) return <p className="text-xs text-gray-400">Loading photos…</p>

    return (
        <div className="grid grid-cols-3 gap-2">
            {urls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" className="aspect-square w-full rounded object-cover" />
                </a>
            ))}
        </div>
    )
}