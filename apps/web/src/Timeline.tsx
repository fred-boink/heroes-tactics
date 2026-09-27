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
 * The turn order, like Final Fantasy X's: one row per event, top to bottom.
 * Turn rows are a hero deciding; indented action rows are a queued ability
 * executing. With a preview, it shows the order after the chosen action: the
 * new action is dashed, and rows it moves show how many places.
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
  const entries = timeline(shown).slice(0, 12);
  const beforeIndex = new Map<string, number>();
  timeline(state).forEach((e, i) => beforeIndex.set(keyOf(e), i));

  return (
    <section
      aria-label="Turn order"
      className={clsx(
        'flex',
        'flex-col',
        'gap-1.5',
        'rounded-2xl',
        'border-2',
        'p-2',
        preview
          ? ['border-storm/60', 'bg-storm/10']
          : ['border-brass/30', 'bg-umber/70'],
      )}
    >
      <h2
        className={clsx(
          'flex',
          'items-baseline',
          'justify-between',
          'px-1',
          'font-display',
          'text-sm',
          'tracking-wide',
          'text-brass',
        )}
      >
        Turn order
        {preview && (
          <span className={clsx('font-body', 'text-[0.65rem]', 'text-storm')}>
            preview
          </span>
        )}
      </h2>
      <ol className={clsx('flex', 'flex-col', 'gap-1')}>
        {entries.map((e, i) => {
          const k = keyOf(e);
          const old = beforeIndex.get(k);
          const ghost = e.kind === 'action' && e.action.seq === ghostSeq;
          // Positive: moved down the order (later); negative: moved up.
          const places = !ghost && old !== undefined && preview ? i - old : 0;
          return e.kind === 'hero' ? (
            <TurnRow
              key={k}
              state={shown}
              unitId={e.unitId}
              mine={e.owner === viewer}
              deciding={i === 0 && !preview && e.unitId === state.activeId}
              places={places}
            />
          ) : (
            <ActionRow
              key={k}
              state={shown}
              entry={e}
              mine={e.action.owner === viewer}
              ghost={ghost}
              lit={highlightSeq === e.action.seq}
              places={places}
              onHover={onHoverAction}
            />
          );
        })}
      </ol>
    </section>
  );
}

function TurnRow({
  state,
  unitId,
  mine,
  deciding,
  places,
}: {
  state: BattleState;
  unitId: string;
  mine: boolean;
  deciding: boolean;
  places: number;
}) {
  const u = state.units.find((x) => x.id === unitId)!;
  const cls = heroClass(u.classId);
  return (
    <li
      className={clsx(
        'relative',
        'flex',
        'items-center',
        'gap-2',
        'rounded-lg',
        'border-l-4',
        'py-1',
        'pl-1',
        'pr-2',
        mine
          ? ['border-verdigris-light', 'bg-verdigris/35']
          : ['border-oxblood-light', 'bg-oxblood/40'],
        deciding && [
          'ring-2',
          'ring-storm',
          'shadow-[0_0_14px_rgba(232,210,122,0.5)]',
        ],
      )}
    >
      <span
        className={clsx(
          'flex',
          'size-10',
          'shrink-0',
          'items-center',
          'justify-center',
          'rounded-md',
          'p-1.5',
          'text-vellum',
          mine ? 'bg-verdigris' : 'bg-oxblood',
        )}
      >
        <Portrait classId={u.classId} className={clsx('size-full')} />
      </span>
      <span className={clsx('flex', 'min-w-0', 'flex-col')}>
        <span
          className={clsx('truncate', 'text-sm', 'font-medium', 'text-vellum')}
        >
          {cls.name}
        </span>
        <span
          className={clsx(
            'text-[0.65rem]',
            'uppercase',
            'tracking-wider',
            'text-vellum/55',
          )}
        >
          {deciding ? 'deciding now' : 'turn'}
        </span>
      </span>
      {deciding && (
        <span
          aria-hidden
          className={clsx('ml-auto', 'text-lg', 'leading-none', 'text-storm')}
        >
          ◀
        </span>
      )}
      {places !== 0 && <PlacesBadge places={places} />}
    </li>
  );
}

function ActionRow({
  state,
  entry,
  mine,
  ghost,
  lit,
  places,
  onHover,
}: {
  state: BattleState;
  entry: Extract<TimelineEntry, { kind: 'action' }>;
  mine: boolean;
  ghost: boolean;
  lit: boolean;
  places: number;
  onHover: (seq: number | null) => void;
}) {
  const q = entry.action;
  const a = abilities[q.abilityId]!;
  const user = state.units.find((x) => x.id === q.unitId);
  const { side, slots } = actionSlots(state, q);
  const own = user?.owner === side;
  const lanes = [...new Set(slots.map((s) => s.col + 1))].join('+');
  const rows = new Set(slots.map((s) => s.row));
  const where = slots.length
    ? `${own ? 'own ' : ''}lane ${lanes}${rows.size === 1 ? (slots[0]!.row === 0 ? ' front' : ' back') : ''}`
    : 'nothing';
  const icon = { melee: '⚔', ranged: '➶', spell: '✦', support: '✚' }[a.kind];
  return (
    <li className={clsx('ml-5')}>
      <button
        type="button"
        onMouseEnter={() => onHover(q.seq)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(q.seq)}
        onBlur={() => onHover(null)}
        className={clsx(
          'relative',
          'flex',
          'w-full',
          'items-center',
          'gap-1.5',
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
        <span className={clsx('relative', 'shrink-0')}>
          <span
            className={clsx(
              'flex',
              'size-8',
              'items-center',
              'justify-center',
              'rounded-md',
              'p-1',
              'text-vellum',
              mine ? 'bg-verdigris' : 'bg-oxblood',
              ghost && ['ring-2', 'ring-storm'],
            )}
          >
            {user && (
              <Portrait classId={user.classId} className={clsx('size-full')} />
            )}
          </span>
          <span
            aria-hidden
            className={clsx(
              'absolute',
              '-bottom-1',
              '-right-1',
              'flex',
              'size-4',
              'items-center',
              'justify-center',
              'rounded-full',
              'border',
              'bg-ink',
              'text-[0.6rem]',
              'leading-none',
              mine
                ? ['border-verdigris-light', 'text-verdigris-light']
                : ['border-oxblood-light', 'text-oxblood-light'],
            )}
          >
            {icon}
          </span>
        </span>
        <span className={clsx('flex', 'min-w-0', 'flex-col')}>
          <span className={clsx('truncate', 'text-xs', 'font-semibold')}>
            {ghost && <span className={clsx('text-storm')}>Planned: </span>}
            {a.name}
          </span>
          <span
            className={clsx('truncate', 'text-[0.65rem]', 'text-vellum/60')}
          >
            {user ? heroClass(user.classId).name : ''} → {where}
          </span>
        </span>
        {places !== 0 && <PlacesBadge places={places} />}
      </button>
    </li>
  );
}

function PlacesBadge({ places }: { places: number }) {
  return (
    <span
      className={clsx(
        'absolute',
        '-right-1',
        '-top-1.5',
        'rounded',
        'px-1',
        'text-[0.55rem]',
        'font-bold',
        'text-vellum',
        places > 0 ? 'bg-oxblood' : 'bg-verdigris',
      )}
    >
      {places > 0 ? `▼ ${places}` : `▲ ${-places}`}
    </span>
  );
}

function keyOf(e: TimelineEntry) {
  return e.kind === 'hero' ? `h:${e.unitId}` : `a:${e.action.seq}`;
}
