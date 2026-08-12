import React, { useState } from 'react';
import { X, Sparkles, Check, RefreshCw } from 'lucide-react';
import { AvatarIcon } from './AvatarIcon';
import { soundFX } from '../utils/soundFX';

const FUR_COLORS = [
  { id: '#F97316', label: 'Orange' },
  { id: '#FDE68A', label: 'Cream' },
  { id: '#10B981', label: 'Mint' },
  { id: '#374151', label: 'Charcoal' },
  { id: '#F43F5E', label: 'Rose' },
];

const OUTFIT_COLORS = [
  { id: '#059669', label: 'Emerald' },
  { id: '#1E3A8A', label: 'Navy' },
  { id: '#C97B4A', label: 'Terracotta' },
  { id: '#1F2421', label: 'Ink Dark' },
];

const HAIR_STYLES = [
  { id: 'none', label: 'Natural' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'curly', label: 'Curly Top' },
  { id: 'beanie', label: 'Beanie Cap' },
  { id: 'glasses', label: 'Study Glasses' },
];

const OUTFIT_STYLES = [
  { id: 'hoodie', label: 'Campus Hoodie' },
  { id: 'letterman', label: 'Varsity Jacket' },
  { id: 'tshirt', label: 'Casual Tee' },
  { id: 'suit', label: 'Formal Suit' },
];

export function AvatarCreator({ isOpen, onClose, initialAvatarSeed, onSaveAvatar }) {
  let defaultConfig = { species: 'cat', fur: '#F97316', hair: 'spiky', outfit: 'hoodie', outfitColor: '#059669' };

  try {
    if (initialAvatarSeed && initialAvatarSeed.startsWith('{')) {
      defaultConfig = { ...defaultConfig, ...JSON.parse(initialAvatarSeed) };
    }
  } catch {
    // Ignore parse error
  }

  const [species, setSpecies] = useState(defaultConfig.species);
  const [fur, setFur] = useState(defaultConfig.fur);
  const [hair, setHair] = useState(defaultConfig.hair);
  const [outfit, setOutfit] = useState(defaultConfig.outfit);
  const [outfitColor, setOutfitColor] = useState(defaultConfig.outfitColor);

  if (!isOpen) return null;

  const currentSeedJson = JSON.stringify({ species, fur, hair, outfit, outfitColor });

  const handleSave = () => {
    soundFX.playSoftClick();
    onSaveAvatar(currentSeedJson);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
            <span>Customize Your Study Avatar</span>
          </h2>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Live Preview Display */}
        <div style={{ background: 'var(--color-light-sage)', border: 'var(--border-thick)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: 'var(--shadow-hard-sm)' }}>
          <AvatarIcon seed={currentSeedJson} size={96} />
          <div style={{ marginTop: '0.75rem', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.9rem', textTransform: 'capitalize' }}>
            {species === 'cat' ? '🐱 Cat Humanoid Student' : '🐶 Dog Humanoid Student'}
          </div>
        </div>

        {/* Customization Tabs & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Base Species Selection */}
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>1. Choose Species Baseplate</label>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                type="button"
                className={`btn-secondary ${species === 'cat' ? 'btn-primary' : ''}`}
                onClick={() => { soundFX.playSoftClick(); setSpecies('cat'); }}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
              >
                🐱 Cat (Pointy Ears)
              </button>
              <button
                type="button"
                className={`btn-secondary ${species === 'dog' ? 'btn-primary' : ''}`}
                onClick={() => { soundFX.playSoftClick(); setSpecies('dog'); }}
                style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
              >
                🐶 Dog (Floppy Ears)
              </button>
            </div>
          </div>

          {/* Fur Color Palette */}
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>2. Fur & Base Color</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {FUR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { soundFX.playSoftClick(); setFur(c.id); }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: c.id,
                    border: fur === c.id ? '3px solid var(--color-ink)' : '2px solid rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    boxShadow: fur === c.id ? 'var(--shadow-hard-sm)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={c.label}
                >
                  {fur === c.id && <Check size={16} strokeWidth={3} style={{ color: '#FFF' }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Hair & Accessories */}
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>3. Hair Style & Accessories</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {HAIR_STYLES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={`btn-secondary ${hair === h.id ? 'btn-primary' : ''}`}
                  onClick={() => { soundFX.playSoftClick(); setHair(h.id); }}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Outfit Choice & Outfit Color */}
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>4. Student Outfit & Clothing Color</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {OUTFIT_STYLES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`btn-secondary ${outfit === o.id ? 'btn-primary' : ''}`}
                  onClick={() => { soundFX.playSoftClick(); setOutfit(o.id); }}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {OUTFIT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { soundFX.playSoftClick(); setOutfitColor(c.id); }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: c.id,
                    border: outfitColor === c.id ? '3px solid var(--color-ink)' : '2px solid rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={c.label}
                >
                  {outfitColor === c.id && <Check size={14} strokeWidth={3} style={{ color: '#FFF' }} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave} style={{ width: '100%', marginTop: '1.5rem' }}>
          <Check size={16} strokeWidth={2.5} />
          <span>Save Avatar Configuration</span>
        </button>
      </div>
    </div>
  );
}
