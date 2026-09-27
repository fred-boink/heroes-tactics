import clsx from 'clsx';
import {
  BACK,
  blockAt,
  COLUMNS,
  FRONT,
  groundAt,
  heroClass,
  unitAt,
  type BattleState,
  type GroundKind,
  type PlayerId,
  type Row,
  type Slot,
  type Status,
  type Unit,
} from '@tactics/rules';
import { Portrait } from './Portrait';
import { slotKey, statusIcons } from './game';

export interface Threat {
  damage: number;
  ticks: number;
  /** Ability names that threaten this hero. */
  effects: string[];
  statuses: Status[];
  moved: boolean;
}

export interface StageProps {
  state: BattleState;
  /** The side drawn on the left. */
  viewer: PlayerId;
  sideNames: [string, string];
  /** "Your turn" for the player's side against the bot; "Their turn" otherwise. */
  youLabel: (side: 'left' | 'right') => string;
  activeId: string | null;
  inspectId: string | null;
  moveSlots: Set<string>;
  swapSlots: Set<string>;
  targetSlots: Set<string>;
  zoneTone: 'danger' | 'ward';
  /** The chosen or hovered target's slots, predicted health after it lands, and statuses it applies. */
  preview: {
    slots: Set<string>;
    outcome?: Map<string, number | null>;
    statuses?: Map<string, Status[]>;
  };
  threats: Map<string, Threat>;
  hurt: Set<string>;
  onSlot: (side: PlayerId, slot: Slot) => void;
  onHoverSlot: (key: string | null) => void;
  onHoverUnit: (id: string | null) => void;
}

/**
 * The two formations side by side: each side's front row faces the middle,
 * and the four columns run across the screen as lanes.
 */
export function Stage(props: StageProps) {
  const left = props.viewer;
  const actingSide = props.state.units.find(
    (u) => u.id === props.activeId,
  )?.owner;
  const right: PlayerId = left === 0 ? 1 : 0;
  const columns: { side: PlayerId; row: Row }[] = [
    { side: left, row: BACK },
    { side: left, row: FRONT },
    { side: right, row: FRONT },
    { side: right, row: BACK },
  ];
  const heading = clsx(
    'text-center',
    'text-[0.65rem]',
    'uppercase',
    'tracking-[0.2em]',
    'text-vellum/50',
  );
  return (
    <div
      className={clsx(
        'grid',
        'grid-cols-[1fr_1fr_2.25rem_1fr_1fr]',
        'items-center',
        'gap-x-2',
        'gap-y-2',
        'sm:gap-x-3',
      )}
    >
      <SideName
        name={props.sideNames[left]}
        mine
        acting={actingSide === left}
        you={props.youLabel}
      />
      <span />
      <SideName
        name={props.sideNames[right]}
        mine={false}
        acting={actingSide === right}
        you={props.youLabel}
      />
      <p className={heading}>Back</p>
      <p className={heading}>Front</p>
      <span />
      <p className={heading}>Front</p>
      <p className={heading}>Back</p>

      {Array.from({ length: COLUMNS }, (_, lane) => (
        <Lane key={lane} lane={lane} columns={columns} {...props} />
      ))}
    </div>
  );
}

function Lane({
  lane,
  columns,
  ...props
}: StageProps & { lane: number; columns: { side: PlayerId; row: Row }[] }) {
  return (
    <>
      {columns.slice(0, 2).map((c) => (
        <SlotCell
          key={`${c.side}${c.row}`}
          {...props}
          side={c.side}
          slot={{ col: lane, row: c.row }}
        />
      ))}
      <span
        className={clsx(
          'flex',
          'h-full',
          'flex-col',
          'items-center',
          'justify-center',
          'gap-1',
          'text-[0.6rem]',
          'uppercase',
          'tracking-widest',
          'text-vellum/35',
        )}
        aria-hidden
      >
        <span className={clsx('h-full', 'w-px', 'bg-brass/20')} />
        {lane + 1}
        <span className={clsx('h-full', 'w-px', 'bg-brass/20')} />
      </span>
      {columns.slice(2).map((c) => (
        <SlotCell
          key={`${c.side}${c.row}`}
          {...props}
          side={c.side}
          slot={{ col: lane, row: c.row }}
        />
      ))}
    </>
  );
}

