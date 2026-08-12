import React from 'react';

export const AVATAR_SEEDS = [
  '{"species":"cat","fur":"#F97316","hair":"spiky","outfit":"hoodie","outfitColor":"#059669"}',
  '{"species":"dog","fur":"#FDE68A","hair":"beanie","outfit":"letterman","outfitColor":"#1E3A8A"}',
  '{"species":"cat","fur":"#10B981","hair":"glasses","outfit":"tshirt","outfitColor":"#C97B4A"}',
  '{"species":"dog","fur":"#374151","hair":"curly","outfit":"suit","outfitColor":"#1F2421"}',
  '{"species":"cat","fur":"#F43F5E","hair":"spiky","outfit":"hoodie","outfitColor":"#059669"}',
];

export function AvatarIcon({ seed = '{"species":"cat","fur":"#F97316","hair":"spiky","outfit":"hoodie","outfitColor":"#059669"}', size = 40 }) {
  let config = {
    species: 'cat',
    fur: '#F97316',
    hair: 'spiky',
    outfit: 'hoodie',
    outfitColor: '#059669',
  };

  try {
    if (seed && seed.startsWith('{')) {
      config = { ...config, ...JSON.parse(seed) };
    } else {
      const isDogSeed = (seed || '').includes('2') || (seed || '').includes('adventurer');
      config.species = isDogSeed ? 'dog' : 'cat';
    }
  } catch {
    // Ignore parse error
  }

  const { species, fur, hair, outfit, outfitColor } = config;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: '50%', border: '2px solid #1F2421', background: '#ECFDF5', overflow: 'hidden' }}
    >
      {/* Background circle fill */}
      <circle cx="50" cy="50" r="48" fill="#ECFDF5" />

      {/* Outfit / Clothing Layer */}
      {outfit === 'hoodie' && (
        <path d="M 20 85 C 20 65, 80 65, 80 85 L 85 100 L 15 100 Z" fill={outfitColor} stroke="#1F2421" strokeWidth="3" />
      )}
      {outfit === 'letterman' && (
        <g>
          <path d="M 20 85 C 20 65, 80 65, 80 85 L 85 100 L 15 100 Z" fill={outfitColor} stroke="#1F2421" strokeWidth="3" />
          <path d="M 40 70 L 50 85 L 60 70" stroke="#FFF" strokeWidth="3" fill="none" />
        </g>
      )}
      {outfit === 'tshirt' && (
        <path d="M 25 88 C 25 72, 75 72, 75 88 L 82 100 L 18 100 Z" fill={outfitColor} stroke="#1F2421" strokeWidth="3" />
      )}
      {outfit === 'suit' && (
        <g>
          <path d="M 20 85 C 20 65, 80 65, 80 85 L 85 100 L 15 100 Z" fill={outfitColor} stroke="#1F2421" strokeWidth="3" />
          <polygon points="50,70 45,85 55,85" fill="#FFF" />
          <polygon points="50,75 48,90 52,90" fill="#F43F5E" />
        </g>
      )}

      {/* Ears Layer (Species Dependent) */}
      {species === 'cat' ? (
        <g>
          {/* Pointy Cat Ears */}
          <polygon points="24,38 18,12 40,28" fill={fur} stroke="#1F2421" strokeWidth="3.5" strokeLinejoin="round" />
          <polygon points="26,34 22,18 36,28" fill="#FFD1DC" />

          <polygon points="76,38 82,12 60,28" fill={fur} stroke="#1F2421" strokeWidth="3.5" strokeLinejoin="round" />
          <polygon points="74,34 78,18 64,28" fill="#FFD1DC" />
        </g>
      ) : (
        <g>
          {/* Floppy Dog Ears */}
          <path d="M 25 35 C 10 35, 10 60, 22 55 C 25 50, 26 40, 25 35 Z" fill={fur} stroke="#1F2421" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M 75 35 C 90 35, 90 60, 78 55 C 75 50, 74 40, 75 35 Z" fill={fur} stroke="#1F2421" strokeWidth="3.5" strokeLinejoin="round" />
        </g>
      )}

      {/* Head Base Shape */}
      <ellipse cx="50" cy="50" rx="30" ry="26" fill={fur} stroke="#1F2421" strokeWidth="3.5" />

      {/* Snout / Muzzle */}
      <ellipse cx="50" cy="56" rx="14" ry="10" fill="#FFF" stroke="#1F2421" strokeWidth="2" />
      {/* Nose */}
      <polygon points="50,52 46,47 54,47" fill="#1F2421" />

      {/* Eyes */}
      <ellipse cx="38" cy="45" rx="4" ry="5" fill="#1F2421" />
      <ellipse cx="62" cy="45" rx="4" ry="5" fill="#1F2421" />
      <circle cx="39" cy="43" r="1.5" fill="#FFF" />
      <circle cx="63" cy="43" r="1.5" fill="#FFF" />

      {/* Cheeks */}
      <circle cx="32" cy="54" r="3.5" fill="#FFB7B2" opacity="0.7" />
      <circle cx="68" cy="54" r="3.5" fill="#FFB7B2" opacity="0.7" />

      {/* Hair / Accessories Layer */}
      {hair === 'spiky' && (
        <path d="M 32 26 L 40 14 L 46 24 L 54 10 L 60 24 L 68 14 L 68 28 Z" fill="#1F2421" />
      )}
      {hair === 'curly' && (
        <g fill="#1F2421">
          <circle cx="38" cy="24" r="7" />
          <circle cx="50" cy="22" r="8" />
          <circle cx="62" cy="24" r="7" />
        </g>
      )}
      {hair === 'beanie' && (
        <path d="M 24 35 C 24 16, 76 16, 76 35 Z" fill="#10B981" stroke="#1F2421" strokeWidth="3" />
      )}
      {hair === 'glasses' && (
        <g stroke="#1F2421" strokeWidth="3" fill="none">
          <rect x="28" y="39" width="18" height="14" rx="3" fill="rgba(255,255,255,0.4)" />
          <rect x="54" y="39" width="18" height="14" rx="3" fill="rgba(255,255,255,0.4)" />
          <line x1="46" y1="45" x2="54" y2="45" />
        </g>
      )}
    </svg>
  );
}
