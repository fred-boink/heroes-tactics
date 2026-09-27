import { useState } from 'react';
import clsx from 'clsx';
import {
  abilities,
  abilityText,
  factionClasses,
  unitAbility,
  upgradePoints,
  type Faction,
  type HeroClass,
} from '@tactics/rules';
import { factionNames, kindNames, type GameConfig, type Mode } from './game';

const factions: Faction[] = ['light', 'dark', 'nature'];

const factionBlurb: Record<Faction, string> = {
  light:
    'Lightning that chains through a packed formation, and ways to shield and speed up your own.',
  dark: 'Fire that keeps burning, curses that weaken and expose, and ways to wreck the enemy queue.',
  nature:
    'Ice that delays, stone that skips a turn, and walls and hastes for your own side.',
};

interface Build {
  primary: string;
  secondary: string;
  upgrades: Record<string, string[]>;
}

type Builds = Record<string, Build>;

function defaultBuilds(faction: Faction): Builds {
  return Object.fromEntries(
    factionClasses(faction).map((c) => [
      c.id,
      { primary: c.primaries[0]!, secondary: c.secondaries[0]!, upgrades: {} },
    ]),
  );
}

function spent(build: Build) {
  let total = 0;
  for (const [abilityId, ids] of Object.entries(build.upgrades)) {
    for (const id of ids) {
      total +=
        abilities[abilityId]!.upgrades?.find((u) => u.id === id)?.cost ?? 0;
    }
  }
  return total;
}