function SlotCell({
  state,
  viewer,
  side,
  slot,
  activeId,
  inspectId,
  moveSlots,
  swapSlots,
  targetSlots,
  zoneTone,
  preview,
  threats,
  hurt,
  onSlot,
  onHoverSlot,
  onHoverUnit,
}: StageProps & { side: PlayerId; slot: Slot }) {
  const k = slotKey(side, slot);
  const unit = unitAt(state, side, slot);
  const block = blockAt(state, side, slot);
  const ground = groundAt(state, side, slot);
  const isFront = slot.row === FRONT;
  const move = moveSlots.has(k);
  const target = targetSlots.has(k);
  const previewed = preview.slots.has(k);
  const predicted = unit ? preview.outcome?.get(unit.id) : undefined;
  const label = `${side === viewer ? 'Your' : 'Enemy'} lane ${slot.col + 1} ${isFront ? 'front' : 'back'}${unit ? `: ${heroClass(unit.classId).name}` : ''}`;

  return (
    <button
      type="button"
      aria-label={label}
      data-slot={k}
      onClick={() => onSlot(side, slot)}
      onMouseEnter={() => {
        onHoverSlot(k);
        onHoverUnit(unit?.id ?? null);
      }}
      onMouseLeave={() => {
        onHoverSlot(null);
        onHoverUnit(null);
      }}
      onFocus={() => onHoverSlot(k)}
      onBlur={() => onHoverSlot(null)}
      className={clsx(
        'relative',
        'flex',
        'aspect-[8/5]',
        'w-full',
        'items-center',
        'justify-center',
        'overflow-hidden',
        'rounded-xl',
        'border',
        'transition-colors',
        isFront
          ? ['bg-vellum', 'border-ink/20']
          : ['bg-vellum-dark', 'border-ink/25'],
        'shadow-[inset_0_-3px_10px_rgba(42,35,32,0.2)]',
        unit?.id === activeId && [
          'ring-4',
          'ring-storm',
          'shadow-[0_0_24px_rgba(232,210,122,0.6)]',
        ],
      )}
    >
      {ground && <GroundMark kind={ground.kind} turns={ground.turns} />}
      {move && (
        <span
          className={clsx(
            'absolute',
            'inset-0',
            'bg-move/45',
            'shadow-[inset_0_0_0_3px_rgba(140,185,255,0.95)]',
          )}
          aria-hidden
        />
      )}
      {target && (
        <span
          className={clsx(
            'absolute',
            'inset-0',
            zoneTone === 'danger'
              ? [
                  'bg-danger/30',
                  'shadow-[inset_0_0_0_3px_rgba(255,140,120,0.95)]',
                ]
              : [
                  'bg-verdigris/35',
                  'shadow-[inset_0_0_0_3px_rgba(150,220,205,0.95)]',
                ],
          )}
          aria-hidden
        />
      )}
      {previewed && (
        <span
          className={clsx(
            'absolute',
            'inset-0',
            zoneTone === 'danger' ? 'bg-danger/65' : 'bg-verdigris/65',
          )}
          aria-hidden
        />
      )}
      {swapSlots.has(k) && (
        <span
          className={clsx(
            'absolute',
            'right-1.5',
            'top-1',
            'z-10',
            'rounded',
            'bg-move',
            'px-1',
            'text-xs',
            'font-bold',
            'text-vellum',
          )}
          aria-hidden
        >
          ⇄ swap
        </span>
      )}
      {block && (
        <span
          className={clsx(
            'relative',
            'flex',
            'size-[60%]',
            'items-center',
            'justify-center',
            'rounded-lg',
            'bg-slate',
            'font-display',
            'text-lg',
            'text-vellum',
            'shadow-[inset_0_-6px_10px_rgba(0,0,0,0.45)]',
          )}
          title="Stone block"
        >
          {block.hp}
        </span>
      )}
      {unit && (
        <Token
          unit={unit}
          mine={unit.owner === viewer}
          active={unit.id === activeId}
          inspected={unit.id === inspectId}
          hurt={hurt.has(unit.id)}
          predicted={predicted}
          predictedStatuses={preview.statuses?.get(unit.id)}
          threat={threats.get(unit.id)}
        />
      )}
      {move && !unit && (
        <span
          className={clsx(
            'relative',
            'rounded',
            'bg-umber/60',
            'px-1.5',
            'text-xs',
            'text-vellum',
          )}
          aria-hidden
        >
          Step here
        </span>
      )}
    </button>
  );
}

