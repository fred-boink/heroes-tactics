import { useState } from 'react';
import clsx from 'clsx';
import {
  abilities,
  abilityText,
  factionClasses,
  heroClasses,
  randomLevels,
  rolePool,
  stagePoints,
  unitAbility,
  type Faction,
  type HeroClass,
  type Stage,
} from '@tactics/rules';
import {
  difficulties,
  factionNames,
  kindNames,
  type Difficulty,
  type GameConfig,
  type Mode,
} from './game';

const factions: Faction[] = ['light', 'dark', 'nature'];
const stages: Stage[] = ['early', 'mid', 'late'];
const stageNames: Record<Stage, string> = {
  early: 'Early game',
  mid: 'Mid game',
  late: 'Late game',
};
const pickOne = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

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
  /** Ability levels (0–2) by ability id. */
  levels: Record<string, number>;
}

type Builds = Record<string, Build>;

function defaultBuilds(faction: Faction): Builds {
  return Object.fromEntries(
    factionClasses(faction).map((c) => [
      c.id,
      { primary: c.primaries[0]!, secondary: c.secondaries[0]!, levels: {} },
    ]),
  );
}

/** Random abilities from the whole role pool, spending every level point. */
function randomBuilds(faction: Faction, points: number): Builds {
  return Object.fromEntries(
    factionClasses(faction).map((c) => {
      const primary = pickOne(rolePool(c.role, 'primary'));
      const secondary = pickOne(rolePool(c.role, 'secondary'));
      return [
        c.id,
        {
          primary,
          secondary,
          levels: randomLevels([primary, secondary], Math.random, points),
        },
      ];
    }),
  );
}

function spent(build: Build) {
  return Object.values(build.levels).reduce((a, b) => a + b, 0);
}

/** Lowers levels, highest first, until a build fits the stage's points. */
function fitLevels(build: Build, points: number): Build {
  const levels = { ...build.levels };
  let over = spent(build) - points;
  while (over > 0) {
    const [id, level] = Object.entries(levels).sort((a, b) => b[1] - a[1])[0]!;
    if (level > 1) levels[id] = level - 1;
    else delete levels[id];
    over--;
  }
  return { ...build, levels };
}

const chip = clsx(
  'rounded-full',
  'border',
  'px-3',
  'py-1',
  'text-sm',
  'transition-colors',
);
const chipOn = clsx('border-brass', 'bg-brass', 'text-ink');
const chipOff = clsx('border-brass/40', 'text-vellum', 'hover:border-brass');

