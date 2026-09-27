# Heroes Tactics — game design

Status: early draft, 2026-09-27. "Decided" means agreed for the prototype, not final. Open questions are collected at the end.

## Pitch

> Telegraphed formation battles on a shared timeline, with a party of heroes on a Heroes-style map. Asynchronous 1v1 with Elo.

You lead a small party of heroes across a fantasy map. You fight creeps, capture towns and build up your castles, then face your opponent in formation battles. In those battles every action is queued on a shared timeline, and the fight is about your formation, timing, and answering what's coming.

## Pillars

Every feature must serve one of these. If it serves none, cut it.

1. **Telegraphed formation battles.** Two 4×2 formations, one shared timeline where every action is queued and visible, small health numbers, exact previews, no randomness.
2. **Heroes are the army.** No recruitable troops or stacks. Every piece is a named hero with a class, a level, two equipped abilities and up to five items.
3. **Heroes-lite strategy.** A map, creeps and towns. What you build decides which heroes and moves you can get.

## Format

- 1v1, rated with chess-style Elo. Live and daily time controls have separate ratings.
- Players run several matches at once, like chess.com, so every turn works asynchronously.
- 20–45 minutes of play, depending on map size.

| Map    | Target length | Towns per player | Level cap |
| ------ | ------------- | ---------------- | --------- |
| Small  | ~20 min       | 1 + 1 neutral    | 3–4       |
| Medium | ~45 min       | 1 + 2–3 neutral  | 5         |

## Battles

Draft, 2026-09-27. This replaces the earlier 8×8-grid design with pushing and knockback.

**Every battle uses the same rules**, whether you're fighting another player or creeps.

### Formation

Each side has its own **4×2 formation**: 4 columns, front row and back row, 8 slots for up to 6 heroes. There's no shared board, no terrain and no pushing.

```
        ENEMY
   back   [Wl] [Dr] [  ] [  ]
   front  [DK] [As] [Wd] [  ]
   ──────────────────────────
   front  [Kn] [Rg] [  ] [Cb]
   back   [St] [  ] [  ] [  ]
        YOU
```

- **Melee** can only hit the enemy **front row**. While any enemy front-row slot holds a hero or a stone block, the back row is safe from melee. If the front row empties, the back row can be hit.
- **Ranged** attacks come in two kinds:
  - **Straight shots** (crossbows, Frost Arrow) fire down the attacker's own column and hit the **first hero or stone block in the way**, front row first. A front-liner shields whoever stands behind it.
  - **Arcing shots** (Arrow, Smoke Bomb) can't be obstructed and reach any slot.
- **Spells** hit **patterns** (below) and can't be obstructed.
- You arrange your formation before the battle, and heroes can reposition during it.

### The timeline

There are no whole turns. One **timeline** orders everything that will happen, as in Final Fantasy X or Grandia:

```
NOW ─► Rg · DK → Reap (front 1) · Kn · Wl → Hellfire (back 2–3) · As ...
```

- **Heroes** appear on the timeline when their next activation comes up. After acting, a hero goes back on **its recovery time** later: fast classes 3 ticks, normal 4, tanks 5. **Wait** skips acting and brings the hero back after half its recovery.
- **Every action is queued.** On its activation a hero chooses an ability and a target **slot**. The action goes on the timeline after the ability's **attack speed** in ticks, and resolves when the timeline reaches it. Quick abilities have a speed of 1; big ones 2–3.
- **Both players see every queued action:** who, which ability, and which slots. That's the telegraph. Aiming at slots, not heroes, is what makes it something you can play around.
- **Aim is relative to the attacker.** Melee has a fixed shape, such as straight ahead or diagonal; ranged attacks and spells pick a slot at a column offset. If the attacker is moved before its action lands (for example, an ally swaps with it), the action shifts with it. A melee attacker moved to the back row loses its action.
- **Ties:** queued actions resolve before heroes act on the same tick, in the order they were queued. Heroes on the same tick alternate sides.

### An activation

