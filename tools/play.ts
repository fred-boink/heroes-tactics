// Play a battle from the terminal against the bot, one command per run.
//   pnpm play new <yourFaction> <botFaction> [seed]
//   pnpm play show
//   pnpm play move <col> <front|back>
//   pnpm play act <abilityId> <dc> <front|back> [own]   ((empty) aims hit no one yet)
//   pnpm play wait
// Columns and offsets are 0-based lanes. The game is saved to .play-state.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chooseActivation } from '@tactics/bot';
import {
  abilities,
  abilityText,
  actionSlots,
  activeUnit,
  aimOptions,
  applyCommand,
  BACK,
  COLUMNS,
  createBattle,
  factionParty,
  FRONT,
  groundAt,
  heroClass,
  hitsNothing,
  seededRandom,
  timeline,
  unitAbility,
  unitAt,
  type BattleEvent,
  type BattleState,
  type Command,
  type Faction,
  type PlayerId,
  type Row,
} from '@tactics/rules';

const file = '.play-state.json';
const [cmd, ...args] = process.argv.slice(2);

const name = (s: BattleState, id: string) => {
  const u = s.units.find((x) => x.id === id);
  return u
    ? `${u.owner === 0 ? 'my' : 'bot'} ${heroClass(u.classId).name}`
    : id;
};

function describe(s: BattleState, e: BattleEvent): string | null {
  switch (e.type) {
    case 'activated':
      return `— ${name(s, e.unitId)}'s turn`;
    case 'queued':
      return `${name(s, e.action.unitId)} queues ${abilities[e.action.abilityId]!.name} (lands t=${e.action.at})`;
    case 'landed':
      return `${name(s, e.unitId)}'s ${abilities[e.abilityId]!.name} lands`;
    case 'fizzled':
      return 'an action fizzles';
    case 'damaged':
      return `${name(s, e.unitId)} takes ${e.amount} (${e.hp} left)`;
    case 'knockedOut':
      return `${name(s, e.unitId)} is knocked out`;
    case 'statusApplied':
      return `${name(s, e.unitId)}: ${e.status}`;
    case 'displaced':
    case 'moved':
      return `${name(s, e.unitId)} moves ${e.from.col}${e.from.row ? 'b' : 'f'}→${e.to.col}${e.to.row ? 'b' : 'f'}`;
    case 'waited':
      return `${name(s, e.unitId)} braces`;
    case 'dodged':
      return `${name(s, e.unitId)} dodges`;
    case 'bodyBlocked':
      return `${name(s, e.unitId)} blocks the shot for ${name(s, e.protectedId)}`;
    case 'shieldBlocked':
      return `${name(s, e.unitId)}'s shield blocks`;
    case 'guarded':
      return `${name(s, e.unitId)} steps in front of ${name(s, e.protectedId)}`;
    case 'battleEnded':
      return `BATTLE OVER: ${e.winner === 0 ? 'I win' : e.winner === 1 ? 'the bot wins' : 'draw'}`;
    default:
      return null;
  }
}

