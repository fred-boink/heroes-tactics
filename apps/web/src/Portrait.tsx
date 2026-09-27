import clsx from 'clsx';
import { portraits } from './portraits.generated';

/** A class portrait (game-icons.net, CC BY 3.0), drawn in the current text colour. */
export function Portrait({
  classId,
  className,
}: {
  classId: string;
  className?: string;
}) {
  const p = portraits[classId];
  if (!p) return null;
  return (
    <svg
      viewBox={`0 0 ${p.size} ${p.size}`}
      className={clsx('fill-current', className)}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: p.body }}
    />
  );
}
