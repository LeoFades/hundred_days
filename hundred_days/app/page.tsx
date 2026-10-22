import Link from 'next/link'
import { Window } from '@/components/retro'

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Window title="Welcome to 100 Days" className="w-full max-w-lg" bodyClassName="p-5">
        <div className="flex flex-col gap-4">
          <h1 className="font-pixel text-4xl font-semibold">100 Days</h1>
          <p>Pick one thing to learn. Check in every day for 100 days.</p>

          <fieldset className="border border-[#808080] p-3">
            <legend className="px-1">The rules</legend>
            <ul className="list-disc space-y-1 pl-5">
              <li>Write a journal on days 1, 10, 50 and 100. Other days are optional.</li>
              <li>Add up to 3 photos a day.</li>
              <li>Miss one day and you get a warning. Miss two in a row and the journey ends.</li>
              <li>Entries can&apos;t be edited. Keep it honest.</li>
            </ul>
          </fieldset>

          <div className="flex justify-end">
            <Link href="/login" className="btn btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </Window>
    </main>
  )
}
