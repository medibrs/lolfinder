'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NUM_ITERATIONS = 100

interface StepResult {
    step: string
    avgMs: number
    minMs: number
    maxMs: number
}

export default function PerformanceTestPage() {
    const [results, setResults] = useState<StepResult[]>([])
    const [totalMs, setTotalMs] = useState(0)
    const [progress, setProgress] = useState(0)
    const [isRunning, setIsRunning] = useState(false)

    useEffect(() => {
        runTest()
    }, [])

    const runTest = async () => {
        setIsRunning(true)
        setResults([])
        setProgress(0)

        const supabase = createClient()

        // Per-step accumulators
        const steps = [
            '1. Auth Session (localStorage)',
            '2. Auth getUser() (network verify)',
            '3. Fetch 1 Team (select *)',
            '4. Fetch 1 Player (select *)',
            '5. Fetch Team + Captain Join',
            '6. Fetch My Player Profile',
        ]
        const sums: number[] = new Array(steps.length).fill(0)
        const mins: number[] = new Array(steps.length).fill(Infinity)
        const maxs: number[] = new Array(steps.length).fill(0)

        // Get user once upfront so we have an ID for step 6
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id ?? null

        const overallStart = performance.now()

        for (let i = 0; i < NUM_ITERATIONS; i++) {
            let t: number

            // Step 1 – local session read
            t = performance.now()
            await supabase.auth.getSession()
            const s1 = performance.now() - t
            sums[0] += s1; mins[0] = Math.min(mins[0], s1); maxs[0] = Math.max(maxs[0], s1)

            // Step 2 – network user verify
            t = performance.now()
            await supabase.auth.getUser()
            const s2 = performance.now() - t
            sums[1] += s2; mins[1] = Math.min(mins[1], s2); maxs[1] = Math.max(maxs[1], s2)

            // Step 3 – simple teams fetch
            t = performance.now()
            await supabase.from('teams').select('*').limit(1).maybeSingle()
            const s3 = performance.now() - t
            sums[2] += s3; mins[2] = Math.min(mins[2], s3); maxs[2] = Math.max(maxs[2], s3)

            // Step 4 – simple players fetch
            t = performance.now()
            await supabase.from('players').select('*').limit(1).maybeSingle()
            const s4 = performance.now() - t
            sums[3] += s4; mins[3] = Math.min(mins[3], s4); maxs[3] = Math.max(maxs[3], s4)

            // Step 5 – teams join (foreign key)
            t = performance.now()
            await supabase.from('teams').select('id, name, captain:players!captain_id(summoner_name)').limit(1)
            const s5 = performance.now() - t
            sums[4] += s5; mins[4] = Math.min(mins[4], s5); maxs[4] = Math.max(maxs[4], s5)

            // Step 6 – user-specific row (RLS filter)
            t = performance.now()
            if (userId) await supabase.from('players').select('*').eq('id', userId).maybeSingle()
            const s6 = performance.now() - t
            sums[5] += s6; mins[5] = Math.min(mins[5], s6); maxs[5] = Math.max(maxs[5], s6)

            setProgress(i + 1)
        }

        const overall = performance.now() - overallStart

        setResults(
            steps.map((step, idx) => ({
                step,
                avgMs: Math.round(sums[idx] / NUM_ITERATIONS),
                minMs: Math.round(mins[idx]),
                maxMs: Math.round(maxs[idx]),
            }))
        )
        setTotalMs(Math.round(overall))
        setIsRunning(false)
    }

    const colour = (ms: number) =>
        ms > 400 ? 'text-red-400 border-red-900/50'
            : ms > 150 ? 'text-yellow-400 border-yellow-900/50'
                : 'text-green-400 border-green-900/50'

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 max-w-3xl mx-auto bg-black text-white font-mono">
            <h1 className="text-3xl font-bold mb-1">Latency Diagnostic</h1>
            <p className="text-zinc-500 mb-6 text-sm">
                Each step averaged over <span className="text-white font-bold">{NUM_ITERATIONS}</span> iterations.
                Measures client → Supabase round-trips including RLS evaluation time.
            </p>

            <button
                onClick={runTest}
                disabled={isRunning}
                className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded mb-8 font-bold disabled:opacity-40 transition-colors"
            >
                {isRunning ? `Running… ${progress}/${NUM_ITERATIONS}` : '▶ Run Again'}
            </button>

            {isRunning && (
                <div className="mb-6">
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                            style={{ width: `${(progress / NUM_ITERATIONS) * 100}%` }}
                        />
                    </div>
                    <p className="text-zinc-500 text-xs mt-1">{progress} / {NUM_ITERATIONS} iterations complete…</p>
                </div>
            )}

            {results.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
                        <span className="text-zinc-300 font-bold">Total wall-clock time ({NUM_ITERATIONS} iterations)</span>
                        <span className={`font-bold text-lg px-3 py-1 rounded border bg-zinc-900 ${colour(totalMs / NUM_ITERATIONS)}`}>
                            {totalMs}ms &nbsp;<span className="text-xs font-normal text-zinc-400">({Math.round(totalMs / NUM_ITERATIONS)}ms avg/cycle)</span>
                        </span>
                    </div>

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800">
                                <th className="text-left px-6 py-3">Step</th>
                                <th className="text-right px-4 py-3">Avg</th>
                                <th className="text-right px-4 py-3">Min</th>
                                <th className="text-right px-6 py-3">Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((r, i) => (
                                <tr key={i} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/40 transition-colors">
                                    <td className="px-6 py-4 text-zinc-300">{r.step}</td>
                                    <td className="px-4 py-4 text-right">
                                        <span className={`font-bold px-2 py-0.5 rounded border bg-zinc-900 ${colour(r.avgMs)}`}>
                                            {r.avgMs}ms
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right text-zinc-500">{r.minMs}ms</td>
                                    <td className="px-6 py-4 text-right text-zinc-500">{r.maxMs}ms</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
