// =============================================================================
// Landing hero backdrop — fine terminal grid with a few cells that brighten.
//
// SAFE TO REMOVE: delete this file and its single <HeroBackdrop /> usage in
// src/app/page.tsx. Nothing else references it.
//
// The grid is the design system's own motif ("1px border on every container,
// wireframe look") at background scale. The brightening cells are emerald —
// the money/WhatsApp colour — so they read as customers returning rather than
// as generic ambience.
//
// Tuning knobs are the four constants below.
// =============================================================================

const CELL_PX = 32 // grid pitch
const LINE = 'rgba(255,255,255,0.028)' // grid line colour — raise to make the grid more visible
const GLOW = 'rgba(16,185,129,0.45)' // cell colour (emerald / money)
const GLOW_PEAK = 0.55 // max opacity a cell reaches

// [column, row, animation-delay in seconds]. Columns are grid-aligned via
// calc(), so cells always land exactly on a square. High column numbers simply
// fall outside narrow viewports and are clipped.
//
// Deliberately kept to the left and right bands: the headline occupies the
// centre, and a cell brightening behind it would pull the eye off the copy.
const CELLS: Array<[number, number, number]> = [
  [2, 4, 0],
  [6, 10, 5.5],
  [1, 16, 11],
  [8, 22, 2.5],
  [4, 28, 8],
  [40, 3, 14],
  [44, 9, 4],
  [38, 15, 16],
  [45, 21, 9.5],
  [41, 27, 12.5],
]

export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="hero-backdrop pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="hero-backdrop__grid absolute inset-0" />
      {CELLS.map(([col, row, delay]) => (
        <span
          key={`${col}-${row}`}
          className="hero-backdrop__cell absolute block"
          style={{
            left: `calc(${col} * var(--cell))`,
            top: `calc(${row} * var(--cell))`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hero-backdrop { --cell: ${CELL_PX}px; }
        .hero-backdrop__grid {
          background-image:
            repeating-linear-gradient(to right, ${LINE} 0 1px, transparent 1px var(--cell)),
            repeating-linear-gradient(to bottom, ${LINE} 0 1px, transparent 1px var(--cell));
          /* Mask the GRID only — fade it out behind the headline so the
             texture never competes with the copy. The cells are positioned
             clear of the centre instead, so they must not be masked. */
          -webkit-mask-image: radial-gradient(ellipse 62% 54% at 50% 30%, transparent 0%, #000 78%);
          mask-image: radial-gradient(ellipse 62% 54% at 50% 30%, transparent 0%, #000 78%);
        }
        .hero-backdrop__cell {
          width: var(--cell);
          height: var(--cell);
          background: ${GLOW};
          opacity: 0;
          filter: blur(6px);
          animation: hero-cell-glow 18s ease-in-out infinite;
        }
        @keyframes hero-cell-glow {
          0%   { opacity: 0; }
          8%   { opacity: ${GLOW_PEAK}; }
          30%  { opacity: 0; }
          100% { opacity: 0; }
        }
        /* The cells sit in the left and right bands, which only exist on a
           wide viewport. On a phone those columns are the middle of the
           screen and a cell would brighten directly behind the headline. */
        @media (max-width: 767px) {
          .hero-backdrop__cell { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-backdrop__cell { animation: none; opacity: 0; }
        }
      `,
        }}
      />
    </div>
  )
}
