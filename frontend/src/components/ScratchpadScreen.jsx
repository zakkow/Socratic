import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Check, AlertCircle, RefreshCw, Sparkles, MessageSquare, MoreVertical, Ban, ShieldAlert, UserX, UserPlus, PenTool, FileText, Star, Award, Calculator, Wifi, WifiOff, Pin, Globe, CheckCircle2 } from 'lucide-react';
import { getScratchpadContent, saveScratchpadContent, getCanvasContent, saveCanvasContent, sendFriendRequest, rateSessionConfidence, pinQuestionToBoard, togglePublishConsent } from '../api';
import { AvatarIcon } from './AvatarIcon';
import { SharedWhiteboard } from './SharedWhiteboard';
import { LiveChatPanel } from './LiveChatPanel';
import { ScientificCalculator } from './ScientificCalculator';
import { soundFX } from '../utils/soundFX';
import { useSessionSocket } from '../hooks/useSessionSocket';

export function ScratchpadScreen({
  currentUser,
  matchData,
  onBack,
  onGoToQuestionBoard,
  onOpenSafetyModal,
  isReadOnly = false,
}) {
  const [workspaceMode, setWorkspaceMode] = useState('text'); // 'text' | 'draw'
  const [content, setContent] = useState('');
  const [canvasData, setCanvasData] = useState('');
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'saving' | 'error'
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [toastBanner, setToastBanner] = useState('');
  const [friendReqSent, setFriendReqSent] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const [showConfidenceModal, setShowConfidenceModal] = useState(false);
  const [postConfidenceRating, setPostConfidenceRating] = useState(5);
  const [confidenceResultMsg, setConfidenceResultMsg] = useState('');

  const isUserTypingRef = useRef(false);
  const debounceTimerRef = useRef(null);
  const [wsMessages, setWsMessages] = useState(null); // messages from WS for LiveChatPanel

  // --- WebSocket real-time sync ---
  const { send: wsSend, isConnected: wsConnected } = useSessionSocket(
    matchData.session_id,
    currentUser?.id,
    {
      onInit: ({ scratchpad, canvas, messages }) => {
        if (scratchpad && !isUserTypingRef.current) setContent(scratchpad);
        if (canvas) setCanvasData(canvas);
        if (messages) setWsMessages(messages);
        setIsInitialLoading(false);
      },
      onScratchpad: ({ content: remoteContent }) => {
        if (!isUserTypingRef.current) setContent(remoteContent);
      },
      onCanvas: ({ content: remoteCanvas }) => {
        setCanvasData(remoteCanvas);
      },
      onChat: (msg) => {
        setWsMessages(prev => prev ? [...prev, msg] : [msg]);
        if (!isChatOpen) setUnreadCount(c => c + 1);
      },
    }
  );

  // Fallback: initial load via HTTP if WS init hasn't arrived within 1.5s
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!isInitialLoading) return;
      try {
        const res = await getScratchpadContent(matchData.session_id);
        if (res.content !== undefined && !isUserTypingRef.current) setContent(res.content);
        const cv = await getCanvasContent(matchData.session_id);
        if (cv.content !== undefined) setCanvasData(cv.content);
      } catch { /* ignore */ } finally {
        setIsInitialLoading(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [matchData.session_id]);


  const handleTextChange = (e) => {
    if (isReadOnly) return;
    const newText = e.target.value;
    setContent(newText);
    setSyncStatus('saving');
    isUserTypingRef.current = true;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      // Try WebSocket first for instant peer sync; fall back to HTTP
      const sent = wsSend({ type: 'scratchpad', payload: { content: newText } });
      try {
        await saveScratchpadContent(matchData.session_id, newText);
        setSyncStatus('saved');
      } catch {
        setSyncStatus('error');
      } finally {
        isUserTypingRef.current = false;
      }
    }, 400);
  };

  const handleCanvasSave = async (dataUrl) => {
    if (isReadOnly) return;
    setCanvasData(dataUrl);
    wsSend({ type: 'canvas', payload: { content: dataUrl } });
    try {
      await saveCanvasContent(matchData.session_id, dataUrl);
    } catch {
      // Ignore background canvas save errors
    }
  };

  const handleExportNotes = () => {
    soundFX.playSoftClick();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Socratic_Notes_${matchData.shared_topic.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddPartnerAsFriend = async () => {
    soundFX.playNotification();
    setFriendReqSent(true);
    const target = matchData.partner_id || matchData.partner_name || 'Elena Rostova';
    setToastBanner(`Sent friend request to ${matchData.partner_name || target}!`);
    setTimeout(() => setToastBanner(''), 4000);

    try {
      if (currentUser?.id) {
        await sendFriendRequest(currentUser.id, target);
      }
    } catch (err) {
      // Keep friendReqSent true even if duplicate or background network error
      setFriendReqSent(true);
    }
  };

  const handleOpenConfidenceModal = () => {
    soundFX.playSoftClick();
    if (isReadOnly) {
      onBack();
      return;
    }
    setShowConfidenceModal(true);
  };

  const handleSubmitConfidence = async () => {
    soundFX.playSoftClick();
    try {
      const res = await rateSessionConfidence(matchData.session_id, currentUser.id, postConfidenceRating);
      setConfidenceResultMsg(res.message);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch {
      onBack();
    }
  };

  const handleRepostQuestion = async () => {
    soundFX.playSoftClick();
    const struggleNote = content.trim()
      ? `[Post-session note on ${matchData.shared_topic}]: ${content.trim().slice(0, 300)}`
      : `Still looking for extra assistance and problem walkthrough on ${matchData.shared_topic}!`;
    try {
      await pinQuestionToBoard(currentUser.id, matchData.shared_topic, struggleNote);
      setShowConfidenceModal(false);
      if (onGoToQuestionBoard) {
        onGoToQuestionBoard();
      } else {
        onBack();
      }
    } catch {
      onBack();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const [hasConsentedPublish, setHasConsentedPublish] = useState(false);
  const [publishVoteCount, setPublishVoteCount] = useState(0);
  const [isPublishApproved, setIsPublishApproved] = useState(false);
  const [publishTags, setPublishTags] = useState([]);

  const handleTogglePublishConsent = async () => {
    soundFX.playPublishChime();
    const nextConsent = !hasConsentedPublish;
    setHasConsentedPublish(nextConsent);
    try {
      const res = await togglePublishConsent(matchData.session_id, currentUser.id, nextConsent);
      setPublishVoteCount(res.votes || 0);
      setIsPublishApproved(res.approved || false);
      if (res.approved) {
        soundFX.playSuccess();
      }
      if (res.tags && res.tags.length > 0) {
        setPublishTags(res.tags);
      }
    } catch {
      // ignore
    }
  };

  const isAiSession = matchData.partner_id === 'ai-tutor-bot' || matchData.session_id?.includes('sess-ai');
  const requiredVotes = isAiSession ? 1 : 2;

  return (
    <div className="scratchpad-container">
      {/* Toast Notification Banner */}
      {toastBanner && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, background: 'var(--color-ink)', color: 'var(--color-surface)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', border: 'var(--border-thick)', fontWeight: 700, fontSize: '0.85rem', boxShadow: 'var(--shadow-hard-md)' }}>
          {toastBanner}
        </div>
      )}

      {/* Post-Session Confidence Evaluation Modal */}
      {showConfidenceModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', background: '#FEF3C7', border: 'var(--border-thick)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Award size={26} strokeWidth={2.5} style={{ color: 'var(--color-ink)' }} />
            </div>

            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.35rem' }}>
              Post-Session Pedagogical Assessment
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              How confident do you feel on <strong>{matchData.shared_topic}</strong> now after collaborating together?
            </p>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', margin: '1rem 0 1.25rem 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    soundFX.playSoftClick();
                    setPostConfidenceRating(star);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`${star} Star Rating`}
                >
                  <Star
                    size={32}
                    fill={star <= postConfidenceRating ? 'var(--color-primary-deep)' : 'transparent'}
                    stroke="var(--color-primary-deep)"
                    strokeWidth={2.5}
                  />
                </button>
              ))}
            </div>

            {/* Public Community Solutions Mutual Consent Toggle */}
            <div style={{ background: '#F3F4F6', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-heading)' }}>
                  <Globe size={16} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                  Publish Solution to Community History
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, background: isPublishApproved ? '#D1FAE5' : '#E5E7EB', color: isPublishApproved ? '#065F46' : '#4B5563', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                  ({publishVoteCount}/{requiredVotes} Consents)
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0 0 0.6rem 0', lineHeight: '1.35' }}>
                Requires mutual consent ({requiredVotes}/{requiredVotes}). AI will vet quality & assign search tags before publishing.
              </p>
              <button
                type="button"
                className={`btn-secondary ${hasConsentedPublish ? 'btn-primary' : ''}`}
                onClick={handleTogglePublishConsent}
                style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                {hasConsentedPublish ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <Globe size={14} strokeWidth={2.5} />}
                <span>{hasConsentedPublish ? 'Consent Granted' : 'Grant Consent to Publish'}</span>
              </button>

              {isPublishApproved && (
                <div style={{ marginTop: '0.5rem', background: '#D1FAE5', border: '1px solid #10B981', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 700, color: '#065F46', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={14} strokeWidth={2.5} />
                  <span>✓ AI Vetted & Published to Topic Solution History!</span>
                </div>
              )}
            </div>

            {confidenceResultMsg ? (
              <div style={{ background: 'var(--color-light-sage)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '0.75rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary-deep)' }}>
                {confidenceResultMsg}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button className="btn-secondary" onClick={onBack} style={{ flex: 1 }}>
                    <span>Skip & Exit</span>
                  </button>
                  <button className="btn-primary" onClick={handleSubmitConfidence} style={{ flex: 1 }}>
                    <Star size={16} strokeWidth={2.5} />
                    <span>Submit Score</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRepostQuestion}
                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.82rem', background: '#FEF3C7', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', border: 'var(--border-thick)' }}
                >
                  <Pin size={15} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                  <span>Still Need Help? Repost Question to Question Board</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="scratchpad-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={handleOpenConfidenceModal} style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
            <span>← Exit Workspace</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AvatarIcon seed={matchData.partner_avatar || 'bottts-2'} size={28} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.95rem' }}>
              {matchData.partner_name || 'Study Partner'}
            </span>
          </div>

          {!isReadOnly && matchData.partner_id && matchData.partner_id !== 'ai-tutor-bot' && (
            <button
              className="btn-secondary"
              onClick={handleAddPartnerAsFriend}
              disabled={friendReqSent}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                height: '28px',
                background: friendReqSent ? '#D1FAE5' : undefined,
                color: friendReqSent ? '#065F46' : undefined,
                borderColor: friendReqSent ? '#10B981' : undefined,
                fontWeight: friendReqSent ? 700 : undefined,
                cursor: friendReqSent ? 'default' : 'pointer',
              }}
            >
              {friendReqSent ? <Check size={13} strokeWidth={2.5} /> : <UserPlus size={13} strokeWidth={2.5} />}
              <span>{friendReqSent ? 'Sent!' : 'Add Friend'}</span>
            </button>
          )}

          <div className="topic-pill" style={{ marginLeft: '0.25rem' }}>
            <Sparkles size={13} strokeWidth={2.5} />
            <span>{matchData.shared_topic}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Mode Switcher: Text vs Draw */}
          <div className="category-pills" style={{ margin: 0 }}>
            <button
              className={`category-pill ${workspaceMode === 'text' ? 'active' : ''}`}
              onClick={() => {
                soundFX.playSoftClick();
                setWorkspaceMode('text');
              }}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
            >
              <FileText size={13} strokeWidth={2.5} />
              <span>Text Notepad</span>
            </button>
            <button
              className={`category-pill ${workspaceMode === 'draw' ? 'active' : ''}`}
              onClick={() => {
                soundFX.playSoftClick();
                setWorkspaceMode('draw');
              }}
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
            >
              <PenTool size={13} strokeWidth={2.5} />
              <span>Draw Whiteboard</span>
            </button>
          </div>

          {!isReadOnly && (
            <div className={`sync-indicator ${syncStatus}`}>
              {syncStatus === 'saving' && (
                <>
                  <RefreshCw size={12} className="spinner" strokeWidth={2.5} />
                  <span>Syncing...</span>
                </>
              )}
              {syncStatus === 'saved' && (
                <>
                  <Check size={12} strokeWidth={2.5} />
                  <span>Live Synced</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <AlertCircle size={12} strokeWidth={2.5} />
                  <span>Syncing Error</span>
                </>
              )}
            </div>
          )}

          {/* Scientific Calculator Toggle Button */}
          <button
            className={`btn-secondary ${isCalculatorOpen ? 'btn-primary' : ''}`}
            onClick={() => {
              soundFX.playSoftClick();
              setIsCalculatorOpen(!isCalculatorOpen);
            }}
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }}
            title="Open Desmos Scientific Calculator"
          >
            <Calculator size={15} strokeWidth={2.5} />
            <span>Calculator</span>
          </button>

          {/* Toggle Live Chat Drawer Button */}
          <button
            className={`btn-secondary ${isChatOpen ? 'btn-primary' : ''}`}
            onClick={() => {
              soundFX.playSoftClick();
              setIsChatOpen(!isChatOpen);
            }}
            style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', position: 'relative' }}
          >
            <MessageSquare size={15} strokeWidth={2.5} />
            <span>Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--color-error)',
                  color: '#FFF',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #FFF',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {workspaceMode === 'text' && (
            <button className="btn-secondary" onClick={handleExportNotes} style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem' }} title="Download Notes (.md)">
              <Download size={15} strokeWidth={2.5} />
            </button>
          )}

          {!isReadOnly && (
            <div style={{ position: 'relative' }}>
              <button className="kebab-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                <MoreVertical size={16} strokeWidth={2.5} />
              </button>

              {isDropdownOpen && (
                <div className="kebab-dropdown">
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenSafetyModal('unmatch', matchData);
                    }}
                  >
                    <UserX size={15} strokeWidth={2.5} />
                    <span>Unmatch Session</span>
                  </button>
                  <button
                    className="dropdown-item danger"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenSafetyModal('block', matchData);
                    }}
                  >
                    <Ban size={15} strokeWidth={2.5} />
                    <span>Block Peer</span>
                  </button>
                  <button
                    className="dropdown-item danger"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenSafetyModal('report', matchData);
                    }}
                  >
                    <ShieldAlert size={15} strokeWidth={2.5} />
                    <span>Report Peer</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Body with Optional Side Chat */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div className="scratchpad-body" style={{ flex: 1 }}>
          {workspaceMode === 'text' ? (
            isInitialLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: 'var(--color-muted)' }}>
                <div className="spinner" />
                <span>Loading collaborative scratchpad...</span>
              </div>
            ) : (
              <textarea
                className="scratchpad-textarea"
                value={content}
                onChange={handleTextChange}
                placeholder={`Type or paste code, equations, or problem notes here...\nEverything you write is synced live with ${matchData.partner_name || 'your peer'}.`}
                readOnly={isReadOnly}
              />
            )
          ) : (
            <SharedWhiteboard
              sessionId={matchData.session_id}
              matchData={matchData}
              remoteCanvasData={canvasData}
              onCanvasSave={handleCanvasSave}
              wsSend={wsSend}
              isReadOnly={isReadOnly}
            />
          )}
        </div>

        {/* Live Side Chat Drawer */}
        <LiveChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          sessionId={matchData.session_id}
          currentUser={currentUser}
          matchData={matchData}
          onUnreadCountChange={(count) => setUnreadCount(count)}
          isReadOnly={isReadOnly}
          wsMessages={wsMessages}
          wsSend={wsSend}
          wsConnected={wsConnected}
        />

        {/* Scientific Calculator Overlay Widget */}
        <ScientificCalculator
          isOpen={isCalculatorOpen}
          onClose={() => setIsCalculatorOpen(false)}
          onInsertToNotes={(calcStr) => {
            setContent((prev) => {
              const updated = prev ? `${prev}\n[Calc]: ${calcStr}` : `[Calc]: ${calcStr}`;
              saveScratchpadContent(matchData.session_id, updated).catch(() => {});
              return updated;
            });
          }}
        />
      </div>
    </div>
  );
}