1. **Reposition (optional):** step to a neighbouring slot on your side. Stepping onto an ally swaps places with it; the ally keeps its place on the timeline, and its queued action shifts with it. Rooted heroes and heroes standing in frost can't move or be swapped, and stone blocks can't be entered. The step can be changed until the hero acts or waits.
2. **Act:** choose an ability and target, which queues it. Or **Wait**.

### Answering a telegraph

Before a queued action lands, the defender can:

- **Step out** of the targeted slot or pattern.
- **Block:** a spell or attack lands on whoever stands in the slot when it resolves, so a tank can step into a threatened slot. A filled front row keeps melee off the back row.
- **Interrupt:** knock out the attacker, turn it to 🪨 stone or put it in 🌫️ smoke, and its queued action is cancelled.
- **Delay:** ❄️ ice pushes the attacker's next turn back on the timeline, buying time before its next action.

### Patterns

Offensive patterns are placed on the enemy formation around a chosen slot:

| Pattern | Hits                                                                  |
| ------- | --------------------------------------------------------------------- |
| Single  | One slot                                                              |
| Pair    | A slot and the one beside it in the same row                          |
| Column  | Both slots of a column                                                |
| Row     | All four slots of a row                                               |
| Square  | Two adjacent columns, both rows (4 slots)                             |
| Cross   | A slot, its left and right neighbours, and the slot above or below it |

**Defensive patterns** are relative to the caster, on its own side: **self**, **adjacent** (left, right, or the slot in front of or behind it), or **behind** (the slot directly behind it).

### Health and damage

- Heroes have 2–4 health by role (caster 2, ranged 3, melee 4). Abilities deal 0–2 damage.
- There are no hit chances, critical hits or damage ranges. Every preview is exact.

### Effects

| Effect      | What it does                                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Burn 🔥     | 1 damage at the start of each of the hero's next **two** activations.                                          |
| Chill ❄️    | Pushes the hero's next activation later on the timeline (usually 2 ticks).                                     |
| Stun 🪨     | The hero skips its next activation and its queued actions are cancelled. The next damage only breaks the stun. |
| Haste       | Brings the hero's next activation sooner.                                                                      |
| Weak 💧     | The hero's next damaging action does 1 less damage.                                                            |
| Marked 🎯   | The next damage the hero takes is 1 more.                                                                      |
| Root 🌿     | The hero can't move, and can't be switched with, on its next activation.                                       |
| Shield 🛡️   | Blocks the next hit or harmful effect. Lasts until used.                                                       |
| Chain ⚡    | Damage spreads to every hero touching the target on its side, allies included.                                 |
| Stone block | Fills an empty front-row slot of your own. It has 2 health and blocks straight shots.                          |

### Slot statuses

Slots can carry statuses too. Each lasts a set number of its placer's turns, shown on the slot, and a new one replaces the old.

| Slot status | Effect                                                    | Lasts   | Made by                                              |
| ----------- | --------------------------------------------------------- | ------- | ---------------------------------------------------- |
| Fire 🔥     | 1 damage to a hero that steps in or starts its turn there | 2 turns | Hellfire, Ignite                                     |
| Smoke 🌫️    | The hero there can't attack; its queued attacks fizzle    | 1 turn  | Smoke Bomb                                           |
| Frost ❄️    | A hero standing there can't move or be swapped out        | 2 turns | Frost Arrow upgrade                                  |
| Thorns 🌿   | Anyone stepping in takes 1, friend or foe                 | 2 turns | Thorns upgrade                                       |
| Barrier 🛡️  | The hero standing there takes 1 less damage               | 1 turn  | Shield Wall, Stand Firm (a whole row), Aegis upgrade |

### Changing who gets hit, and when

