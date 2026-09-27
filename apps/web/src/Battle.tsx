import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import { chooseActivation } from '@tactics/bot';
import {
  abilities,
  abilityText,
  actionSlots,
  activeUnit,
  applyCommand,
  createBattle,
  factionParty,
  heroClass,
  hitsNothing,
  inSmoke,
  moveOptions,
  previewAction,
  queuePreview,
  unitAbility,
  type BattleEvent,
  type BattleState,
  type Command,
  type PlayerId,
  type Slot,
  type Status,
} from '@tactics/rules';
import { Arrows, type Arrow, type Positions } from './Arrows';
import { Portrait } from './Portrait';
import { Stage, type Threat } from './Stage';
import { Timeline } from './Timeline';
import {
  candidates,
  describe,
  factionNames,
  outcomesOf,
  kindNames,
  slotKey,
  type Candidate,
  type GameConfig,
} from './game';

const botStepMs = 700;
/** Effects that change the timeline, so their preview shows the shift. */
const queueEffects = new Set(['haste', 'delay', 'chill', 'stun', 'interrupt']);

/**
 * What everything already queued will do if nobody moves, like Into the
 * Breach's enemy intents: damage, statuses and knockbacks per hero, plus
 * arrows for where heroes will be moved.
 */
function threatsOf(state: BattleState) {
  const threats = new Map<string, Threat>();
  const moves: {
    seq: number;
    side: PlayerId;
    from: Slot;
    to: Slot;
    unitId: string;
  }[] = [];
  for (const q of state.queue) {
    const { events } = previewAction(state, q.unitId, q.abilityId, q);
    const ticks = Math.round((q.at - state.time) * 10) / 10;
    for (const [unitId, o] of outcomesOf(events)) {
      const unit = state.units.find((u) => u.id === unitId);
      if (!unit) continue;
      if (o.damage === 0 && o.statuses.length === 0 && o.moves.length === 0)
        continue;
      const hostile = unit.owner !== q.owner || o.damage > 0;
      if (!hostile && o.moves.length === 0) continue;
      const t = threats.get(unitId) ?? {
        damage: 0,
        ticks: Infinity,
        effects: [],
        statuses: [],
        moved: false,
      };
      t.damage += o.damage;
      t.ticks = Math.min(t.ticks, ticks);
      t.effects.push(abilities[q.abilityId]!.name);
      for (const st of o.statuses)
        if (!t.statuses.includes(st)) t.statuses.push(st);
      t.moved ||= o.moves.length > 0;
      threats.set(unitId, t);
      for (const m of o.moves)
        moves.push({ seq: q.seq, side: unit.owner, unitId, ...m });
    }
  }
  return { threats, moves };
}