export function Setup({ onStart }: { onStart: (config: GameConfig) => void }) {
  const [mode, setMode] = useState<Mode>('bot');
  const [picks, setPicks] = useState<[Faction, Faction]>(['light', 'dark']);
  const [builds, setBuilds] = useState<[Builds, Builds]>([
    defaultBuilds('light'),
    defaultBuilds('dark'),
  ]);

  const chooseFaction = (side: 0 | 1, faction: Faction) => {
    const nextPicks = [...picks] as [Faction, Faction];
    nextPicks[side] = faction;
    setPicks(nextPicks);
    const next = [...builds] as [Builds, Builds];
    next[side] = defaultBuilds(faction);
    setBuilds(next);
  };

  const update = (side: 0 | 1, classId: string, build: Build) => {
    const next = [...builds] as [Builds, Builds];
    next[side] = { ...next[side], [classId]: build };
    setBuilds(next);
  };

  const start = () => {
    const toConfig = (b: Builds) => ({
      loadouts: Object.fromEntries(
        Object.entries(b).map(([c, x]) => [c, [x.primary, x.secondary]]),
      ),
      upgrades: Object.fromEntries(
        Object.entries(b).map(([c, x]) => [c, x.upgrades]),
      ),
    });
    const [a, b] = [toConfig(builds[0]), toConfig(builds[1])];
    onStart({
      mode,
      factions: picks,
      loadouts: [a.loadouts, b.loadouts],
      upgrades: [a.upgrades, b.upgrades],
      seed: Math.floor(Math.random() * 1_000_000),
    });
  };

  return (
    <main
      className={clsx(
        'mx-auto',
        'flex',
        'max-w-6xl',
        'flex-col',
        'gap-8',
        'px-4',
        'py-10',
        'sm:px-8',
      )}
    >
      <header className={clsx('flex', 'flex-col', 'gap-2')}>
        <h1
          className={clsx(
            'font-display',
            'text-4xl',
            'tracking-wide',
            'text-vellum',
            'sm:text-5xl',
          )}
        >
          Heroes Tactics
        </h1>
        <p className={clsx('max-w-2xl', 'text-lg', 'text-vellum/75')}>
          Two formations, one timeline. Every attack and spell is queued at a
          slot and lands a few ticks later, in full view, so both sides can
          dodge, block or interrupt what's coming.
        </p>
      </header>

      <fieldset className={clsx('flex', 'flex-wrap', 'gap-3')}>
        <legend className={clsx('sr-only')}>Opponent</legend>
        {(
          [
            ['bot', 'Play against the bot'],
            ['hotseat', 'Two players, one screen'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={clsx(
              'rounded-full',
              'border',
              'px-5',
              'py-2',
              'transition-colors',
              mode === value
                ? ['border-brass', 'bg-brass', 'text-ink']
                : ['border-brass/40', 'text-vellum', 'hover:border-brass'],
            )}
          >
            {label}
          </button>
        ))}
      </fieldset>

      <div className={clsx('grid', 'gap-6', 'lg:grid-cols-2')}>
        {([0, 1] as const).map((side) => (
          <section
            key={side}
            aria-label={side === 0 ? 'Player 1' : 'Player 2'}
            className={clsx(
              'flex',
              'flex-col',
              'gap-4',
              'rounded-2xl',
              'border',
              'border-brass/25',
              'bg-gradient-to-b',
              'from-walnut-light',
              'to-walnut',
              'p-5',
              'shadow-xl',
              'shadow-black/30',
            )}
          >
            <h2 className={clsx('font-display', 'text-2xl')}>
              {side === 0
                ? mode === 'bot'
                  ? 'You'
                  : 'Player 1'
                : mode === 'bot'
                  ? 'The bot'
                  : 'Player 2'}
            </h2>
            <div className={clsx('flex', 'gap-2')}>
              {factions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => chooseFaction(side, f)}
                  aria-pressed={picks[side] === f}
                  className={clsx(
                    'flex-1',
                    'rounded-lg',
                    'border',
                    'px-3',
                    'py-2',
                    'font-display',
                    'text-lg',
                    'transition-colors',
                    picks[side] === f
                      ? ['border-brass', 'bg-umber/60', 'text-vellum']
                      : [
                          'border-transparent',
                          'text-vellum/60',
                          'hover:text-vellum',
                        ],
                  )}
                >
                  {factionNames[f]}
                </button>
              ))}
            </div>
            <p className={clsx('text-sm', 'text-vellum/70')}>
              {factionBlurb[picks[side]]}
            </p>
            <ul className={clsx('flex', 'flex-col', 'gap-3')}>
              {factionClasses(picks[side]).map((c) => (
                <HeroBuilder
                  key={c.id}
                  heroClass={c}
                  build={builds[side][c.id]!}
                  onChange={(b) => update(side, c.id, b)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className={clsx('flex', 'justify-end')}>
        <button
          type="button"
          onClick={start}
          className={clsx(
            'rounded-full',
            'bg-brass',
            'px-8',
            'py-3',
            'font-display',
            'text-xl',
            'text-ink',
            'shadow-lg',
            'shadow-black/40',
            'transition-transform',
            'hover:-translate-y-0.5',
          )}
        >
          Start battle
        </button>
      </div>
    </main>
  );
}

function HeroBuilder({
  heroClass: c,
  build,
  onChange,
}: {
  heroClass: HeroClass;
  build: Build;
  onChange: (b: Build) => void;
}) {
  const left = upgradePoints - spent(build);
  const choose = (slot: 'primary' | 'secondary', id: string) => {
    const upgrades = { ...build.upgrades };
    delete upgrades[build[slot]];
    onChange({ ...build, [slot]: id, upgrades });
  };
  const toggleUpgrade = (
    abilityId: string,
    upgradeId: string,
    cost: number,
  ) => {
    const current = build.upgrades[abilityId] ?? [];
    const on = current.includes(upgradeId);
    if (!on && cost > left) return;
    onChange({
      ...build,
      upgrades: {
        ...build.upgrades,
        [abilityId]: on
          ? current.filter((u) => u !== upgradeId)
          : [...current, upgradeId],
      },
    });
  };

  const slot = (
    label: string,
    kind: 'primary' | 'secondary',
    options: string[],
  ) => {
    const chosen = build[kind];
    const effective = unitAbility({ upgrades: build.upgrades }, chosen);
    return (
      <div className={clsx('flex', 'flex-col', 'gap-2')}>
        <div className={clsx('flex', 'flex-wrap', 'items-center', 'gap-1.5')}>
          <span
            className={clsx(
              'w-20',
              'text-xs',
              'uppercase',
              'tracking-wider',
              'text-vellum/55',
            )}
          >
            {label}
          </span>
          {options.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={chosen === id}
              onClick={() => choose(kind, id)}
              className={clsx(
                'rounded-full',
                'border',
                'px-3',
                'py-1',
                'text-sm',
                'transition-colors',
                chosen === id
                  ? ['border-brass', 'bg-brass', 'text-ink']
                  : ['border-brass/30', 'text-vellum/75', 'hover:border-brass'],
              )}
            >
              {abilities[id]!.name}
            </button>
          ))}
        </div>
        <div
          className={clsx('ml-0', 'flex', 'flex-col', 'gap-1.5', 'sm:ml-20')}
        >
          <p className={clsx('text-sm', 'text-vellum/80')}>
            <span className={clsx('text-vellum/50')}>
              {kindNames[effective.kind]} ·{' '}
              {effective.speed === 1 ? '1 tick' : `${effective.speed} ticks`}{' '}
              ·{' '}
            </span>
            {abilityText(effective)}
          </p>
          <div className={clsx('flex', 'flex-wrap', 'gap-1.5')}>
            {(abilities[chosen]!.upgrades ?? []).map((u) => {
              const on = build.upgrades[chosen]?.includes(u.id) ?? false;
              const affordable = on || u.cost <= left;
              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!affordable}
                  onClick={() => toggleUpgrade(chosen, u.id, u.cost)}
                  className={clsx(
                    'flex',
                    'items-center',
                    'gap-1.5',
                    'rounded-md',
                    'border',
                    'px-2',
                    'py-0.5',
                    'text-xs',
                    'transition-colors',
                    on
                      ? ['border-storm', 'bg-storm/20', 'text-storm']
                      : [
                          'border-vellum/20',
                          'text-vellum/70',
                          'enabled:hover:border-storm',
                        ],
                    'disabled:opacity-35',
                  )}
                >
                  <span aria-hidden className={clsx('flex', 'gap-0.5')}>
                    {Array.from({ length: u.cost }, (_, i) => (
                      <span
                        key={i}
                        className={clsx(
                          'size-1.5',
                          'rounded-full',
                          on ? 'bg-storm' : 'bg-vellum/50',
                        )}
                      />
                    ))}
                  </span>
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <li
      className={clsx(
        'flex',
        'flex-col',
        'gap-3',
        'rounded-xl',
        'bg-umber/40',
        'p-4',
      )}
    >
      <div
        className={clsx(
          'flex',
          'flex-wrap',
          'items-baseline',
          'justify-between',
          'gap-2',
        )}
      >
        <span className={clsx('font-display', 'text-lg')}>{c.name}</span>
        <span className={clsx('text-xs', 'text-vellum/60')}>
          {c.maxHp} health · acts every {c.recovery} ticks ·{' '}
          <span className={clsx(left > 0 ? 'text-storm' : 'text-vellum/60')}>
            {left} of {upgradePoints} upgrade points left
          </span>
        </span>
      </div>
      {slot('Primary', 'primary', c.primaries)}
      {slot('Secondary', 'secondary', c.secondaries)}
    </li>
  );
}
