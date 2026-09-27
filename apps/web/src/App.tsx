import { useState } from 'react';
import { Battle } from './Battle';
import { Setup } from './Setup';
import type { GameConfig } from './game';

export function App() {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [round, setRound] = useState(0);

  if (!config) return <Setup onStart={setConfig} />;
  return (
    <Battle
      key={round}
      config={config}
      onRematch={() => {
        setConfig({ ...config, seed: config.seed + 1 });
        setRound((r) => r + 1);
      }}
      onLeave={() => setConfig(null)}
    />
  );
}
