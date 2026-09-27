import clsx from 'clsx';
import {
  abilities,
  actionSlots,
  heroClass,
  timeline,
  type BattleState,
  type PlayerId,
  type TimelineEntry,
} from '@tactics/rules';
import { Portrait } from './Portrait';

/**
 * The shared timeline as one row, in the order things will happen. Hero turns
 * and queued actions are different cards; a marker shows the tick each group
 * happens on. With a preview, it shows the order after the chosen action: the
 * new action is dashed, and cards it moves show how far.
 */
export function Timeline({
  state,
  preview,
  ghostSeq,
  viewer,
  highlightSeq,
  onHoverAction,
}: {
  state: BattleState;
  preview: BattleState | null;
  ghostSeq: number | null;
  viewer: PlayerId;
  highlightSeq: number | null;
  onHoverAction: (seq: number | null) => void;
}) {
  const shown = preview ?? state;
  const now = state.time;
  const entries = timeline(shown).slice(0, 14);
  const before = new Map<string, number>();
  for (const e of timeline(state)) before.set(keyOf(e), e.at);
  const ticks = (at: number) => Math.round((at - now) * 10) / 10;

  let lastTick: number | null = null;
  return (
    <section
      aria-label="Timeline"
      className={clsx(
        'rounded-2xl',
        'px-3',
        'py-2.5',
        preview ? ['bg-storm/10', 'ring-1', 'ring-storm/50'] : 'bg-umber/60',
      )}
    >
      <div
        className={clsx(
          'mb-2',
          'flex',
          'items-baseline',
          'justify-between',
          'px-1',
        )}
      >
        <h2
          className={clsx(
            'font-display',
            'text-sm',
            'tracking-wide',
            'text-brass',
          )}
        >
          Timeline
          <span
            className={clsx('ml-2', 'font-body', 'text-xs', 'text-vellum/50')}
          >
            what happens next, left to right
          </span>
        </h2>
        {preview && (
          <span className={clsx('text-xs', 'text-storm')}>
            Preview if you queue this
          </span>
        )}
      </div>
      <ol
        className={clsx(
          'flex',
          'items-stretch',
          'gap-1.5',
          'overflow-x-auto',
          'pb-1',
        )}
      >
        {entries.map((e) => {
          const t = Math.max(0, ticks(e.at));
          const marker =
            lastTick === null || t !== lastTick ? (
              <li
                key={`t${t}-${keyOf(e)}`}
                className={clsx(
                  'flex',
                  'shrink-0',
                  'flex-col',
                  'items-center',
                  'justify-center',
                  'px-0.5',
                  'text-[0.6rem]',
                  'font-bold',
                  'uppercase',
                  'tracking-wider',
                  t === 0 ? 'text-storm' : 'text-vellum/45',
                )}
                aria-label={t === 0 ? 'Now' : `In ${t} ticks`}
              >
                <span className={clsx('h-3', 'w-px', 'bg-current')} />
                {t === 0 ? 'now' : `+${t}`}
                <span className={clsx('h-3', 'w-px', 'bg-current')} />
              </li>
            ) : null;
          lastTick = t;
          const old = before.get(keyOf(e));
          const ghost = e.kind === 'action' && e.action.seq === ghostSeq;
          const shift =
            !ghost && old !== undefined
              ? Math.round((e.at - old) * 10) / 10
              : 0;
          return [
            marker,
            e.kind === 'hero' ? (
              <HeroCard
                key={keyOf(e)}
                state={shown}
                unitId={e.unitId}
                mine={e.owner === viewer}
                active={e.unitId === state.activeId && !preview}
                shift={shift}
              />
            ) : (
              <ActionCard
                key={keyOf(e)}
                state={shown}
                entry={e}
                mine={e.action.owner === viewer}
                ghost={ghost}
                lit={highlightSeq === e.action.seq}
                shift={shift}
                onHover={onHoverAction}
              />
            ),
          ];
        })}
      </ol>
    </section>
  );
}