export function Battle({
  config,
  onRematch,
  onLeave,
}: {
  config: GameConfig;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const [state, setState] = useState<BattleState>(() =>
    createBattle([
      ...factionParty(config.factions[0], 0, {
        loadouts: config.loadouts[0],
        levels: config.levels[0],
      }),
      ...factionParty(config.factions[1], 1, {
        loadouts: config.loadouts[1],
        levels: config.levels[1],
      }),
    ]),
  );
  const [log, setLog] = useState<BattleEvent[]>([]);
  const [abilityId, setAbilityId] = useState<string | null>(null);
  /** The active hero's planned step, sent only with its action or Wait. */
  const [step, setStep] = useState<Slot | null>(null);
  /** A target picked but not yet confirmed. */
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverUnit, setHoverUnit] = useState<string | null>(null);
  const [hoverSeq, setHoverSeq] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hurt, setHurt] = useState<Set<string>>(new Set());
  const botBusy = useRef(false);

  const viewer: PlayerId = 0;
  const active = activeUnit(state);
  const humanTurn = Boolean(
    active &&
    state.winner === null &&
    (config.mode === 'hotseat' || active.owner === 0),
  );

  const record = useCallback((events: BattleEvent[]) => {
    setLog((l) => [...l, ...events]);
    const damaged = new Set(
      events.flatMap((e) => (e.type === 'damaged' ? [e.unitId] : [])),
    );
    if (damaged.size) {
      setHurt(damaged);
      setTimeout(() => setHurt(new Set()), 320);
    }
  }, []);

  const reset = () => {
    setStep(null);
    setAbilityId(null);
    setChosen(null);
  };

  const apply = (...commands: Command[]) => {
    let next = state;
    const events: BattleEvent[] = [];
    let failure: string | null = null;
    for (const command of commands) {
      const result = applyCommand(next, command);
      if (!result.ok) {
        failure = result.error;
        break;
      }
      next = result.state;
      events.push(...result.events);
    }
    setError(failure);
    setState(next);
    record(events);
    reset();
  };

  // The bot plays its hero's activation: a step first, then the action.
  useEffect(() => {
    if (config.mode !== 'bot' || state.winner !== null) return;
    const unit = activeUnit(state);
    if (!unit || unit.owner !== 1 || botBusy.current) return;
    botBusy.current = true;
    const plan = chooseActivation(state, { noise: 0.3 });
    let current = state;
    let i = 0;
    const stepOnce = () => {
      const command = plan[i++];
      if (!command) {
        botBusy.current = false;
        return;
      }
      const result = applyCommand(current, command);
      if (result.ok) {
        current = result.state;
        setState(current);
        record(result.events);
      }
      if (i < plan.length && result.ok) setTimeout(stepOnce, botStepMs);
      else botBusy.current = false;
    };
    setTimeout(stepOnce, botStepMs);
  }, [config.mode, state, record]);

  const moveCommand: Command | null =
    humanTurn &&
    active?.pos &&
    step &&
    (step.col !== active.pos.col || step.row !== active.pos.row)
      ? { type: 'move', unitId: active.id, to: step }
      : null;
  const shown = useMemo(() => {
    if (!moveCommand) return state;
    const r = applyCommand(state, moveCommand);
    return r.ok ? r.state : state;
  }, [state, moveCommand]);
  const actor = activeUnit(shown);

  const moveSlots = new Set<string>();
  const swapSlots = new Set<string>();
  if (humanTurn && active?.pos && !abilityId) {
    for (const slot of moveOptions(state, active)) {
      const k = slotKey(active.owner, slot);
      moveSlots.add(k);
      const ally = state.units.find(
        (u) =>
          u.id !== active.id &&
          u.owner === active.owner &&
          u.pos?.col === slot.col &&
          u.pos?.row === slot.row,
      );
      if (ally) swapSlots.add(k);
    }
  }

  const targets = useMemo(
    () =>
      humanTurn && actor && abilityId
        ? candidates(shown, actor, abilityId)
        : new Map<string, Candidate>(),
    [humanTurn, actor, abilityId, shown],
  );
  const focus = chosen ?? (hoverKey ? targets.get(hoverKey) : undefined);

  const preview = useMemo(() => {
    if (!focus || !actor || !abilityId) {
      return {
        slots: new Set<string>(),
        moves: [] as { unitId: string; from: Slot; to: Slot }[],
      };
    }
    const slots = new Set(focus.slots.map((s) => slotKey(focus.side, s)));
    const result = previewAction(shown, actor.id, abilityId, focus.aim);
    const outcome = new Map<string, number | null>();
    for (const u of result.state.units) {
      const before = shown.units.find((x) => x.id === u.id);
      if (before && (before.hp !== u.hp || (before.pos && !u.pos))) {
        outcome.set(u.id, u.pos ? u.hp : null);
      }
    }
    const statuses = new Map<string, Status[]>();
    const moves: { unitId: string; from: Slot; to: Slot }[] = [];
    for (const [unitId, o] of outcomesOf(result.events)) {
      if (o.statuses.length) statuses.set(unitId, o.statuses);
      for (const m of o.moves) moves.push({ unitId, ...m });
    }
    return { slots, outcome, statuses, moves };
  }, [focus, actor, abilityId, shown]);

  const timelinePreview = useMemo(() => {
    if (!focus || !actor || !abilityId) return null;
    const command = {
      type: 'act' as const,
      unitId: actor.id,
      abilityId,
      aim: focus.aim,
    };
    const queued = queuePreview(shown, command);
    if (!queued) return null;
    const a = unitAbility(actor, abilityId);
    const state =
      (a.effect && queueEffects.has(a.effect)) || a.selfHaste
        ? previewAction(queued, actor.id, abilityId, focus.aim).state
        : queued;
    return { state, ghostSeq: shown.nextSeq };
  }, [focus, actor, abilityId, shown]);

  const { threats, moves: queuedMoves } = useMemo(
    () => threatsOf(shown),
    [shown],
  );

  const arrows: Arrow[] = [];
  for (const q of shown.queue) {
    const user = shown.units.find((u) => u.id === q.unitId);
    if (!user?.pos) continue;
    const { side, slots } = actionSlots(shown, q);
    const lit =
      hoverSeq === q.seq ||
      hoverUnit === q.unitId ||
      slots.some((s) => slotKey(side, s) === hoverKey);
    arrows.push({
      id: `q${q.seq}`,
      from: slotKey(user.owner, user.pos),
      to: slots.map((s) => slotKey(side, s)),
      tone: q.owner === viewer ? 'mine' : 'theirs',
      label: String(Math.round((q.at - shown.time) * 10) / 10),
      emphasized: lit,
      faint: !lit,
    });
  }
  const sideOf = (unitId: string) =>
    shown.units.find((u) => u.id === unitId)?.owner ?? viewer;
  for (const m of queuedMoves) {
    arrows.push({
      id: `m${m.seq}-${m.unitId}`,
      from: slotKey(m.side, m.from),
      to: [slotKey(m.side, m.to)],
      tone: 'move',
      label: '',
      emphasized: hoverSeq === m.seq,
      faint: hoverSeq !== m.seq,
    });
  }
  for (const m of preview.moves) {
    const side = sideOf(m.unitId);
    arrows.push({
      id: `pm-${m.unitId}`,
      from: slotKey(side, m.from),
      to: [slotKey(side, m.to)],
      tone: 'move',
      label: '',
      emphasized: true,
    });
  }
  if (focus && actor?.pos && abilityId) {
    arrows.push({
      id: 'preview',
      from: slotKey(actor.owner, actor.pos),
      to: focus.slots.map((s) => slotKey(focus.side, s)),
      tone: 'preview',
      label: String(unitAbility(actor, abilityId).speed),
      emphasized: true,
    });
  }

  // Slot centres for the arrows, measured after layout.
  const board = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Positions>(new Map());
  const measure = useCallback(() => {
    const root = board.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next: Positions = new Map();
    root.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      const r = el.getBoundingClientRect();
      next.set(el.dataset.slot!, {
        x: r.left - base.left + r.width / 2,
        y: r.top - base.top + r.height / 2,
      });
    });
    setPositions((old) => {
      const same =
        old.size === next.size &&
        [...next].every(([k, p]) => {
          const o = old.get(k);
          return o && Math.abs(o.x - p.x) < 0.5 && Math.abs(o.y - p.y) < 0.5;
        });
      return same ? old : next;
    });
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    const root = board.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure]);

  const confirm = () => {
    if (!chosen || !actor || !abilityId) return;
    apply(...(moveCommand ? [moveCommand] : []), {
      type: 'act',
      unitId: actor.id,
      abilityId,
      aim: chosen.aim,
    });
  };
  const wait = () => {
    if (!actor) return;
    apply(...(moveCommand ? [moveCommand] : []), {
      type: 'wait',
      unitId: actor.id,
    });
  };

  const onSlot = (side: PlayerId, slot: Slot) => {
    if (!humanTurn) return;
    const k = slotKey(side, slot);
    const target = targets.get(k);
    if (target) {
      // First click picks the target; clicking it again confirms.
      if (chosen && chosen === target) confirm();
      else setChosen(target);
      return;
    }
    if (abilityId) {
      setChosen(null);
      return;
    }
    if (moveSlots.has(k)) {
      setStep(slot);
      return;
    }
    if (
      active?.pos &&
      side === active.owner &&
      slot.col === active.pos.col &&
      slot.row === active.pos.row
    ) {
      setStep(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (chosen) setChosen(null);
        else if (abilityId) setAbilityId(null);
        else setStep(null);
      }
      if (e.key === 'Enter' && chosen) confirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lines = useMemo(
    () =>
      log
        .map((e) => describe(e, state, config.mode))
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [log, state, config.mode],
  );
  const sideName = (side: PlayerId) =>
    config.mode === 'bot'
      ? side === 0
        ? `You · ${factionNames[config.factions[0]]}`
        : `Enemy · ${factionNames[config.factions[1]]}`
      : `Player ${side + 1} · ${factionNames[config.factions[side]]}`;
  const zoneTone: 'danger' | 'ward' =
    abilityId && abilities[abilityId]!.kind === 'support' ? 'ward' : 'danger';
  const inspected =
    shown.units.find((u) => u.id === hoverUnit && u.pos) ?? actor ?? null;

  return (
    <main
      className={clsx(
        'mx-auto',
        'grid',
        'max-w-[96rem]',
        'gap-5',
        'px-4',
        'py-5',
        'xl:grid-cols-[minmax(0,1fr)_20rem]',
        'lg:px-8',
      )}
    >
      <section
        aria-label="Battle"
        className={clsx('flex', 'min-w-0', 'flex-col', 'gap-4')}
      >
        <div
          className={clsx('flex', 'items-center', 'justify-between', 'gap-3')}
        >
          <h1 className={clsx('font-display', 'text-2xl', 'text-brass')}>
            Heroes Tactics
          </h1>
          <button
            type="button"
            onClick={onLeave}
            className={clsx(
              'rounded-full',
              'border',
              'border-brass/40',
              'px-4',
              'py-1.5',
              'text-sm',
              'hover:border-brass',
            )}
          >
            Leave battle
          </button>
        </div>

        <div
          className={clsx(
            'grid',
            'items-start',
            'gap-4',
            'lg:grid-cols-[14rem_minmax(0,1fr)]',
          )}
        >
          <Timeline
            state={shown}
            preview={timelinePreview?.state ?? null}
            ghostSeq={timelinePreview?.ghostSeq ?? null}
            viewer={viewer}
            highlightSeq={hoverSeq}
            onHoverAction={setHoverSeq}
          />

          <div ref={board} className={clsx('relative', 'w-full')}>
            <Stage
              state={shown}
              viewer={viewer}
              sideNames={[sideName(0), sideName(1)]}
              youLabel={(side) =>
                config.mode === 'bot'
                  ? side === 'left'
                    ? 'Your turn'
                    : 'Enemy turn'
                  : 'Acting'
              }
              activeId={shown.activeId}
              inspectId={hoverUnit}
              moveSlots={moveSlots}
              swapSlots={swapSlots}
              targetSlots={
                new Set(
                  [...targets.values()].flatMap((c) =>
                    c.slots.map((s) => slotKey(c.side, s)),
                  ),
                )
              }
              zoneTone={zoneTone}
              preview={preview}
              threats={threats}
              hurt={hurt}
              onSlot={onSlot}
              onHoverSlot={setHoverKey}
              onHoverUnit={setHoverUnit}
            />
            <Arrows arrows={arrows} positions={positions} />
          </div>
        </div>

        <TurnPanel
          state={shown}
          config={config}
          humanTurn={humanTurn}
          stepped={Boolean(moveCommand)}
          abilityId={abilityId}
          chosen={chosen}
          error={error}
          onAbility={(id) => {
            setChosen(null);
            setAbilityId(id === abilityId ? null : id);
          }}
          onResetStep={() => setStep(null)}
          onConfirm={confirm}
          onCancel={() => setChosen(null)}
          onWait={wait}
          onRematch={onRematch}
          onLeave={onLeave}
        />
      </section>

      <aside className={clsx('flex', 'flex-col', 'gap-4')}>
        {inspected && (
          <HeroCard
            state={shown}
            unitId={inspected.id}
            viewer={viewer}
            mode={config.mode}
            threat={threats.get(inspected.id)}
          />
        )}
        <Chronicle lines={lines} />
      </aside>
    </main>
  );
}

function TurnPanel({
  state,
  config,
  humanTurn,
  stepped,
  abilityId,
  chosen,
  error,
  onAbility,
  onResetStep,
  onConfirm,
  onCancel,
  onWait,
  onRematch,
  onLeave,
}: {
  state: BattleState;
  config: GameConfig;
  humanTurn: boolean;
  stepped: boolean;
  abilityId: string | null;
  chosen: Candidate | null;
  error: string | null;
  onAbility: (id: string) => void;
  onResetStep: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onWait: () => void;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const panel = clsx(
    'flex',
    'flex-col',
    'gap-3',
    'rounded-2xl',
    'border',
    'border-brass/40',
    'bg-gradient-to-b',
    'from-walnut-light',
    'to-walnut',
    'p-4',
    'shadow-xl',
    'shadow-black/40',
  );

  if (state.winner !== null) {
    const title =
      state.winner === 'draw'
        ? 'Draw'
        : config.mode === 'bot'
          ? state.winner === 0
            ? 'Victory'
            : 'Defeat'
          : `Player ${state.winner + 1} wins`;
    return (
      <section className={panel} aria-live="polite">
        <p className={clsx('font-display', 'text-3xl')}>{title}</p>
        <div className={clsx('flex', 'gap-2')}>
          <button
            type="button"
            onClick={onRematch}
            className={button('primary')}
          >
            Rematch
          </button>
          <button type="button" onClick={onLeave} className={button('quiet')}>
            Change heroes
          </button>
        </div>
      </section>
    );
  }

  const unit = activeUnit(state);
  if (!unit) return null;
  const cls = heroClass(unit.classId);
  const sideTone =
    unit.owner === 0
      ? ['border-2', 'border-verdigris-light']
      : ['border-2', 'border-oxblood-light'];
  const whose =
    config.mode === 'bot'
      ? unit.owner === 0
        ? 'Your'
        : 'Enemy'
      : `Player ${unit.owner + 1}:`;

  if (!humanTurn) {
    return (
      <section
        className={clsx(panel, sideTone, 'flex-row', 'items-center')}
        aria-live="polite"
      >
        <span
          className={clsx(
            'flex',
            'size-12',
            'items-center',
            'justify-center',
            'rounded-full',
            'bg-oxblood',
            'p-2',
            'text-vellum',
          )}
        >
          <Portrait classId={unit.classId} className={clsx('size-full')} />
        </span>
        <p className={clsx('font-display', 'text-xl')}>
          {whose} {cls.name} is acting…
        </p>
      </section>
    );
  }

  const blocked = inSmoke(state, unit);
  const stage = chosen ? 4 : abilityId ? 3 : 2;
  const stepLabel = (n: number, text: string) => (
    <li
      className={clsx(
        'flex',
        'items-center',
        'gap-1.5',
        n === stage
          ? 'text-storm'
          : n < stage
            ? 'text-vellum/70'
            : 'text-vellum/35',
      )}
    >
      <span
        className={clsx(
          'flex',
          'size-5',
          'items-center',
          'justify-center',
          'rounded-full',
          'border',
          'text-[0.65rem]',
          n === stage
            ? ['border-storm', 'bg-storm', 'text-ink']
            : 'border-current',
        )}
      >
        {n}
      </span>
      {text}
    </li>
  );
  const chosenAbility = abilityId ? unitAbility(unit, abilityId) : null;
  const empty =
    chosen && abilityId
      ? hitsNothing(state, unit.id, abilityId, chosen.aim)
      : false;

  return (
    <section className={clsx(panel, sideTone)} aria-label="Your turn">
      <div className={clsx('flex', 'flex-wrap', 'items-center', 'gap-3')}>
        <span
          className={clsx(
            'flex',
            'size-14',
            'items-center',
            'justify-center',
            'rounded-full',
            'border-2',
            'border-storm',
            'p-2',
            'text-vellum',
            unit.owner === 0 ? 'bg-verdigris' : 'bg-oxblood',
          )}
        >
          <Portrait classId={unit.classId} className={clsx('size-full')} />
        </span>
        <div className={clsx('flex', 'flex-col')}>
          <p className={clsx('font-display', 'text-2xl', 'leading-tight')}>
            {whose} {cls.name}
          </p>
          <p className={clsx('text-sm', 'text-vellum/60')}>
            {unit.hp} of {cls.maxHp} health · acts every {cls.recovery} ticks
          </p>
        </div>
        <ol
          className={clsx(
            'ml-auto',
            'flex',
            'flex-wrap',
            'gap-x-4',
            'gap-y-1',
            'text-sm',
          )}
        >
          {stepLabel(1, stepped ? 'Stepped' : 'Step (optional)')}
          {stepLabel(2, 'Choose ability')}
          {stepLabel(3, 'Pick target')}
          {stepLabel(4, 'Confirm')}
        </ol>
      </div>

      <div className={clsx('grid', 'gap-2', 'sm:grid-cols-3')}>
        {unit.loadout.map((id, index) => {
          const a = unitAbility(unit, id);
          const none = candidates(state, unit, id).size === 0;
          const on = abilityId === id;
          return (
            <button
              key={id}
              type="button"
              disabled={blocked || none}
              aria-pressed={on}
              onClick={() => onAbility(id)}
              className={clsx(
                'flex',
                'flex-col',
                'gap-0.5',
                'rounded-xl',
                'border',
                'px-3',
                'py-2',
                'text-left',
                'transition-colors',
                on
                  ? ['border-storm', 'bg-storm/15']
                  : [
                      'border-brass/40',
                      'bg-umber/50',
                      'enabled:hover:border-brass',
                    ],
                'disabled:opacity-40',
              )}
            >
              <span
                className={clsx(
                  'flex',
                  'items-baseline',
                  'justify-between',
                  'gap-2',
                )}
              >
                <span className={clsx('font-medium')}>{a.name}</span>
                <span
                  className={clsx(
                    'text-[0.65rem]',
                    'uppercase',
                    'tracking-wider',
                    'text-vellum/50',
                  )}
                >
                  {index === 0 ? 'Primary' : 'Secondary'} ·{' '}
                  {a.speed === 1 ? '1 tick' : `${a.speed} ticks`}
                </span>
              </span>
              <span className={clsx('text-xs', 'text-vellum/70')}>
                {none ? 'Nothing in reach from here.' : abilityText(a)}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onWait}
          className={clsx(
            'flex',
            'flex-col',
            'gap-0.5',
            'rounded-xl',
            'border',
            'border-brass/40',
            'bg-umber/50',
            'px-3',
            'py-2',
            'text-left',
            'hover:border-brass',
          )}
        >
          <span className={clsx('font-medium')}>Wait</span>
          <span className={clsx('text-xs', 'text-vellum/70')}>
            Do nothing; act again after {Math.ceil(cls.recovery / 2)} ticks
            instead of {cls.recovery}.
          </span>
        </button>
      </div>

      <div
        className={clsx(
          'flex',
          'min-h-9',
          'flex-wrap',
          'items-center',
          'gap-3',
          'text-sm',
        )}
        aria-live="polite"
      >
        {error && <span className={clsx('text-oxblood-light')}>{error}</span>}
        {!error && blocked && (
          <span>
            This hero is in smoke and can't attack. Step out, or Wait.
          </span>
        )}
        {!error && !blocked && stage === 2 && (
          <span className={clsx('text-vellum/70')}>
            Click a blue slot to step there first (⇄ swaps with that ally), or
            go straight to an ability.
          </span>
        )}
        {!error && stage === 3 && (
          <span className={clsx('text-vellum/70')}>
            Click a highlighted slot to aim {chosenAbility?.name}. Hover to
            preview it.
          </span>
        )}
        {stage === 4 && chosenAbility && (
          <>
            <span>
              <strong>{chosenAbility.name}</strong> lands in{' '}
              {chosenAbility.speed} tick
              {chosenAbility.speed === 1 ? '' : 's'}, on whoever is in the slot
              then.
            </span>
            {empty && (
              <span
                role="status"
                className={clsx(
                  'basis-full',
                  'rounded-md',
                  'border',
                  'border-oxblood-light/60',
                  'bg-oxblood/30',
                  'px-2',
                  'py-1',
                  'text-sm',
                  'text-vellum',
                )}
              >
                No one is there right now. This only hits if someone moves in
                before it lands.
              </span>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className={button('primary')}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={button('quiet')}
            >
              Pick again
            </button>
          </>
        )}
        {stepped && (
          <button
            type="button"
            onClick={onResetStep}
            className={clsx(button('quiet'), 'ml-auto')}
          >
            Undo step
          </button>
        )}
      </div>
    </section>
  );
}

function button(kind: 'primary' | 'quiet') {
  return clsx(
    'rounded-full',
    'px-5',
    'py-1.5',
    'text-sm',
    'font-medium',
    kind === 'primary'
      ? ['bg-storm', 'text-ink', 'hover:bg-brass']
      : ['border', 'border-brass/40', 'text-vellum', 'hover:border-brass'],
  );
}

function HeroCard({
  state,
  unitId,
  viewer,
  mode,
  threat,
}: {
  state: BattleState;
  unitId: string;
  viewer: PlayerId;
  mode: GameConfig['mode'];
  threat: Threat | undefined;
}) {
  const unit = state.units.find((u) => u.id === unitId && u.pos);
  if (!unit) return null;
  const cls = heroClass(unit.classId);
  const mine = unit.owner === viewer;
  const statuses = [
    unit.shielded && (unit.stoneskin ? 'stoneskin shield' : 'shielded'),
    unit.burning > 0 && `burning (${unit.burning} more)`,
    unit.petrified && 'stunned',
    unit.rooted && 'rooted',
    unit.weak && 'weak',
    unit.marked && 'marked',
    unit.guarding && 'bodyguarding',
    unit.taunting && 'taunting',
  ].filter(Boolean);
  return (
    <section
      aria-label={`${cls.name} details`}
      className={clsx(
        'flex',
        'flex-col',
        'gap-3',
        'rounded-2xl',
        'bg-gradient-to-b',
        'from-walnut-light',
        'to-walnut',
        'p-4',
        'shadow-xl',
        'shadow-black/30',
      )}
    >
      <div className={clsx('flex', 'items-center', 'gap-3')}>
        <span
          className={clsx(
            'flex',
            'size-12',
            'items-center',
            'justify-center',
            'rounded-full',
            'border-2',
            'border-brass',
            'p-2',
            'text-vellum',
            mine ? 'bg-verdigris' : 'bg-oxblood',
          )}
        >
          <Portrait classId={unit.classId} className={clsx('size-full')} />
        </span>
        <div>
          <h2 className={clsx('font-display', 'text-xl', 'leading-tight')}>
            {cls.name}
          </h2>
          <p
            className={clsx(
              'text-xs',
              mine ? 'text-verdigris-light' : 'text-oxblood-light',
            )}
          >
            {mode === 'hotseat'
              ? `Player ${unit.owner + 1}`
              : mine
                ? 'Yours'
                : 'Enemy'}{' '}
            · {factionNames[cls.faction]}
          </p>
        </div>
      </div>
      <p className={clsx('text-sm', 'text-vellum/70')}>
        {unit.hp} of {cls.maxHp} health · acts every {cls.recovery} ticks
        {statuses.length > 0 && ` · ${statuses.join(', ')}`}
      </p>
      {threat && (
        <p
          className={clsx(
            'rounded-lg',
            'bg-danger/20',
            'px-3',
            'py-2',
            'text-sm',
          )}
        >
          Incoming: {threat.damage} damage within {threat.ticks} tick
          {threat.ticks === 1 ? '' : 's'} ({threat.effects.join(', ')}). Move
          out of the slot, or block it.
        </p>
      )}
      <div className={clsx('flex', 'flex-col', 'gap-2')}>
        {unit.loadout.map((id, index) => {
          const a = unitAbility(unit, id);
          const level = unit.levels[id] ?? 0;
          const bought = (abilities[id]!.upgrades ?? []).slice(0, level);
          return (
            <div
              key={id}
              className={clsx(
                'flex',
                'flex-col',
                'gap-0.5',
                'rounded-xl',
                'border',
                'border-brass/25',
                'px-3',
                'py-2',
              )}
            >
              <span
                className={clsx(
                  'flex',
                  'items-baseline',
                  'justify-between',
                  'gap-2',
                )}
              >
                <span className={clsx('font-medium')}>{a.name}</span>
                <span className={clsx('text-[0.65rem]', 'text-vellum/55')}>
                  {index === 0 ? 'Primary' : 'Secondary'} · {kindNames[a.kind]}{' '}
                  · {a.speed === 1 ? '1 tick' : `${a.speed} ticks`}
                </span>
              </span>
              <span className={clsx('text-xs', 'text-vellum/75')}>
                {abilityText(a)}
              </span>
              {bought.length > 0 && (
                <span className={clsx('text-xs', 'text-storm')}>
                  Level {level}: {bought.map((u) => u.name).join(', ')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Chronicle({
  lines,
}: {
  lines: { text: string; tone: 'turn' | 'hit' | 'magic' | 'plain' }[];
}) {
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length]);
  return (
    <section
      aria-label="Chronicle"
      className={clsx(
        'flex',
        'max-h-[22rem]',
        'min-h-32',
        'flex-col',
        'rounded-2xl',
        'bg-gradient-to-b',
        'from-walnut',
        'to-umber',
        'p-4',
      )}
    >
      <h2 className={clsx('mb-2', 'font-display', 'text-lg')}>Chronicle</h2>
      <ol
        className={clsx(
          'flex',
          'flex-1',
          'flex-col',
          'gap-1',
          'overflow-y-auto',
          'pr-1',
          'text-sm',
        )}
      >
        {lines.map((line, i) => (
          <li
            key={i}
            className={clsx(
              line.tone === 'turn' && [
                'mt-1.5',
                'border-t',
                'border-brass/20',
                'pt-1.5',
                'font-display',
                'text-brass',
              ],
              line.tone === 'hit' && 'text-oxblood-light',
              line.tone === 'magic' && 'text-storm/90',
              line.tone === 'plain' && 'text-vellum/80',
            )}
          >
            {line.text}
          </li>
        ))}
        <li ref={end} aria-hidden />
      </ol>
    </section>
  );
}
