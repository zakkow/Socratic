import React from 'react';

// Multi-disciplinary academic chips positioned along perimeter edges
const DECORATIVE_MATH_ITEMS = [
  { symbol: 'a² + b² = c²', bg: '#ECFDF5', top: '8%', left: '3%', rot: '4deg', delay: '1.5s' },
  { symbol: 'Thesis ➔ Evidence', bg: '#FEE2E2', top: '8%', right: '3%', rot: '6deg', delay: '0s' },
  { symbol: 'O(n log n)', bg: '#E0E7FF', bottom: '12%', left: '3%', rot: '-8deg', delay: '0.3s' },
  { symbol: '∫ f(x)dx', bg: '#FEF3C7', bottom: '12%', right: '4%', rot: '-5deg', delay: '0.8s' },
  { symbol: 'DNA: A-T / C-G', bg: '#F3E8FF', top: '50%', left: '2%', rot: '-6deg', delay: '1.2s' },
  { symbol: 'Bill of Rights', bg: '#FEF3C7', top: '50%', right: '2%', rot: '7deg', delay: '0.5s' },
];

// Plotted Graph Coordinate Dots
const GRAPH_DOT_POINTS = [
  { cx: '14%', cy: '25%', label: '(x₁, y₁)', color: '#10B981' },
  { cx: '24%', cy: '72%', label: '(2, 5)', color: '#F59E0B' },
  { cx: '78%', cy: '30%', label: '(7, 9)', color: '#8B5CF6' },
  { cx: '86%', cy: '75%', label: '(x₂, y₂)', color: '#EC4899' },
];

export function CuteMathDecorations() {
  return (
    <div
      aria-hidden="true"
      className="cute-math-decorations-container"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 1, // Sits OVER background green shape (z-index: 0) and UNDER banner text (z-index: 2)
        userSelect: 'none',
      }}
    >
      {/* Mathematical Graph Paper Dot Grid Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(var(--color-ink) 1.5px, transparent 1.5px)',
          backgroundSize: '18px 18px',
          opacity: 0.12,
        }}
      />

      {/* Plotted Graph Coordinate Dots & Labels */}
      {GRAPH_DOT_POINTS.map((pt, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: pt.cx,
            top: pt.cy,
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            animation: `pulseMathShape 3.5s ease-in-out ${idx * 0.6}s infinite alternate`,
          }}
        >
          {/* Outer Ring & Solid Graph Point */}
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: pt.color,
              border: '1.5px solid var(--color-ink)',
              boxShadow: '1px 1px 0px var(--color-ink)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--color-ink)',
              background: 'rgba(255, 255, 255, 0.85)',
              padding: '0.1rem 0.35rem',
              borderRadius: '6px',
              border: '1px solid rgba(0, 0, 0, 0.15)',
            }}
          >
            {pt.label}
          </span>
        </div>
      ))}

      {/* Outer corner/edge math floating badges */}
      {DECORATIVE_MATH_ITEMS.map((item, idx) => (
        <div
          key={idx}
          className="cute-math-chip"
          style={{
            position: 'absolute',
            top: item.top,
            left: item.left,
            right: item.right,
            bottom: item.bottom,
            background: item.bg,
            border: '1.5px solid var(--color-ink)',
            borderRadius: '20px',
            padding: '0.2rem 0.6rem',
            fontSize: '0.74rem',
            fontWeight: 800,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink)',
            boxShadow: '2px 2px 0px var(--color-ink)',
            transform: `rotate(${item.rot})`,
            animation: `floatMathSymbol 4s ease-in-out ${item.delay} infinite alternate`,
            opacity: 0.9,
          }}
        >
          {item.symbol}
        </div>
      ))}

      {/* Outer corner SVG shapes */}
      <svg
        style={{
          position: 'absolute',
          top: '12%',
          right: '18%',
          width: '26px',
          height: '26px',
          animation: 'pulseMathShape 3.5s ease-in-out infinite alternate',
          opacity: 0.8,
        }}
        viewBox="0 0 24 24"
        fill="#10B981"
        stroke="var(--color-ink)"
        strokeWidth="2"
      >
        <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
      </svg>

      <svg
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '18%',
          width: '24px',
          height: '24px',
          animation: 'floatMathSymbol 5s ease-in-out 0.7s infinite alternate',
          opacity: 0.8,
        }}
        viewBox="0 0 24 24"
        fill="#F59E0B"
        stroke="var(--color-ink)"
        strokeWidth="2"
      >
        <polygon points="12,2 22,22 2,22" />
      </svg>

      <svg
        style={{
          position: 'absolute',
          top: '12%',
          left: '18%',
          width: '24px',
          height: '24px',
          animation: 'pulseMathShape 4s ease-in-out 1.4s infinite alternate',
          opacity: 0.8,
        }}
        viewBox="0 0 24 24"
        fill="#8B5CF6"
        stroke="var(--color-ink)"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
      </svg>
    </div>
  );
}
