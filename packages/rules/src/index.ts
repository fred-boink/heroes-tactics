import { createBattle } from './engine';
import { factionParty } from './skirmish';
import type { BattleState } from './types';

export * from './types';
export * from './engine';
export * from './skirmish';
export { abilities, heroClasses, rolePool } from './content';

/** Prototype skirmish: a Light party against a Dark party. */
export function demoBattle(): BattleState {
  return createBattle([
    ...factionParty('light', 0),
    ...factionParty('dark', 1),
  ]);
}
