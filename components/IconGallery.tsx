'use client';

import React from 'react';
import * as Icons from '@/components/TournamentIcons';

export default function IconGallery() {
    return (
        <div className="p-8 bg-zinc-950 min-h-screen text-white">
            <h1 className="text-3xl font-bold mb-8 text-emerald-500">Tournament Icon Gallery</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                {Object.entries(Icons).map(([name, Icon]) => (
                    <div key={name} className="flex flex-col items-center p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-emerald-500/50 transition-colors">
                        <div className="mb-4 h-24 flex items-center justify-center">
                            {/* @ts-ignore */}
                            <Icon size={64} />
                        </div>
                        <span className="text-xs font-mono text-zinc-400 text-center break-all">{name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
