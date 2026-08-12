import React, { useState, useEffect } from 'react';
import { X, LogOut, Trash2, GraduationCap, CheckCircle2, AlertCircle, History, Edit2, Save, Volume2, VolumeX, Sparkles, Bell, ChevronDown, Pin } from 'lucide-react';
import { AvatarIcon, AVATAR_SEEDS } from './AvatarIcon';
import { StatusBadge } from './StatusBadge';
import { AvatarCreator } from './AvatarCreator';
import { updateProfile, deleteAccount, clearSavedUser, updateUserStatus, requestEmailChange, verifyEmailChange } from '../api';
import { soundFX, SOUND_PROFILES } from '../utils/soundFX';

export function ProfileDrawer({ isOpen, onClose, currentUser, userStatus = 'online', onUpdateStatus, onProfileUpdated, onLoggedOut, onOpenSessionHistory }) {
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [emailInput, setEmailInput] = useState(currentUser?.email || 'student@stanford.edu');
  const [schoolInput, setSchoolInput] = useState(currentUser?.school_name || 'University Student');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar_seed || 'bottts-1');
  const activeStatus = userStatus || 'online';
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isAvatarCreatorOpen, setIsAvatarCreatorOpen] = useState(false);

  // Email OTP Verification states
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpPinInput, setOtpPinInput] = useState('');
  const [demoOtpCode, setDemoOtpCode] = useState('');

  const [soundEnabled, setSoundEnabled] = useState(soundFX.enabled);
  const [soundVolume, setSoundVolume] = useState(soundFX.volume);
  const [soundProfile, setSoundProfile] = useState(soundFX.profile);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      setNameInput(currentUser.name);
      setEmailInput(currentUser.email || 'student@stanford.edu');
      setSchoolInput(currentUser.school_name || 'University Student');
      setSelectedAvatar(currentUser.avatar_seed || 'bottts-1');
    }
  }, [currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundFX.setSoundEnabled(nextState);
    if (nextState) {
      soundFX.playSoftClick();
    }
  };

  const handleSaveAvatar = async (seed) => {
    soundFX.playSoftClick();
    setSelectedAvatar(seed);
    try {
      const updated = await updateProfile(currentUser.id, nameInput, seed, schoolInput);
      onProfileUpdated(updated);
      setSuccessMessage('Avatar configuration saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleSaveProfileInfo = async () => {
    soundFX.playSoftClick();
    setIsSaving(true);
    setErrorMessage('');

    // Check if email was modified
    if (emailInput.trim().toLowerCase() !== (currentUser.email || '').toLowerCase()) {
      if (!emailInput.trim().toLowerCase().endsWith('.edu')) {
        setErrorMessage('Email address must end in .edu (e.g. alex@stanford.edu).');
        setIsSaving(false);
        return;
      }

      try {
        const res = await requestEmailChange(currentUser.id, emailInput.trim());
        setPendingEmail(emailInput.trim());
        setDemoOtpCode(res.verification_pin || '849201');
        setShowOtpStep(true);
        setIsSaving(false);
        return;
      } catch (err) {
        setErrorMessage(err.message);
        setIsSaving(false);
        return;
      }
    }

    try {
      const updated = await updateProfile(currentUser.id, nameInput, selectedAvatar, schoolInput);
      onProfileUpdated({ ...updated, email: currentUser.email || emailInput });
      setIsEditingAccount(false);
      setSuccessMessage('Profile details updated!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    soundFX.playSoftClick();
    setIsSaving(true);
    setErrorMessage('');

    try {
      const verifiedRes = await verifyEmailChange(currentUser.id, pendingEmail, otpPinInput);
      soundFX.playSuccess();
      const updated = await updateProfile(currentUser.id, nameInput, selectedAvatar, schoolInput);
      onProfileUpdated({ ...updated, email: verifiedRes.email, is_verified: true });
      setShowOtpStep(false);
      setIsEditingAccount(false);
      setSuccessMessage(`Email verified as ${verifiedRes.email}!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    soundFX.playSoftClick();
    clearSavedUser();
    onLoggedOut();
    onClose();
  };

  const handleDeleteAccount = async () => {
    soundFX.playSoftClick();
    setIsSaving(true);
    try {
      await deleteAccount(currentUser.id);
      onLoggedOut();
      onClose();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ justifyContent: 'flex-end', padding: 0 }}>
        <div
          className="drawer-card"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ overflowY: 'auto' }}>
            <div style={{ position: 'relative', marginBottom: '1.5rem', borderBottom: 'var(--border-thick)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div
                  onClick={() => { soundFX.playSoftClick(); setShowStatusMenu((prev) => !prev); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-md)',
                    transition: 'background 0.2s ease, filter 0.2s ease',
                    userSelect: 'none',
                  }}
                  className="profile-header-card-interactive"
                  title="Click profile to change Display Status"
                >
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <AvatarIcon seed={currentUser.avatar_seed || selectedAvatar} size={48} />
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}>
                      <StatusBadge status={activeStatus} size={16} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{currentUser.name}</h3>
                      <ChevronDown size={14} strokeWidth={2.5} style={{ color: 'var(--color-muted)' }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                      <GraduationCap size={14} strokeWidth={2.5} />
                      <span>{currentUser.school_name || 'University Student'}</span>
                    </div>
                  </div>
                </div>

                <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Display Status Dropdown Popover */}
              {showStatusMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    background: 'var(--color-surface)',
                    border: 'var(--border-thick)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-hard-md)',
                    padding: '0.5rem',
                    width: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    marginTop: '0.35rem',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-muted)', padding: '0.2rem 0.5rem', textTransform: 'uppercase' }}>
                    Display Status
                  </div>
                  {[
                    { id: 'online', label: 'Online' },
                    { id: 'dnd', label: 'Do Not Disturb' },
                    { id: 'away', label: 'Away / AFK' },
                    { id: 'invisible', label: 'Invisible / Offline' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={async () => {
                        soundFX.playSoftClick();
                        if (onUpdateStatus) {
                          onUpdateStatus(st.id, true);
                        }
                        setShowStatusMenu(false);
                        try {
                          await updateUserStatus(currentUser.id, st.id);
                        } catch {}
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        background: activeStatus === st.id ? 'var(--color-light-sage)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-ink)',
                      }}
                    >
                      <StatusBadge status={st.id} size={15} />
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar Customizer Button */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 className="form-label" style={{ marginBottom: '0.5rem' }}>Student Avatar</h4>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  soundFX.playSoftClick();
                  setIsAvatarCreatorOpen(true);
                }}
                style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.88rem' }}
              >
                <Sparkles size={16} strokeWidth={2.5} />
                <span>Customize Avatar</span>
              </button>
            </div>

            {/* Account Profile Edit Section */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 className="form-label" style={{ margin: 0 }}>Account Information</h4>
                {!isEditingAccount ? (
                  <button
                    className="btn-secondary"
                    onClick={() => { soundFX.playSoftClick(); setIsEditingAccount(true); }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    <Edit2 size={12} strokeWidth={2.5} />
                    <span>Edit Info</span>
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={handleSaveProfileInfo}
                    disabled={isSaving}
                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    <Save size={12} strokeWidth={2.5} />
                    <span>Save Info</span>
                  </button>
                )}
              </div>

              {showOtpStep ? (
                <form onSubmit={handleVerifyEmailOtp} style={{ background: '#EFF6FF', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', fontSize: '0.92rem', color: 'var(--color-ink)' }}>
                    Verify New .edu Email Identity
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    Enter the 6-digit OTP verification code sent to <strong>{pendingEmail}</strong>:
                  </div>
                  <div style={{ background: 'var(--color-surface)', border: '1px dashed var(--color-ink)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontWeight: 800, fontSize: '0.8rem' }}>
                    🔑 Demo OTP Code: <span style={{ color: 'var(--color-primary-deep)' }}>{demoOtpCode}</span>
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="6-digit PIN"
                    value={otpPinInput}
                    onChange={(e) => setOtpPinInput(e.target.value)}
                    maxLength={6}
                    style={{ letterSpacing: '3px', fontWeight: 800, textAlign: 'center', fontSize: '1rem' }}
                    required
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn-secondary" onClick={() => setShowOtpStep(false)} style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem' }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={isSaving} style={{ flex: 1, padding: '0.4rem', fontSize: '0.78rem' }}>
                      {isSaving ? 'Verifying...' : 'Confirm PIN'}
                    </button>
                  </div>
                </form>
              ) : isEditingAccount ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', border: 'var(--border-thick)' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>.edu Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="alex@university.edu"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                      Changing email will prompt a 6-digit OTP verification code.
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.2rem' }}>University / School</label>
                    <input
                      type="text"
                      className="form-input"
                      value={schoolInput}
                      onChange={(e) => setSchoolInput(e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div><strong>Email:</strong> {currentUser.email || emailInput}</div>
                  <div><strong>School:</strong> {currentUser.school_name || 'University Student'}</div>
                  <div><strong>Verification:</strong> <span style={{ color: 'var(--color-primary-deep)', fontWeight: 800 }}>Verified .edu Student</span></div>
                </div>
              )}
            </div>

            {/* CARD 1: My Posted Questions Section */}
            <div style={{ marginBottom: '1.25rem', background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Pin size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                  My Posted Questions
                </h4>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                Manage questions you posted to the Question Board and download answers provided by classmates.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-ink)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', fontFamily: 'var(--font-heading)' }}>Recursion & Base Cases</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#D1FAE5', color: '#065F46', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #10B981' }}>Answered</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>Answered by Socratic AI Tutor & Peers</div>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      soundFX.playSoftClick();
                      const content = `# Question Answer: Recursion & Base Cases\n\n## 🎯 Problem Resolution\n- Base Case: n <= 1 returns 1\n- Recursive Step: return n * factorial(n - 1)\n\nAnswer verified by campus study group!`;
                      const blob = new Blob([content], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Answer-Recursion-Base-Cases.md`;
                      a.click();
                    }}
                    style={{ width: '100%', padding: '0.3rem', fontSize: '0.75rem', justifyContent: 'center' }}
                  >
                    <span>Download Answer (.md)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: Study Session History Section */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <History size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                  Study Session History
                </h4>
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                View and rejoin active or past 1-on-1 collaborative study sessions with peers.
              </p>

              <button
                className="btn-secondary"
                onClick={() => {
                  soundFX.playSoftClick();
                  onOpenSessionHistory();
                  onClose();
                }}
                style={{ width: '100%', justifyContent: 'center', padding: '0.55rem', fontSize: '0.82rem' }}
              >
                <History size={14} strokeWidth={2.5} />
                <span>View Full Session History</span>
              </button>
            </div>

            {/* CARD 3: UI Sound Effects & Audio Settings */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {soundEnabled ? <Volume2 size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} /> : <VolumeX size={18} strokeWidth={2.5} style={{ color: 'var(--color-muted)' }} />}
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                    UI Sound Effects
                  </h4>
                </div>

                <button
                  type="button"
                  className={`category-pill ${soundEnabled ? 'active' : ''}`}
                  onClick={handleToggleSound}
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                >
                  {soundEnabled ? 'ON' : 'MUTED'}
                </button>
              </div>

              {/* Volume Slider */}
              <div style={{ marginBottom: '1rem', background: 'var(--color-surface)', border: '1.5px solid var(--color-ink)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>Volume Level</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary-deep)', fontFamily: 'var(--font-mono)' }}>
                    {Math.round(soundVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => {
                    const newVol = parseFloat(e.target.value);
                    setSoundVolume(newVol);
                    soundFX.setVolume(newVol);
                    soundFX.playSoftClick();
                  }}
                  disabled={!soundEnabled}
                  style={{ width: '100%', accentColor: 'var(--color-primary-deep)', cursor: soundEnabled ? 'pointer' : 'not-allowed' }}
                />
              </div>

              {/* Sound Profile Selection */}
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>Button Click Sound Profile</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {SOUND_PROFILES.map((prof) => (
                    <button
                      key={prof.id}
                      type="button"
                      disabled={!soundEnabled}
                      onClick={() => {
                        setSoundProfile(prof.id);
                        soundFX.setSoundProfile(prof.id);
                        soundFX.playSoftClick();
                      }}
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        borderRadius: 'var(--radius-sm)',
                        border: '1.5px solid var(--color-ink)',
                        background: soundProfile === prof.id ? 'var(--color-light-sage)' : 'var(--color-surface)',
                        color: 'var(--color-ink)',
                        cursor: soundEnabled ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        textAlign: 'left',
                        boxShadow: soundProfile === prof.id ? 'var(--shadow-hard-sm)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>{prof.label}</span>
                      {soundProfile === prof.id && <CheckCircle2 size={14} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CARD 4: Accessibility & Reduce Motion Control */}
            <div style={{ marginBottom: '1.5rem', background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                    Reduce Motion
                  </h4>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                    Disable radar sweeps and heavy keyframe motion
                  </div>
                </div>

                <button
                  type="button"
                  className={`category-pill ${document.body.classList.contains('reduce-motion') ? 'active' : ''}`}
                  onClick={() => {
                    soundFX.playSoftClick();
                    document.body.classList.toggle('reduce-motion');
                    setSuccessMessage('Accessibility preferences updated.');
                    setTimeout(() => setSuccessMessage(''), 2000);
                  }}
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                >
                  {document.body.classList.contains('reduce-motion') ? 'ENABLED' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ paddingTop: '1rem', borderTop: 'var(--border-thick)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn-secondary" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={16} strokeWidth={2.5} />
              <span>Sign Out</span>
            </button>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => { soundFX.playSoftClick(); setShowDeleteConfirm(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-error)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
              >
                Delete Account
              </button>
            ) : (
              <div style={{ background: '#FEE2E2', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '0.85rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-error)', marginBottom: '0.5rem' }}>
                  Permanently delete account and all history?
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '0.35rem', fontSize: '0.78rem' }}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleDeleteAccount} style={{ flex: 1, padding: '0.35rem', fontSize: '0.78rem', background: 'var(--color-error)', color: '#FFF' }}>
                    Yes, Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AvatarCreator
        isOpen={isAvatarCreatorOpen}
        onClose={() => setIsAvatarCreatorOpen(false)}
        initialAvatarSeed={currentUser.avatar_seed || selectedAvatar}
        onSaveAvatar={handleSaveAvatar}
      />
    </>
  );
}