export function Setup({ onStart }: { onStart: (config: GameConfig) => void }) {
  const [mode, setMode] = useState<Mode>('bot');
  const [picks, setPicks] = useState<[Faction, Faction]>(['light', 'dark']);
  const [stage, setStage] = useState<Stage>('mid');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const points = stagePoints[stage];
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

  const chooseStage = (next: Stage) => {
    setStage(next);
    const fit = (b: Builds) =>
      Object.fromEntries(
        Object.entries(b).map(([c, x]) => [c, fitLevels(x, stagePoints[next])]),
      );
    setBuilds([fit(builds[0]), fit(builds[1])]);
  };

  /** Random factions and builds for both sides, equally levelled. */
  const randomize = (choice: Stage | 'any') => {
    const next = choice === 'any' ? pickOne(stages) : choice;
    const nextPicks: [Faction, Faction] = [
      pickOne(factions),
      pickOne(factions),
    ];
    setStage(next);
    setPicks(nextPicks);
    setBuilds([
      randomBuilds(nextPicks[0], stagePoints[next]),
      randomBuilds(nextPicks[1], stagePoints[next]),
    ]);
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
      levels: Object.fromEntries(
        Object.entries(b).map(([c, x]) => [c, x.levels]),
      ),
    });
    const [a, b] = [toConfig(builds[0]), toConfig(builds[1])];
    onStart({
      mode,
      factions: picks,
      loadouts: [a.loadouts, b.loadouts],
      levels: [a.levels, b.levels],
      stage,
      difficulty,
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

      {mode === 'bot' && (
        <div
          role="group"
          aria-label="Bot difficulty"
          className={clsx(
            'flex',
            'flex-wrap',
            'items-center',
            'gap-2',
            '-mt-4',
          )}
        >
          <span
            className={clsx(
              'text-xs',
              'uppercase',
              'tracking-wider',
              'text-vellum/55',
            )}
          >
            Bot
          </span>
          {(Object.keys(difficulties) as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              aria-pressed={difficulty === d}
              className={clsx(chip, difficulty === d ? chipOn : chipOff)}
            >
              {difficulties[d].name}
            </button>
          ))}
        </div>
      )}

      <div
        className={clsx(
          'flex',
          'flex-wrap',
          'items-center',
          'gap-x-6',
          'gap-y-3',
          'rounded-2xl',
          'border',
          'border-brass/25',
          'bg-umber/40',
          'px-4',
          'py-3',
        )}
      >
        <div
          role="group"
          aria-label="Stage"
          className={clsx('flex', 'flex-wrap', 'items-center', 'gap-2')}
        >
          <span
            className={clsx(
              'text-xs',
              'uppercase',
              'tracking-wider',
              'text-vellum/55',
            )}
          >
            Stage
          </span>
          {stages.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => chooseStage(s)}
              aria-pressed={stage === s}
              className={clsx(chip, stage === s ? chipOn : chipOff)}
            >
              {stageNames[s]}
              <span className={clsx('ml-1.5', 'text-xs', 'opacity-70')}>
                {stagePoints[s]} pts
              </span>
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label="Randomize both sides"
          className={clsx('flex', 'flex-wrap', 'items-center', 'gap-2')}
        >
          <span
            className={clsx(
              'text-xs',
              'uppercase',
              'tracking-wider',
              'text-vellum/55',
            )}
          >
            Randomize
          </span>
          {(['any', ...stages] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => randomize(s)}
              className={clsx(chip, chipOff)}
            >
              {s === 'any' ? 'Any stage' : stageNames[s]}
            </button>
          ))}
        </div>
      </div>

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
                  points={points}
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
  points,
  onChange,
}: {
  heroClass: HeroClass;
  build: Build;
  points: number;
  onChange: (b: Build) => void;
}) {
  const left = points - spent(build);
  const choose = (slot: 'primary' | 'secondary', id: string) => {
    const levels = { ...build.levels };
    delete levels[build[slot]];
    onChange({ ...build, [slot]: id, levels });
  };
  const setLevel = (abilityId: string, level: number) => {
    const current = build.levels[abilityId] ?? 0;
    if (level - current > left) return;
    const levels = { ...build.levels, [abilityId]: level };
    if (level === 0) delete levels[abilityId];
    onChange({ ...build, levels });
  };

  const slot = (label: string, kind: 'primary' | 'secondary') => {
    const chosen = build[kind];
    const signature = kind === 'primary' ? c.primaries : c.secondaries;
    const others = rolePool(c.role, kind).filter(
      (id) => !signature.includes(id),
    );
    const level = build.levels[chosen] ?? 0;
    const effective = unitAbility({ levels: build.levels }, chosen);
    const levelUps = abilities[chosen]!.upgrades ?? [];
    const option = (id: string, signatureOption: boolean) => (
      <option key={id} value={id}>
        {abilities[id]!.name}
        {signatureOption
          ? ''
          : ` (${factionNames[classOf(id)?.faction ?? c.faction]})`}
      </option>
    );
    return (
      <div className={clsx('flex', 'flex-col', 'gap-2')}>
        <div className={clsx('flex', 'flex-wrap', 'items-center', 'gap-2')}>
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
          <select
            aria-label={`${c.name} ${label.toLowerCase()}`}
            value={chosen}
            onChange={(e) => choose(kind, e.target.value)}
            className={clsx(
              'rounded-full',
              'border',
              'border-brass/50',
              'bg-umber',
              'px-3',
              'py-1',
              'text-sm',
              'text-vellum',
            )}
          >
            <optgroup label={`${c.name} signature`}>
              {signature.map((id) => option(id, true))}
            </optgroup>
            <optgroup label={`Any ${c.role}`}>
              {others.map((id) => option(id, false))}
            </optgroup>
          </select>
          <span
            role="group"
            aria-label={`${abilities[chosen]!.name} level`}
            className={clsx(
              'flex',
              'overflow-hidden',
              'rounded-full',
              'border',
              'border-storm/50',
            )}
          >
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={level === n}
                disabled={n - level > left}
                onClick={() => setLevel(chosen, n)}
                className={clsx(
                  'px-2.5',
                  'py-0.5',
                  'text-xs',
                  level === n
                    ? ['bg-storm', 'font-bold', 'text-ink']
                    : ['text-vellum/70', 'enabled:hover:bg-storm/20'],
                  'disabled:opacity-30',
                )}
              >
                Lv {n}
              </button>
            ))}
          </span>
        </div>
        <div className={clsx('flex', 'flex-col', 'gap-1', 'sm:ml-20')}>
          <p className={clsx('text-sm', 'text-vellum/85')}>
            <span className={clsx('text-vellum/50')}>
              {kindNames[effective.kind]} ·{' '}
              {effective.speed === 1 ? '1 tick' : `${effective.speed} ticks`}{' '}
              ·{' '}
            </span>
            {abilityText(effective)}
          </p>
          <ol className={clsx('flex', 'flex-wrap', 'gap-x-3', 'text-xs')}>
            {levelUps.map((u, i) => (
              <li
                key={u.id + i}
                className={clsx(level > i ? 'text-storm' : 'text-vellum/45')}
              >
                Lv {i + 1}: {u.name}
              </li>
            ))}
          </ol>
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
        <span className={clsx('flex', 'items-center', 'gap-2')}>
          <span className={clsx('font-display', 'text-lg')}>{c.name}</span>
          <span
            className={clsx(
              'rounded-full',
              'bg-walnut-light',
              'px-2',
              'text-[0.65rem]',
              'uppercase',
              'tracking-wider',
              'text-vellum/70',
            )}
          >
            {c.role}
          </span>
        </span>
        <span className={clsx('text-xs', 'text-vellum/60')}>
          {c.maxHp} health · acts every {c.recovery} ticks ·{' '}
          <span className={clsx(left > 0 ? 'text-storm' : 'text-vellum/60')}>
            {left} of {points} level points left
          </span>
        </span>
      </div>
      {slot('Primary', 'primary')}
      {slot('Secondary', 'secondary')}
    </li>
  );
}

function classOf(abilityId: string) {
  return Object.values(heroClasses).find(
    (c) => c.primaries.includes(abilityId) || c.secondaries.includes(abilityId),
  );
}
