import React from 'react';

export function StatusBadge({ status = 'online', size = 16 }) {
  const isOnline = status === 'online';
  const isDnd = status === 'dnd';
  const isAway = status === 'away';
  const isOffline = status === 'invisible' || status === 'offline';

  let bgColor = '#10B981'; // Green
  if (isDnd) bgColor = '#EF4444'; // Red
  if (isAway) bgColor = '#F59E0B'; // Amber
  if (isOffline) bgColor = '#6B7280'; // Slate Gray

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: bgColor,
        border: '1.5px solid var(--color-ink)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '1px 1px 0px rgba(0,0,0,0.2)',
        flexShrink: 0,
      }}
      title={`Status: ${status}`}
    >
      {/* Online Checkmark */}
      {isOnline && (
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}

      {/* Do Not Disturb X */}
      {isDnd && (
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}

      {/* Away Crescent Moon */}
      {isAway && (
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24" fill="#FFF" stroke="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}

      {/* Offline Donut Hole */}
      {isOffline && (
        <div
          style={{
            width: `${size * 0.38}px`,
            height: `${size * 0.38}px`,
            borderRadius: '50%',
            background: 'var(--color-surface, #FFF)',
          }}
        />
      )}
    </div>
  );
}
