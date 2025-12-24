'use client';

import LoginPage from '@/apps/b2c/app/login/page';
import { useState } from 'react';

export default function Login() {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeedResult(null);
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erreur seeding');
      }
      setSeedResult('Seeder exécuté avec succès ✅');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'échec seeding';
      setSeedResult(`Erreur: ${message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <LoginPage />
      {process.env.NEXT_PUBLIC_ENABLE_SEED === 'true' && (
        <div className="fixed bottom-6 right-6 z-[200]">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 rounded-lg shadow bg-[#235730] text-white hover:bg-[#1a4224] disabled:opacity-60"
          >
            {seeding ? 'Seeding...' : 'Lancer le seeder'}
          </button>
          {seedResult && (
            <div className="mt-2 text-sm px-3 py-2 rounded bg-white shadow border text-gray-700 max-w-xs">
              {seedResult}
            </div>
          )}
        </div>
      )}
    </>
  );
}