function Token({
  unit,
  mine,
  active,
  inspected,
  hurt,
  predicted,
  predictedStatuses,
  threat,
}: {
  unit: Unit;
  mine: boolean;
  active: boolean;
  inspected: boolean;
  hurt: boolean;
  predicted: number | null | undefined;
  predictedStatuses: Status[] | undefined;
  threat: Threat | undefined;
}) {
  const cls = heroClass(unit.classId);
  const hpAfter =
    predicted === undefined ? unit.hp : predicted === null ? 0 : predicted;
  const loss = unit.hp - hpAfter;
  const statuses = [
    unit.shielded && ['🛡', 'Shielded: blocks the next hit'],
    unit.burning > 0 && [
      '🔥',
      `Burning: 1 damage on each of its next ${unit.burning} turns`,
    ],
    unit.petrified && ['🪨', 'Stunned: skips its next turn'],
    unit.rooted && ['🌿', "Rooted: can't move next turn"],
    unit.taunting && ['⚑', 'Taunting'],
    unit.guarding && ['⛨', 'Bodyguard'],
    unit.marked && ['🎯', 'Marked: the next hit does 1 more'],
    unit.weak && ['💧', 'Weak: its next hit does 1 less'],
  ].filter((x): x is [string, string] => Boolean(x));

  return (
    <span
      className={clsx(
        'relative',
        'flex',
        'h-full',
        'w-full',
        'flex-col',
        'items-center',
        'justify-center',
        'gap-1',
        'p-1',
        hurt && 'hurt',
        predicted === null && 'opacity-40',
      )}
    >
      <span
        className={clsx(
          'flex',
          'size-[62%]',
          'max-h-16',
          'max-w-16',
          'items-center',
          'justify-center',
          'rounded-full',
          'border-[3px]',
          'border-brass',
          'bg-gradient-to-b',
          'p-2.5',
          'text-vellum',
          'shadow-[0_4px_8px_rgba(0,0,0,0.45)]',
          mine
            ? ['from-verdigris-light', 'to-verdigris']
            : ['from-oxblood-light', 'to-oxblood'],
          active && [
            'ring-4',
            'ring-storm',
            'ring-offset-2',
            'ring-offset-vellum',
          ],
          inspected && !active && ['ring-2', 'ring-ink/60'],
          unit.petrified && ['grayscale', 'brightness-75'],
          !mine && '-scale-x-100',
        )}
      >
        <Portrait classId={unit.classId} className={clsx('size-full')} />
      </span>
      <span className={clsx('flex', 'gap-[3px]')} aria-hidden>
        {Array.from({ length: cls.maxHp }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'size-2',
              'rounded-full',
              'border',
              'border-ink/40',
              i < hpAfter
                ? mine
                  ? 'bg-verdigris'
                  : 'bg-oxblood'
                : i < unit.hp
                  ? ['bg-fire', 'animate-pulse']
                  : 'bg-ink/15',
            )}
          />
        ))}
      </span>
      <span className={clsx('sr-only')}>
        {cls.name}, {unit.hp} of {cls.maxHp} health
      </span>
      {statuses.length > 0 && (
        <span
          className={clsx(
            'absolute',
            'right-1',
            'top-1',
            'flex',
            'flex-col',
            'gap-px',
            'text-sm',
            'leading-none',
          )}
        >
          {statuses.map(([icon, text]) => (
            <span key={text} title={text}>
              {icon}
            </span>
          ))}
        </span>
      )}
      {threat &&
        (threat.damage > 0 || threat.statuses.length > 0 || threat.moved) &&
        loss === 0 &&
        !predictedStatuses?.length && (
          <span
            title={`Incoming within ${threat.ticks} tick${threat.ticks === 1 ? '' : 's'}: ${threat.effects.join(', ')}`}
            className={clsx(
              'absolute',
              'left-1',
              'top-1',
              'flex',
              'items-center',
              'gap-0.5',
              'rounded-md',
              'bg-danger',
              'px-1.5',
              'py-0.5',
              'text-xs',
              'font-bold',
              'leading-none',
              'text-vellum',
              'shadow',
            )}
          >
            {threat.damage > 0 && <span>−{threat.damage}</span>}
            {threat.statuses.map((st) => (
              <span key={st} aria-hidden>
                {statusIcons[st]}
              </span>
            ))}
            {threat.moved && <span aria-hidden>⇄</span>}
            <span className={clsx('font-normal', 'opacity-80')}>
              in {threat.ticks}
            </span>
          </span>
        )}
      {predictedStatuses && predictedStatuses.length > 0 && (
        <span
          className={clsx(
            'absolute',
            'bottom-1',
            'left-1/2',
            'flex',
            '-translate-x-1/2',
            'gap-0.5',
            'rounded-md',
            'bg-ink',
            'px-1.5',
            'py-0.5',
            'text-sm',
            'leading-none',
          )}
        >
          {predictedStatuses.map((st) => (
            <span key={st} title={st}>
              {statusIcons[st]}
            </span>
          ))}
        </span>
      )}
      {loss > 0 && (
        <span
          className={clsx(
            'absolute',
            'left-1/2',
            'top-1',
            '-translate-x-1/2',
            'rounded-md',
            'bg-ink',
            'px-2',
            'py-0.5',
            'font-display',
            'text-base',
            'leading-none',
            'text-fire',
          )}
        >
          {predicted === null ? 'KO' : `−${loss}`}
        </span>
      )}
    </span>
  );
}

