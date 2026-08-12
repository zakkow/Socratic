import React, { useState, useEffect } from 'react';
import { Sparkles, Users, ArrowRight, ShieldAlert, AlertCircle, Clock, Bot, Pin, RefreshCw, ArrowLeft } from 'lucide-react';
import { requestMatch, startAiMatchSession, pinQuestionToBoard } from '../api';
import { AvatarIcon } from './AvatarIcon';
import { soundFX } from '../utils/soundFX';

export function MatchRevealScreen({
  currentUser,
  topicName,
  onMatchFound,
  onGoToScratchpad,
  onBackToExplore,
  onGoToQuestionBoard,
  onOpenSafetyModal,
}) {
  const [matchState, setMatchState] = useState('searching'); // 'searching' | 'matched' | 'timeout_options'
  const [matchData, setMatchData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Poll matching engine
  useEffect(() => {
    let timerId;

    const runMatchSearch = async () => {
      try {
        const res = await requestMatch(currentUser.id);
        if (res.matched) {
          soundFX.playSuccess();
          setMatchData(res);
          setMatchState('matched');
          onMatchFound(res);
        }
      } catch (err) {
        setErrorMessage(err.message);
      }
    };

    runMatchSearch();
    timerId = setInterval(runMatchSearch, 3000);

    return () => clearInterval(timerId);
  }, [currentUser.id]);

  // 60-Second Countdown Timer
  useEffect(() => {
    if (matchState !== 'searching') return;

    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= 59) {
          setMatchState('timeout_options');
          return 60;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [matchState]);

  const handleLaunchAiMatch = async () => {
    soundFX.playSoftClick();
    try {
      const res = await startAiMatchSession(currentUser.id, topicName || 'General Practice');
      onGoToScratchpad(res);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handlePinQuestion = async () => {
    soundFX.playSoftClick();
    try {
      await pinQuestionToBoard(currentUser.id, topicName || 'General Struggle', `I'm working on ${topicName} and need a study partner!`);
      if (onGoToQuestionBoard) {
        onGoToQuestionBoard();
      } else {
        onBackToExplore();
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleKeepWaiting = () => {
    soundFX.playSoftClick();
    setSecondsElapsed(0);
    setMatchState('searching');
  };

  return (
    <div className="match-screen-container">
      {errorMessage && (
        <div className="error-banner" style={{ marginBottom: '1rem', width: '100%', maxWidth: '520px' }}>
          <AlertCircle size={16} strokeWidth={2.5} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SEARCHING STATE */}
      {matchState === 'searching' && (
        <div className="radar-card">
          <div className="radar-circle">
            <div className="radar-sweep" />
            <Sparkles size={36} className="radar-center-icon" strokeWidth={2.5} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, marginTop: '1.25rem', marginBottom: '0.25rem' }}>
            Searching Classmates for {topicName || 'Your Topic'}...
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            <Clock size={15} strokeWidth={2.5} />
            <span>Searching queue ({60 - secondsElapsed}s remaining)</span>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={() => setMatchState('timeout_options')} style={{ fontSize: '0.85rem' }}>
              <span>View Options</span>
            </button>
            <button className="btn-secondary" onClick={onBackToExplore} style={{ fontSize: '0.85rem' }}>
              <span>Cancel Search</span>
            </button>
          </div>
        </div>
      )}

      {/* TIMEOUT OPTIONS CHOICE MODAL */}
      {matchState === 'timeout_options' && (
        <div className="radar-card" style={{ maxWidth: '560px' }}>
          <div style={{ background: '#FEF3C7', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} strokeWidth={2.5} style={{ color: 'var(--color-ink)' }} />
              No peer is online for {topicName} right now
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-ink)', margin: '0.35rem 0 0 0', lineHeight: '1.4' }}>
              Choose how you would like to proceed with your study session:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
            {/* Option 1: AI Study Assistant */}
            <button
              className="btn-primary"
              onClick={handleLaunchAiMatch}
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '0.85rem 1.1rem' }}
            >
              <Bot size={22} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Work with AI Socratic Peer Assistant</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>Get instant step-by-step guidance on {topicName}</div>
              </div>
            </button>

            {/* Option 2: Pin to Class Questions Board */}
            <button
              className="btn-secondary"
              onClick={handlePinQuestion}
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '0.85rem 1.1rem', background: '#FFF' }}
            >
              <Pin size={22} strokeWidth={2.5} style={{ flexShrink: 0, color: 'var(--color-primary-deep)' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Save to Classmate Questions Board</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Pin your question so classmates can join asynchronously when online</div>
              </div>
            </button>

            {/* Option 3: Keep Waiting */}
            <button
              className="btn-secondary"
              onClick={handleKeepWaiting}
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '0.85rem 1.1rem', background: '#FFF' }}
            >
              <RefreshCw size={22} strokeWidth={2.5} style={{ flexShrink: 0, color: 'var(--color-ink)' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Keep Searching Queue (60s)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Reset queue timer and keep scanning for live classmates</div>
              </div>
            </button>

            {/* Option 4: Go Back */}
            <button
              className="btn-secondary"
              onClick={onBackToExplore}
              style={{ justifyContent: 'center', padding: '0.65rem 1.1rem', marginTop: '0.25rem' }}
            >
              <ArrowLeft size={16} strokeWidth={2.5} />
              <span>Back to Topic Explore Board</span>
            </button>
          </div>
        </div>
      )}

      {/* MATCH FOUND STATE */}
      {matchState === 'matched' && matchData && (
        <div className="match-card">
          <div style={{ transform: 'rotate(-3deg) scale(1.05)', marginBottom: '1.25rem', animation: 'stampReveal 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <span style={{ background: '#10B981', color: '#FFF', padding: '0.45rem 1.1rem', borderRadius: 'var(--radius-md)', border: 'var(--border-thick)', fontWeight: 900, fontSize: '0.95rem', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: 'var(--shadow-hard-sm)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} strokeWidth={2.5} />
              <span>✦ SOCRATIC MATCH REVEALED!</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <AvatarIcon seed={currentUser.avatar_seed || 'bottts-1'} size={56} />
              <span style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{currentUser.name}</span>
            </div>

            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-muted)' }}>&</div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <AvatarIcon seed={matchData.partner_avatar || 'bottts-1'} size={56} />
              <span style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{matchData.partner_name}</span>
            </div>
          </div>

          <div style={{ background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '0.2rem' }}>Shared Topic</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.6rem' }}>{matchData.shared_topic}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-ink)', lineHeight: '1.4' }}>{matchData.explanation}</div>
          </div>

          <button className="btn-primary" style={{ width: '100%', padding: '0.8rem 1.25rem' }} onClick={() => onGoToScratchpad(matchData)}>
            <span>Open Shared Workspace & Whiteboard</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
