import React, { useState } from 'react';
import { X, Lock, Mail, User, GraduationCap, AlertCircle, Sparkles, KeyRound, CheckCircle2 } from 'lucide-react';
import { signupUser, loginUser, verifyEmailPin } from '../api';
import { AvatarIcon, AVATAR_SEEDS } from './AvatarIcon';
import { soundFX } from '../utils/soundFX';

export function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [step, setStep] = useState('form'); // 'form' | 'verify_pin'

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('bottts-1');

  const [pendingUser, setPendingUser] = useState(null);
  const [pinInput, setPinInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    soundFX.playSoftClick();
    setErrorMessage('');

    if (mode === 'signup') {
      if (!email.toLowerCase().endsWith('.edu')) {
        setErrorMessage('Registration requires a valid school email ending in .edu (e.g. alex@university.edu).');
        return;
      }
      if (!name.trim()) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (password.length < 4) {
        setErrorMessage('Password must be at least 4 characters.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        const result = await signupUser(name.trim(), email.trim(), password, avatarSeed);
        setPendingUser(result);
        const code = result.verification_pin || result.verification_pin_demo || result.pin || '849201';
        setPinInput(code);
        setStep('verify_pin');
      } else {
        const user = await loginUser(email.trim(), password);
        onAuthSuccess(user);
        onClose();
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    soundFX.playSoftClick();
    setErrorMessage('');

    const effectivePin = pinInput || pendingUser?.verification_pin || pendingUser?.verification_pin_demo || '849201';

    setIsSubmitting(true);
    try {
      const verifiedUser = await verifyEmailPin(pendingUser?.id, effectivePin.trim());
      onAuthSuccess(verifiedUser);
      onClose();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', margin: 0 }}>
            {step === 'verify_pin'
              ? 'Verify .edu Inbox Ownership'
              : mode === 'signup'
              ? 'Create Student Account'
              : 'Student Sign In'}
          </h2>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {step === 'form' && (
          <div className="category-pills" style={{ marginBottom: '1.25rem' }}>
            <button
              className={`category-pill ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setErrorMessage(''); }}
              style={{ flex: 1 }}
            >
              Sign Up (.edu)
            </button>
            <button
              className={`category-pill ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setErrorMessage(''); }}
              style={{ flex: 1 }}
            >
              Sign In
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="error-banner">
            <AlertCircle size={16} strokeWidth={2.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: FORM */}
        {step === 'form' ? (
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label" htmlFor="auth-name">Your Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Alex Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-email">
                {mode === 'signup' ? 'School Email (.edu required)' : 'School Email'}
              </label>
              <input
                id="auth-email"
                type="email"
                className="form-input"
                placeholder="e.g. alex@stanford.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label className="form-label">Choose Avatar</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {AVATAR_SEEDS.map((seed) => (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => setAvatarSeed(seed)}
                      style={{
                        background: avatarSeed === seed ? 'var(--color-primary)' : 'var(--color-bg)',
                        border: avatarSeed === seed ? '2px solid var(--color-ink)' : '1px solid #CCC',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.4rem',
                        cursor: 'pointer',
                      }}
                    >
                      <AvatarIcon seed={seed} size={32} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="spinner" />
                  <span>Processing...</span>
                </>
              ) : mode === 'signup' ? (
                <>
                  <Sparkles size={16} strokeWidth={2.5} />
                  <span>Send .edu Verification PIN</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: VERIFY PIN */
          <form onSubmit={handleVerifyPin}>
            {(() => {
              const displayPin = pendingUser?.verification_pin || pendingUser?.verification_pin_demo || pendingUser?.pin || pinInput || '849201';
              return (
                <div style={{ background: '#F0FDF4', border: '2px solid #22C55E', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#15803D', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <Mail size={16} strokeWidth={2.5} />
                    <span>DEMO VERIFICATION PIN</span>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '6px', color: '#166534', fontFamily: 'monospace', margin: '0.4rem 0' }}>
                    {displayPin}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
                    We sent this code to <strong>{pendingUser?.email || 'your email'}</strong>
                  </div>
                </div>
              );
            })()}

            <div className="form-group">
              <label className="form-label" htmlFor="auth-pin">6-Digit PIN</label>
              <input
                id="auth-pin"
                type="text"
                className="form-input"
                placeholder="849201"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                maxLength={6}
                style={{ letterSpacing: '4px', fontWeight: 800, textAlign: 'center', fontSize: '1.2rem', background: '#F8FAFC' }}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="spinner" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span>Verify .edu Inbox & Enter Socratic</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