function render(s: BattleState): string {
  const cell = (side: PlayerId, col: number, row: Row) => {
    const u = unitAt(s, side, { col, row });
    const g = groundAt(s, side, { col, row });
    const tag = u ? `${heroClass(u.classId).name.slice(0, 5)}${u.hp}` : '·';
    return `${tag}${g ? `[${g.kind}]` : ''}`.padEnd(14);
  };
  const lines = [
    '        my back       my front     |  bot front     bot back',
  ];
  for (let col = 0; col < COLUMNS; col++) {
    lines.push(
      `lane ${col}  ${cell(0, col, BACK)}${cell(0, col, FRONT)} |  ${cell(1, col, FRONT)}${cell(1, col, BACK)}`,
    );
  }
  lines.push('', 'Turn order:');
  for (const e of timeline(s).slice(0, 10)) {
    if (e.kind === 'hero')
      lines.push(`  t=${e.at}  turn   ${name(s, e.unitId)}`);
    else {
      const { side, slots } = actionSlots(s, e.action);
      lines.push(
        `  t=${e.at}  action ${name(s, e.action.unitId)}: ${abilities[e.action.abilityId]!.name} → ${side === 0 ? 'my' : 'bot'} ${slots.map((x) => `${x.col}${x.row ? 'b' : 'f'}`).join(',')}`,
      );
    }
  }
  const me = activeUnit(s);
  if (me && me.owner === 0) {
    lines.push(
      '',
      `My ${heroClass(me.classId).name} at lane ${me.pos!.col} ${me.pos!.row ? 'back' : 'front'} (${me.hp} HP):`,
    );
    for (const id of me.loadout) {
      const a = unitAbility(me, id);
      const aims = aimOptions(s, me, id)
        .map(
          (x) =>
            `${x.own ? 'own:' : ''}${x.dc}${x.row ? 'b' : 'f'}${hitsNothing(s, me.id, id, x) ? '(empty)' : ''}`,
        )
        .join(' ');
      lines.push(
        `  ${id} (speed ${a.speed}): ${abilityText(a)}  aims: ${aims}`,
      );
    }
  }
  return lines.join('\n');
}

function botUntilMyTurn(s: BattleState, log: string[]): BattleState {
  const random = seededRandom(Math.floor(s.time * 1000) + s.activations);
  while (s.winner === null) {
    const unit = activeUnit(s);
    if (!unit || unit.owner === 0) break;
    const before = s;
    for (const c of chooseActivation(s, {
      style: 'lookahead',
      noise: 0.3,
      random,
    })) {
      const r = applyCommand(s, c);
      if (!r.ok) break;
      for (const e of r.events) {
        const d = describe(before, e);
        if (d) log.push(d);
      }
      s = r.state;
    }
    if (s === before)
      s = applyCommand(s, { type: 'wait', unitId: unit.id }).ok
        ? (
            applyCommand(s, { type: 'wait', unitId: unit.id }) as {
              state: BattleState;
            }
          ).state
        : s;
  }
  return s;
}

let state: BattleState;
const log: string[] = [];
if (cmd === 'new') {
  const [mine, theirs, seed] = args as [Faction, Faction, string?];
  const random = seededRandom(Number(seed ?? 1));
  state = createBattle([
    ...factionParty(mine, 0, { random }),
    ...factionParty(theirs, 1, { random }),
  ]);
  state = botUntilMyTurn(state, log);
} else {
  if (!existsSync(file))
    throw new Error('No game: run `pnpm play new light dark`');
  state = JSON.parse(readFileSync(file, 'utf8'));
  const me = activeUnit(state);
  let command: Command | null = null;
  if (cmd === 'move' && me) {
    command = {
      type: 'move',
      unitId: me.id,
      to: { col: Number(args[0]), row: args[1] === 'back' ? BACK : FRONT },
    };
  } else if (cmd === 'act' && me) {
    command = {
      type: 'act',
      unitId: me.id,
      abilityId: args[0]!,
      aim: {
        dc: Number(args[1]),
        row: args[2] === 'back' ? BACK : FRONT,
        ...(args[3] === 'own' ? { own: true } : {}),
      },
    };
  } else if (cmd === 'wait' && me) {
    command = { type: 'wait', unitId: me.id };
  }
  if (command) {
    if (
      command.type === 'act' &&
      hitsNothing(state, command.unitId, command.abilityId, command.aim)
    ) {
      log.push(
        'Warning: nothing is there right now, so this only hits if someone moves in.',
      );
    }
    const r = applyCommand(state, command);
    if (!r.ok) {
      console.log(`Not allowed: ${r.error}`);
    } else {
      for (const e of r.events) {
        const d = describe(state, e);
        if (d) log.push(d);
      }
      state = botUntilMyTurn(r.state, log);
    }
  }
}
writeFileSync(file, JSON.stringify(state));
if (log.length) console.log(log.join('\n') + '\n');
console.log(render(state));
