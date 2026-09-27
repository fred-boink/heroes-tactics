import clsx from 'clsx';

export interface Arrow {
  id: string;
  from: string;
  to: string[];
  tone: 'mine' | 'theirs' | 'preview' | 'move';
  label: string;
  emphasized?: boolean;
  /** Drawn thin and pale until hovered, to keep the board readable. */
  faint?: boolean;
}

export type Positions = Map<string, { x: number; y: number }>;

const colors = {
  mine: '#6fb3a6',
  theirs: '#e05a4f',
  preview: '#e8d27a',
  move: '#8cb9ff',
} as const;

/**
 * Curved arrows from each attacker to where its queued action will land, with
 * the ticks until it lands. Drawn over the formations; never takes clicks.
 */
export function Arrows({
  arrows,
  positions,
}: {
  arrows: Arrow[];
  positions: Positions;
}) {
  return (
    <svg
      className={clsx(
        'pointer-events-none',
        'absolute',
        'inset-0',
        'z-20',
        'h-full',
        'w-full',
        'overflow-visible',
      )}
      aria-hidden
    >
      <defs>
        {Object.entries(colors).map(([tone, color]) => (
          <marker
            key={tone}
            id={`head-${tone}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
      {arrows.map((a, i) => {
        const from = positions.get(a.from);
        const targets = a.to
          .map((k) => positions.get(k))
          .filter((p): p is { x: number; y: number } => Boolean(p));
        if (!from || targets.length === 0) return null;
        const to = {
          x: targets.reduce((s, p) => s + p.x, 0) / targets.length,
          y: targets.reduce((s, p) => s + p.y, 0) / targets.length,
        };
        const color = colors[a.tone];
        const width = a.emphasized ? 5 : a.faint ? 2 : 3;
        const dashed = a.tone === 'preview' || a.tone === 'move';
        if (Math.hypot(to.x - from.x, to.y - from.y) < 8) {
          return (
            <g key={a.id}>
              <circle
                cx={from.x}
                cy={from.y}
                r={34}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeDasharray={dashed ? '6 5' : undefined}
                opacity={0.9}
              />
              <Badge
                x={from.x + 30}
                y={from.y - 30}
                color={color}
                label={a.label}
              />
            </g>
          );
        }
        // Bend each arrow a little, alternating sides, so overlapping ones separate.
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const len = Math.hypot(to.x - from.x, to.y - from.y);
        const bend = (i % 2 === 0 ? 1 : -1) * Math.min(60, len * 0.25);
        const cx = mx + (-(to.y - from.y) / len) * bend;
        const cy = my + ((to.x - from.x) / len) * bend;
        // Stop short of the target centre so the head sits on the slot edge.
        const endX =
          to.x - ((to.x - cx) / Math.hypot(to.x - cx, to.y - cy)) * 22;
        const endY =
          to.y - ((to.y - cy) / Math.hypot(to.x - cx, to.y - cy)) * 22;
        const t = 0.55;
        const lx = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t * t * endX;
        const ly = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t * t * endY;
        return (
          <g key={a.id} opacity={a.emphasized ? 1 : a.faint ? 0.4 : 0.85}>
            <path
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${endX} ${endY}`}
              fill="none"
              stroke="rgba(20,14,10,0.55)"
              strokeWidth={width + 3}
              strokeLinecap="round"
            />
            <path
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${endX} ${endY}`}
              fill="none"
              stroke={color}
              strokeWidth={width}
              strokeLinecap="round"
              strokeDasharray={dashed ? '8 6' : undefined}
              markerEnd={`url(#head-${a.tone})`}
            />
            {targets.length > 1 &&
              targets.map((p, j) => (
                <circle
                  key={j}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill={color}
                  opacity={0.9}
                />
              ))}
            {a.label && <Badge x={lx} y={ly} color={color} label={a.label} />}
          </g>
        );
      })}
    </svg>
  );
}

function Badge({
  x,
  y,
  color,
  label,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
}) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={13}
        fill="#1d1612"
        stroke={color}
        strokeWidth={2}
      />
      <text
        x={x}
        y={y + 4.5}
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill={color}
        fontFamily="Alegreya Sans, system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