- **Push and pull:** Shield Bash, Heave, Sweep, Concussive Bolt and Driving Shot knock a front-liner into the back row; Hook drags a back-liner to the front. The displaced hero swaps with whoever was there, carries its queued actions with it (a melee attack knocked into the back row fizzles), and triggers fire or thorns in its new slot. Rooted or frozen heroes can't be pushed or pulled.
- **Empower** (Inspire, Dark Pact): the ally's next hit does 1 more. **Quicken** (Rally): an ally's queued action lands sooner. **Mend** heals an ally. Haste and Wild Growth can target any ally.
- **Your own side too:** abilities that only move people (Gust, Twist) can be aimed at either side, alongside Intervene and Relocate. Because aim is relative to the caster, moving your own caster moves its queued spell: queue a spell, then swap or shove the caster to re-aim it once the enemy has committed. Damaging pushes stay enemy-only.
- **Sideways and swaps:** Trip, Uproot and Gust shove a hero one lane sideways, away from the attacker; Twist makes two enemies trade places; Intervene swaps the user with any ally; Relocate moves an ally to the other row of its lane.
- **Two-slot attacks** (Cleave, Scatter Shot, Twin Arrows, Sweep, Thunder) hit a pair or a column, but are slower or weaker than single-target ones.

- **Bodyguard:** until its next turn, the hero steps into the slot of a neighbour about to be hit by a single-slot attack, and takes the hit instead.
- **Taunt:** single-slot attacks on the hero's neighbours hit it instead, without moving anyone.
- **Shield Wall / Stand Firm:** lay a barrier across the hero's row. Protection belongs to the slot, so stepping out loses it and swapping in gains it.
- **Straight shots** stop at the first hero or stone block in the column.
- **Delay** (Dread, Disrupt) pushes an enemy's queued actions later; **interrupt** (Kidney Shot, some upgrades) cancels them; **stun** cancels them and skips a turn.
- **Haste** (Haste, Wild Growth, Quick Shot) brings a hero's next turn sooner; **chill** pushes it later.
- Before confirming an action, the timeline previews where it will land and which entries it shifts.

### Winning a battle

A side wins when the other has no heroes standing. If both sides fall to the same effect, the battle is a draw.

## Heroes

- **Class** decides health, recovery (how often it acts), **which abilities the hero can learn** (its primaries and secondaries) and which items it can wear.
- Loadouts (abilities and items) can be changed outside battle.
- **Levels:** heroes gain XP from battles and level up (cap from the table above). Each level gives an upgrade point (see below).
- **Abilities:** moves a hero **learns** with Essence, at the Mage Tower (spells, for caster classes) or the Barracks (attacks, for martial classes). A learned ability belongs to the hero.
- **Ability slots:** a hero equips **one primary and one secondary**, each chosen from its class's short list. Primaries are quick, dependable attacks; secondaries are heavier attacks, control, or protection.
- **Ability upgrades:** as in Into the Breach, each ability lists 1–2 upgrades (+1 damage, faster, an extra effect, a bigger pattern) that cost upgrade points. In the prototype every hero has 2 points to spend before a battle.
- **Items:** equipment **bought** with gold from a town's Market, or found on the map. It goes in the hero's 5 equipment slots (see below), separate from the ability slots.
- **Knock-out:** a hero who falls in battle isn't dead. You revive them at a town you own for gold scaled by level (starting at 100 × level; a Shrine makes it cheaper). They're available again from your next turn and keep their XP, points, abilities and items.
- **Loot:** abilities can never be taken. The winner of a battle picks **one equipped item** from each enemy hero they knocked out. If nobody in the party can equip it, it goes to the player's stash. Fully equipping a hero is a risk: the more you give them, the more your opponent can take.

### Equipment

| Slot       | Typical items                     | Typical effect                                           |
| ---------- | --------------------------------- | -------------------------------------------------------- |
| Head       | Helms, circlets, hoods            | +1 health, resist a status, see further on the map       |
| Body       | Armour, robes                     | +1–2 health, or −1 damage from one kind of attack        |
| Feet       | Boots                             | Faster recovery on the timeline, or free repositioning   |
| Left hand  | Shields, focuses, off-hand blades | Block 1 damage from the front, +1 to spells              |
| Right hand | Weapons, staves                   | +1 damage or faster attack speed for one kind of ability |

- Up to 5 items per hero. A two-handed item fills both hands.
- Items are passive: they change stats or improve abilities, but don't add new moves. The two ability slots stay the core of a hero's play.
- Class restrictions apply: a Cleric can't wear heavy armour, for example.
- Every item a hero wears is lootable, so a fully equipped hero is powerful and a big prize.

### Level-ups: upgrade points

