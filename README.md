# Heroes Tactics

A fantasy strategy game: Into the Breach-style telegraphed battles with a party of heroes on a Heroes-style map. It's designed for asynchronous 1v1 play with Elo ratings.

Design: [docs/game-design.md](docs/game-design.md).

## Layout

| Path             | Contents                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| `packages/rules` | Pure, deterministic battle rules: 4×2 formations, the timeline, queued actions, effects |
| `packages/bot`   | A greedy bot that plays from its own view (no peeking at hidden spells)                 |
| `apps/web`       | Playable battle prototype: against the bot, or two players on one screen                |
| `tools/sim.ts`   | Bot-vs-bot simulator reporting balance and pacing numbers                               |

## Commands

```sh
pnpm install
pnpm dev        # battle prototype at http://127.0.0.1:3911
pnpm test       # rules tests
pnpm typecheck
pnpm sim 20 1   # 20 battles per faction pairing, seed 1
```

## Credits

Hero portraits are icons from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and other contributors, used under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They're extracted into `apps/web/src/portraits.generated.ts` by `node tools/portraits.mjs`.
