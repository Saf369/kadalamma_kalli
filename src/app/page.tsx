'use client';

import dynamic from 'next/dynamic';

const VanillaBeachExperience = dynamic(
  () => import('@/components/VanillaBeachExperience'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#080c10] flex flex-col items-center justify-center text-neutral-400 gap-3">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium tracking-wide text-cyan-200">Loading Beach Seashore Experience...</p>
      </div>
    ),
  }
);

export default function Home() {
  return <VanillaBeachExperience />;
}