Like Into the Breach's reactor cores: each level gives **1 point** to spend on the hero.

- **+1 health**
- **Faster recovery** on the timeline (−1 tick)
- **An ability upgrade:** each ability has 1–2 upgrades listed on it, such as +1 damage, faster attack speed, or a bigger pattern. An upgrade costs 1–2 points.

Ability upgrades belong to the hero, as abilities do. In town you can take points back off an unequipped ability and reassign them.

### Classes

Three basic classes per faction: a melee front-liner, a ranged attacker and a caster. Each class has 2 primaries and 3 secondaries to choose from. Advanced classes come later, once these nine play well.

| Class        | Faction | HP  | Recovery |
| ------------ | ------- | --- | -------- |
| Knight       | Light   | 4   | 5        |
| Crossbowman  | Light   | 3   | 4        |
| Stormcaller  | Light   | 2   | 4        |
| Death Knight | Dark    | 4   | 5        |
| Assassin     | Dark    | 4   | 3        |
| Warlock      | Dark    | 2   | 4        |
| Warden       | Nature  | 4   | 5        |
| Ranger       | Nature  | 3   | 3        |
| Druid        | Nature  | 2   | 4        |

Health follows role: casters 2, ranged 3, melee 4. Recovery (ticks until a hero's next activation) is 5 for tanks, 3 for fast classes (Assassin, Ranger) and 4 for the rest.

Damage starts low: most abilities do 1, a few heavy ones do 2, and utility abilities do 0 and only apply an effect. Other numbers are placeholders, to be tuned in playtesting.

See [Factions](#factions) for the class and ability lists. The prototype in `packages/rules` implements this design: all nine classes, every effect, and the timeline.

## Towns

Towns are where heroes come from and where they get stronger. Build one building per day. A match gives you time for fewer buildings than exist, so **your build order is your strategy**.

| Building                | Gives                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| Tavern                  | Hire your faction's basic hero classes                                         |
| Class halls             | Unlock stronger classes to hire                                                |
| Barracks (levels)       | **Attack** abilities for martial classes, learned with Essence                 |
| Mage Tower (levels 1–3) | **Spell** abilities for caster classes, learned with Essence, by tier          |
| Market                  | **Items** to buy with gold; the stock rotates weekly                           |
| Housing / Keep upgrades | Raise how many heroes the town can **support**                                 |
| Shrine                  | Revive fallen heroes, more cheaply at higher levels                            |
| Treasury                | More daily gold                                                                |
| Walls / Towers          | Siege defence: front-row walls and back-row towers in the defender's formation |

### Sieges

Attacking a town starts a battle on a siege board. The defender's side has:

- **Walls:** stone blocks already filling the defender's front row, with more health than usual.
- **1–2 towers:** fixed back-row pieces with their own place on the timeline, queuing ranged attacks.

An empty town still defends with its towers. A lone hero can't simply walk in, but a real party can take it.

### Hero capacity

- Each town supports a limited number of heroes. Upgrading its housing is how you grow your roster.
- A town supports **2 heroes**, raised to **3** and then **4** by housing upgrades. A full battle party of 6 therefore needs at least two towns, so battles start small and grow over the match.
- **Losing a town** lowers your capacity. If you're then over the limit, you choose which heroes to keep, and the rest are dismissed or sent away. Losing a castle hurts your roster, not just your income.

## Adventure map

- Heroes travel the map as a party, or split into parties.
- **Creeps** are neutral monster groups guarding resources, items and paths. They're fought in a battle against an AI, under the same battle rules as player-versus-player. If your party clearly outclasses them, you can **auto-resolve** for a predictable result, which saves time in daily games.

### Resources

| Resource  | Produced by       | Spent on                                       |
| --------- | ----------------- | ---------------------------------------------- |
| Gold      | Gold mines, towns | Hiring heroes, reviving, items from the Market |
| Materials | Workshops         | Buildings                                      |
| Essence   | Temples           | Abilities from the Mage Tower or Barracks      |

Each site is captured on the map and produces every day. Separating the resources keeps building up your towns, growing your roster and magic from all competing for the same gold.

- **Win the match** by taking all enemy towns and defeating all enemy heroes. A player with no town has a few days to retake one.

## Factions

Each faction has one element and one utility effect:

| Faction | Element      | Utility   | Plays like                                                 |
| ------- | ------------ | --------- | ---------------------------------------------------------- |
| Light   | ⚡ Lightning | 🛡️ Shield | Hits groups and protects its own                           |
| Dark    | 🔥 Fire      | 🌫️ Smoke  | Burns over time, and blinds casters so their spells fizzle |
| Nature  | ❄️ Ice       | 🪨 Stone  | Controls the board: slows, petrifies casters, raises walls |

Balance between factions is a loose rock-paper-scissors, not hard counters.

Generated from `packages/rules/src/content.ts`. Speed is ticks until the action lands; upgrade costs are in brackets.

### Light

| Class                       | Slot      | Ability         | Speed | What it does                                                           | Upgrades                                   |
| --------------------------- | --------- | --------------- | ----- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Knight (4 HP, every 5)      | Primary   | Bash            | 1     | Melee, straight ahead · 1 damage                                       | +1 damage (2), Weakens (1)                 |
|                             | Primary   | Cleave          | 2     | Melee, straight ahead and the slot to its right · 1 damage             | Faster (−1 tick) (2), Marks (1)            |
|                             | Primary   | Shield Bash     | 1     | Melee, straight ahead · 1 damage · knocks it into the back row         | +1 damage (2)                              |
|                             | Secondary | Bodyguard       | 1     | Self · steps in front of a neighbour about to be hit                   | Also shields itself (1)                    |
|                             | Secondary | Shield Wall     | 1     | Self · leaves a barrier (the hero there takes 1 less damage)           | Faster (−1 tick) (1)                       |
|                             | Secondary | Taunt           | 1     | Self · single attacks on its neighbours hit it instead                 | Also shields itself (1)                    |
|                             | Secondary | Rally           | 1     | Any ally · its queued actions land 1 sooner                            | 2 ticks sooner (1)                         |
|                             | Secondary | Intervene       | 0     | Any ally · you swap places with that ally                              | Also shields itself (1)                    |
| Crossbowman (3 HP, every 4) | Primary   | Bolt            | 1     | Straight shot down its column · 1 damage                               | +1 damage (2), Marks (1)                   |
|                             | Primary   | Aimed Shot      | 2     | Any enemy slot · 1 damage                                              | Faster (−1 tick) (2), +1 damage (2)        |
|                             | Primary   | Scatter Shot    | 2     | Any enemy slot and the slot to its right · 1 damage                    | Faster (−1 tick) (2)                       |
|                             | Secondary | Heavy Bolt      | 2     | Straight shot down its column · 2 damage                               | +1 damage (2), Interrupts (1)              |
|                             | Secondary | Pinning Bolt    | 1     | Straight shot down its column · 1 damage · root (can't move next turn) | Chills instead (1)                         |
|                             | Secondary | Suppress        | 1     | Straight shot down its column · weaken (its next hit does 1 less)      | +1 damage (1)                              |
|                             | Secondary | Concussive Bolt | 1     | Straight shot down its column · 1 damage · knocks it into the back row | Interrupts instead (1)                     |
| Stormcaller (2 HP, every 4) | Primary   | Spark           | 1     | Any enemy slot · 1 damage                                              | +1 damage (2), Chains (2)                  |
|                             | Primary   | Chain Lightning | 2     | Any enemy slot · 1 damage · chains to touching heroes                  | +1 damage (2), Faster (−1 tick) (2)        |
|                             | Secondary | Thunder         | 2     | Any enemy slot, whole column · 1 damage                                | +1 damage (2), Chills (1)                  |
|                             | Secondary | Aegis           | 1     | An adjacent ally · shield (blocks the next hit)                        | Faster (−1 tick) (1), Leaves a barrier (1) |
|                             | Secondary | Haste           | 1     | Any ally · next turn 2 sooner                                          | 3 ticks sooner (1)                         |
|                             | Secondary | Inspire         | 1     | Any ally · its next hit does 1 more                                    | Faster (−1 tick) (1)                       |
|                             | Secondary | Relocate        | 1     | Any ally · moves the ally to the other row of its lane                 | Faster (−1 tick) (1)                       |

### Dark

| Class                        | Slot      | Ability     | Speed | What it does                                                                                       | Upgrades                            |
| ---------------------------- | --------- | ----------- | ----- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Death Knight (4 HP, every 5) | Primary   | Reap        | 1     | Melee, straight ahead · 1 damage · burn (1 damage on its next 2 turns)                             | +1 damage (2)                       |
|                              | Primary   | Rend        | 1     | Melee, diagonally ahead · 1 damage · mark (the next hit on it does 1 more)                         | +1 damage (2)                       |
|                              | Primary   | Hook        | 1     | Melee into the back row ahead · drags it into the front row                                        | +1 damage (1)                       |
|                              | Secondary | Dread       | 1     | Melee, straight ahead · delays its queued actions by 2                                             | Delays 3 ticks (1), +1 damage (1)   |
|                              | Secondary | Drain       | 1     | Melee, straight ahead · 1 damage · heals itself 1                                                  | +1 damage (2)                       |
|                              | Secondary | Grim Guard  | 1     | Self · steps in front of a neighbour about to be hit                                               | Also shields itself (1)             |
|                              | Secondary | Sweep       | 1     | Melee, straight ahead and the slot to its right · knocks it into the back row                      | +1 damage (2)                       |
| Assassin (4 HP, every 3)     | Primary   | Stab        | 1     | Melee, diagonally ahead · 2 damage                                                                 | Burns (1)                           |
|                              | Primary   | Backstab    | 2     | Melee into the back row ahead · 1 damage                                                           | +1 damage (2), Faster (−1 tick) (2) |
|                              | Primary   | Trip        | 1     | Melee, diagonally ahead · 1 damage · shoves it one lane sideways, away from you                    | +1 damage (2)                       |
|                              | Secondary | Smoke Bomb  | 1     | Any enemy slot · leaves smoke (the hero there cannot attack)                                       | Two slots (2)                       |
|                              | Secondary | Expose      | 1     | Any enemy slot · mark (the next hit on it does 1 more)                                             | Two slots (1)                       |
|                              | Secondary | Kidney Shot | 1     | Melee, straight ahead · 1 damage · cancels its queued actions                                      | Stuns instead (2)                   |
|                              | Secondary | Shadowstep  | 0     | Self · next turn 2 sooner                                                                          | 3 ticks sooner (1)                  |
| Warlock (2 HP, every 4)      | Primary   | Fire Bolt   | 1     | Any enemy slot · 1 damage · burn (1 damage on its next 2 turns)                                    | +1 damage (2)                       |
|                              | Primary   | Hex         | 1     | Any enemy slot · weaken (its next hit does 1 less)                                                 | Two slots (1)                       |
|                              | Secondary | Hellfire    | 3     | Any enemy slot, 2×2 square · 1 damage · leaves fire (1 damage to whoever stands or steps there)    | Faster (−1 tick) (2)                |
|                              | Secondary | Ignite      | 1     | Any enemy slot · leaves fire (1 damage to whoever stands or steps there)                           | Two slots (1)                       |
|                              | Secondary | Disrupt     | 2     | Any enemy slot · delays its queued actions by 3                                                    | Faster (−1 tick) (2)                |
|                              | Secondary | Dark Pact   | 1     | Any ally · its next hit does 1 more                                                                | Faster (−1 tick) (1)                |
|                              | Secondary | Twist       | 2     | Any enemy slot and the slot to its right · the two heroes there swap places · works on either side | Faster (−1 tick) (2), +1 damage (2) |

### Nature

| Class                  | Slot      | Ability       | Speed | What it does                                                                       | Upgrades                        |
| ---------------------- | --------- | ------------- | ----- | ---------------------------------------------------------------------------------- | ------------------------------- |
| Warden (4 HP, every 5) | Primary   | Slam          | 1     | Melee, straight ahead · 1 damage · chill (next turn 2 later)                       | +1 damage (2)                   |
|                        | Primary   | Maul          | 2     | Melee, straight ahead · 2 damage                                                   | Interrupts (1)                  |
|                        | Primary   | Heave         | 1     | Melee, straight ahead · 1 damage · knocks it into the back row                     | +1 damage (2)                   |
|                        | Secondary | Stone Wall    | 1     | An empty front slot of your own · raises a stone block (2 health)                  | Faster (−1 tick) (1)            |
|                        | Secondary | Entangle      | 1     | Melee, straight ahead · root (can't move next turn)                                | +1 damage (1)                   |
|                        | Secondary | Stand Firm    | 1     | Self · leaves a barrier (the hero there takes 1 less damage)                       | Also shields itself (1)         |
|                        | Secondary | Uproot        | 1     | Melee, diagonally ahead · shoves it one lane sideways, away from you               | +1 damage (1)                   |
| Ranger (3 HP, every 3) | Primary   | Arrow         | 1     | Any enemy slot · 1 damage                                                          | +1 damage (2)                   |
|                        | Primary   | Quick Shot    | 1     | Straight shot down its column · 1 damage · its next turn 1 sooner                  | Next turn 2 sooner (1)          |
|                        | Primary   | Twin Arrows   | 2     | Any enemy slot, whole column · 1 damage                                            | Faster (−1 tick) (2)            |
|                        | Secondary | Frost Arrow   | 1     | Straight shot down its column · chill (next turn 2 later)                          | +1 damage (1), Leaves frost (1) |
|                        | Secondary | Volley        | 2     | A whole enemy row · 1 damage                                                       | Faster (−1 tick) (2)            |
|                        | Secondary | Hunter's Mark | 1     | Any enemy slot · mark (the next hit on it does 1 more)                             | Faster (−1 tick) (1)            |
|                        | Secondary | Driving Shot  | 1     | Straight shot down its column · 1 damage · knocks it into the back row             | +1 damage (2)                   |
| Druid (2 HP, every 4)  | Primary   | Thorns        | 1     | Any enemy slot · 1 damage                                                          | Roots (1), Leaves thorns (1)    |
|                        | Primary   | Quake         | 2     | A whole enemy row · 1 damage                                                       | Chills (1)                      |
|                        | Secondary | Petrify       | 3     | Any enemy slot · stun (skips its next turn, cancels its queued action)             | Faster (−1 tick) (2)            |
|                        | Secondary | Stoneskin     | 1     | An adjacent ally · shield that chills whoever hits it                              | Faster (−1 tick) (1)            |
|                        | Secondary | Wild Growth   | 1     | Any ally · next turn 2 sooner                                                      | 3 ticks sooner (1)              |
|                        | Secondary | Mend          | 1     | Any ally · heals 2                                                                 | Heals 3 (1)                     |
|                        | Secondary | Gust          | 1     | Any enemy slot · shoves it one lane sideways, away from you · works on either side | Whole column (2)                |

## Online play

- The server is authoritative: clients send commands, and the server validates them and returns events. The rules package is pure and deterministic, so matches can be replayed and audited.
- Clocks follow a chess-style time bank with an increment per turn. They don't pause for disconnects.
- Planned: profiles, Elo settlement, websocket live updates, and notifications (your turn, low time, match finished).

## Open questions

- Melee reach: the whole enemy front row (current draft), or only the frontmost hero in the attacker's own column?
- Attack speed for support: do defensive abilities need a speed of 1, or should they resolve at once?
- Should hidden information come back in any form (for example, a queued spell shows its caster but not its pattern)?
- How the timeline handles heroes joining mid-battle (summons, reinforcements), if ever.

Decided on 2026-09-27: creep fights, revive cost, loot, resources, party size, town capacity, level-ups and sieges (all above).

Still open:

- Upgrade point costs, and whether health/move points can also be reassigned or are permanent.
- How the auto-resolve result is calculated, and when it's allowed.
- Stash rules: shared between parties, or kept at a town and collected there?
- Towers: which attacks they queue, and whether attackers can destroy them.
- Starting resources and building costs across the three resources.
- Per-faction building lists and each faction's special building.
- Advanced classes (via class halls) for each faction.
- Smoke Bomb cancels a queued action: watch whether it's too strong.
- Faction names beyond Light, Dark and Nature.