const groundLooks: Record<
  GroundKind,
  { icon: string; label: string; fill: string }
> = {
  fire: {
    icon: '🔥',
    label: 'Fire: 1 damage to whoever stands or steps here',
    fill: 'bg-[radial-gradient(circle_at_50%_80%,rgba(217,119,43,0.7)_0%,rgba(217,119,43,0.25)_60%,transparent_100%)]',
  },
  smoke: {
    icon: '🌫️',
    label: 'Smoke: the hero here cannot attack',
    fill: 'bg-[radial-gradient(circle,rgba(80,74,70,0.8)_0%,rgba(80,74,70,0.35)_75%,transparent_100%)]',
  },
  frost: {
    icon: '❄️',
    label: 'Frost: the hero here cannot move or be swapped',
    fill: 'bg-[radial-gradient(circle,rgba(156,195,213,0.75)_0%,rgba(156,195,213,0.3)_70%,transparent_100%)]',
  },
  thorns: {
    icon: '🌿',
    label: 'Thorns: anyone stepping in takes 1',
    fill: 'bg-[repeating-linear-gradient(45deg,rgba(63,127,116,0.4)_0_6px,transparent_6px_12px)]',
  },
  barrier: {
    icon: '🛡️',
    label: 'Barrier: the hero here takes 1 less damage',
    fill: 'bg-[radial-gradient(circle,rgba(232,210,122,0.5)_0%,rgba(232,210,122,0.18)_70%,transparent_100%)]',
  },
};

function GroundMark({ kind, turns }: { kind: GroundKind; turns: number }) {
  const look = groundLooks[kind];
  return (
    <>
      <span className={clsx('absolute', 'inset-0', look.fill)} aria-hidden />
      <span
        title={`${look.label} (${turns} more turn${turns === 1 ? '' : 's'} of its caster)`}
        className={clsx(
          'absolute',
          'bottom-1',
          'left-1',
          'z-10',
          'flex',
          'items-center',
          'gap-0.5',
          'rounded',
          'bg-umber/75',
          'px-1',
          'text-[0.7rem]',
          'leading-tight',
          'text-vellum',
        )}
      >
        <span aria-hidden>{look.icon}</span>
        {turns}
        <span className={clsx('sr-only')}>{look.label}</span>
      </span>
    </>
  );
}

function SideName({
  name,
  mine,
  acting,
  you,
}: {
  name: string;
  mine: boolean;
  acting: boolean;
  you: StageProps['youLabel'];
}) {
  return (
    <p
      className={clsx(
        'col-span-2',
        'flex',
        'items-center',
        'justify-center',
        'gap-2',
        'rounded-full',
        'py-1',
        'font-display',
        'text-lg',
        'transition-colors',
        mine ? 'text-verdigris-light' : 'text-oxblood-light',
        acting &&
          (mine
            ? ['bg-verdigris/25', 'ring-2', 'ring-verdigris-light']
            : ['bg-oxblood/30', 'ring-2', 'ring-oxblood-light']),
      )}
    >
      {name}
      {acting && (
        <span
          className={clsx(
            'rounded-full',
            'px-2',
            'py-0.5',
            'font-body',
            'text-xs',
            'font-bold',
            'uppercase',
            'tracking-wider',
            'text-vellum',
            mine ? 'bg-verdigris' : 'bg-oxblood',
          )}
        >
          {you(mine ? 'left' : 'right')}
        </span>
      )}
    </p>
  );
}