function HeroCard({
  state,
  unitId,
  mine,
  active,
  shift,
}: {
  state: BattleState;
  unitId: string;
  mine: boolean;
  active: boolean;
  shift: number;
}) {
  const u = state.units.find((x) => x.id === unitId)!;
  const cls = heroClass(u.classId);
  return (
    <li
      title={`${cls.name}'s turn`}
      className={clsx(
        'relative',
        'flex',
        'w-16',
        'shrink-0',
        'flex-col',
        'items-center',
        'gap-1',
        'rounded-xl',
        'border-2',
        'px-1',
        'pb-1',
        'pt-1.5',
        'text-vellum',
        mine
          ? ['border-verdigris-light/70', 'bg-verdigris/40']
          : ['border-oxblood-light/70', 'bg-oxblood/45'],
        active && ['border-storm', 'shadow-[0_0_14px_rgba(232,210,122,0.55)]'],
        shift !== 0 && ['ring-2', 'ring-storm'],
      )}
    >
      <span
        className={clsx(
          'flex',
          'size-9',
          'items-center',
          'justify-center',
          'rounded-full',
          'p-1.5',
          mine ? 'bg-verdigris' : 'bg-oxblood',
        )}
      >
        <Portrait classId={u.classId} className={clsx('size-full')} />
      </span>
      <span
        className={clsx(
          'w-full',
          'truncate',
          'text-center',
          'text-[0.65rem]',
          'leading-tight',
        )}
      >
        {cls.name}
      </span>
      {active && (
        <span
          className={clsx(
            'text-[0.55rem]',
            'font-bold',
            'uppercase',
            'tracking-wider',
            'text-storm',
          )}
        >
          acting
        </span>
      )}
      {shift !== 0 && <ShiftBadge shift={shift} />}
    </li>
  );
}

function ActionCard({
  state,
  entry,
  mine,
  ghost,
  lit,
  shift,
  onHover,
}: {
  state: BattleState;
  entry: Extract<TimelineEntry, { kind: 'action' }>;
  mine: boolean;
  ghost: boolean;
  lit: boolean;
  shift: number;
  onHover: (seq: number | null) => void;
}) {
  const q = entry.action;
  const a = abilities[q.abilityId]!;
  const user = state.units.find((x) => x.id === q.unitId);
  const { side, slots } = actionSlots(state, q);
  const onOwnSide = user?.owner === side;
  const where = slots.length
    ? `${onOwnSide ? 'own ' : ''}lane ${[...new Set(slots.map((s) => s.col + 1))].join('+')}${
        slots.every((s) => s.row === slots[0]!.row)
          ? slots[0]!.row === 0
            ? ' front'
            : ' back'
          : ''
      }`
    : 'misses';
  const icon = { melee: '⚔', ranged: '➶', spell: '✦', support: '✚' }[a.kind];
  return (
    <li className={clsx('shrink-0')}>
      <button
        type="button"
        onMouseEnter={() => onHover(q.seq)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(q.seq)}
        onBlur={() => onHover(null)}
        className={clsx(
          'flex',
          'h-full',
          'min-w-28',
          'flex-col',
          'justify-center',
          'gap-0.5',
          'rounded-md',
          'border-l-4',
          'bg-umber',
          'px-2',
          'py-1',
          'text-left',
          'text-vellum',
          ghost
            ? [
                'border',
                'border-l-4',
                'border-dashed',
                'border-storm',
                'bg-storm/15',
              ]
            : mine
              ? 'border-verdigris-light'
              : 'border-oxblood-light',
          lit && ['ring-2', 'ring-storm'],
        )}
      >
        <span
          className={clsx(
            'flex',
            'items-center',
            'gap-1',
            'text-xs',
            'font-semibold',
          )}
        >
          <span
            aria-hidden
            className={clsx(
              mine ? 'text-verdigris-light' : 'text-oxblood-light',
            )}
          >
            {icon}
          </span>
          {ghost && <span className={clsx('text-storm')}>Planned:</span>}
          {a.name}
        </span>
        <span
          className={clsx(
            'flex',
            'items-center',
            'gap-1',
            'text-[0.65rem]',
            'text-vellum/65',
          )}
        >
          {user && (
            <Portrait classId={user.classId} className={clsx('size-3')} />
          )}
          {user ? heroClass(user.classId).name : ''} → {where}
        </span>
        {shift !== 0 && <ShiftBadge shift={shift} />}
      </button>
    </li>
  );
}

function ShiftBadge({ shift }: { shift: number }) {
  return (
    <span
      className={clsx(
        'rounded',
        'px-1',
        'text-[0.55rem]',
        'font-bold',
        'text-vellum',
        shift > 0 ? 'bg-oxblood' : 'bg-verdigris',
      )}
    >
      {shift > 0 ? `${shift} later` : `${-shift} sooner`}
    </span>
  );
}

function keyOf(e: TimelineEntry) {
  return e.kind === 'hero' ? `h:${e.unitId}` : `a:${e.action.seq}`;
}
