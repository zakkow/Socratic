import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, ShieldAlert, Lock, Sparkles, RefreshCw, FileText, Lightbulb, HelpCircle } from 'lucide-react';
import { getChatMessages, sendChatMessage, getSessionAiLog, generateSessionAiLog, getSocraticHint } from '../api';
import { AvatarIcon } from './AvatarIcon';
import { soundFX } from '../utils/soundFX';

export function LiveChatPanel({ isOpen, onClose, sessionId, currentUser, matchData, onUnreadCountChange, isReadOnly = false, wsMessages = null, wsSend = null, wsConnected = false }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'ai-log'
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [aiLogText, setAiLogText] = useState('');
  const [isGeneratingAiLog, setIsGeneratingAiLog] = useState(false);

  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [socraticHint, setSocraticHint] = useState('');
  const [showHintPrompt, setShowHintPrompt] = useState(false);
  const [isGeneratingHint, setIsGeneratingHint] = useState(false);

  const messagesEndRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  const fetchMessages = async () => {
    try {
      const data = await getChatMessages(sessionId);
      if (Array.isArray(data)) {
        if (data.length > messages.length) {
          setLastActivityTime(Date.now());
          setShowHintPrompt(false);
        }
        setMessages(data);
        if (!isOpen && data.length > prevMsgCountRef.current) {
          const unread = data.length - prevMsgCountRef.current;
          onUnreadCountChange(unread);
        }
        prevMsgCountRef.current = data.length;
      }
    } catch {
      // Ignore background poll errors
    }
  };

  const fetchAiLog = async () => {
    try {
      const data = await getSessionAiLog(sessionId);
      if (data && data.ai_log) {
        setAiLogText(data.ai_log);
      }
    } catch {
      // Ignore background errors
    }
  };

  // Sync incoming WebSocket messages into local state
  useEffect(() => {
    if (wsMessages) {
      setMessages(wsMessages);
      if (!isOpen && wsMessages.length > prevMsgCountRef.current) {
        onUnreadCountChange(wsMessages.length - prevMsgCountRef.current);
      }
      prevMsgCountRef.current = wsMessages.length;
    }
  }, [wsMessages]);

  useEffect(() => {
    if (sessionId) {
      fetchMessages();
      fetchAiLog();
      // Only poll if WebSocket is not connected (fallback mode)
      if (!isReadOnly && !wsConnected) {
        const intervalId = setInterval(fetchMessages, 2000);
        return () => clearInterval(intervalId);
      }
    }
  }, [sessionId, isOpen, isReadOnly, wsConnected]);

  // 90-Second Silence Detector Timer for Socratic Hints
  useEffect(() => {
    if (isReadOnly || !sessionId) return;
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - lastActivityTime) / 1000;
      if (elapsedSec >= 90 && !socraticHint) {
        setShowHintPrompt(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastActivityTime, socraticHint, isReadOnly, sessionId]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      onUnreadCountChange(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, activeTab, messages.length]);

  const handleFetchSocraticHint = async () => {
    soundFX.playSoftClick();
    setIsGeneratingHint(true);
    try {
      const data = await getSocraticHint(sessionId);
      setSocraticHint(data.hint);
      setShowHintPrompt(false);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsGeneratingHint(false);
    }
  };

  const handleGenerateAiLog = async () => {
    soundFX.playSoftClick();
    setIsGeneratingAiLog(true);
    try {
      const res = await generateSessionAiLog(sessionId);
      if (res && res.ai_log) {
        setAiLogText(res.ai_log);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsGeneratingAiLog(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    setErrorMessage('');
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);
    setLastActivityTime(Date.now());
    setShowHintPrompt(false);

    // Optimistic local append
    const optimisticMsg = {
      id: `msg-opt-${Date.now()}`,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_avatar: currentUser.avatar_seed || 'bottts-1',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      // Try WebSocket first for instant delivery; fall back to HTTP
      const sent = wsSend && wsSend({
        type: 'chat',
        payload: {
          sender_id: currentUser.id,
          sender_name: currentUser.name,
          sender_avatar: currentUser.avatar_seed || 'bottts-1',
          text: textToSend,
        },
      });
      if (!sent) {
        // WS unavailable — use HTTP
        await sendChatMessage(sessionId, currentUser.id, textToSend);
        await fetchMessages();
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        width: '340px',
        background: 'var(--color-surface)',
        borderLeft: 'var(--border-thick)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxShadow: 'var(--shadow-hard-md)',
      }}
    >
      {/* Header & Tab Switcher */}
      <div
        style={{
          padding: '0.65rem 0.85rem',
          background: 'var(--color-bg)',
          borderBottom: 'var(--border-thick)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`btn-secondary ${activeTab === 'chat' ? 'btn-primary' : ''}`}
            onClick={() => {
              soundFX.playSoftClick();
              setActiveTab('chat');
            }}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
          >
            <MessageSquare size={13} strokeWidth={2.5} />
            <span>Chat</span>
          </button>

          <button
            className={`btn-secondary ${activeTab === 'ai-log' ? 'btn-primary' : ''}`}
            onClick={() => {
              soundFX.playSoftClick();
              setActiveTab('ai-log');
              handleGenerateAiLog();
            }}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
          >
            <FileText size={13} strokeWidth={2.5} />
            <span>Live AI Takeaways</span>
          </button>
        </div>

        <button className="btn-secondary" onClick={onClose} style={{ padding: '0.2rem 0.4rem' }}>
          <X size={15} strokeWidth={2.5} />
        </button>
      </div>

      {errorMessage && (
        <div style={{ background: '#FEE2E2', padding: '0.4rem 0.75rem', fontSize: '0.78rem', color: 'var(--color-error)', borderBottom: '1px solid var(--color-error)' }}>
          {errorMessage}
        </div>
      )}

      {/* Silence-Triggered Socratic Hint Notification Banner */}
      {showHintPrompt && !isReadOnly && (
        <div
          style={{
            background: '#FEF3C7',
            borderBottom: 'var(--border-thick)',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Lightbulb size={16} strokeWidth={2.5} style={{ color: 'var(--color-ink)' }} />
            <span>Quiet session? Get a Socratic Hint</span>
          </div>
          <button
            className="btn-primary"
            onClick={handleFetchSocraticHint}
            disabled={isGeneratingHint}
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
          >
            {isGeneratingHint ? '...' : 'Get Hint'}
          </button>
        </div>
      )}

      {/* Displayed Socratic Guiding Discovery Hint */}
      {socraticHint && (
        <div
          style={{
            background: '#EFF6FF',
            borderBottom: 'var(--border-thick)',
            padding: '0.75rem 0.85rem',
            fontSize: '0.8rem',
            color: 'var(--color-ink)',
            lineHeight: '1.4',
            position: 'relative',
          }}
        >
          <div style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <HelpCircle size={14} strokeWidth={2.5} style={{ color: 'var(--color-cobalt)' }} />
              Socratic Guided Discovery Question
            </span>
            <button onClick={() => setSocraticHint('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
          <div>{socraticHint}</div>
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.82rem', marginTop: '2rem' }}>
                No chat messages yet. Say hi and start solving together!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id;
                const isAi = msg.sender_id === 'ai-tutor-bot';
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '2px', fontWeight: 700 }}>
                      {isMe ? 'You' : msg.sender_name}
                    </div>
                    <div
                      style={{
                        background: isMe
                          ? 'var(--color-primary)'
                          : isAi
                          ? '#EFF6FF'
                          : 'var(--color-bg)',
                        border: 'var(--border-thick)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.82rem',
                        color: 'var(--color-ink)',
                        lineHeight: '1.4',
                        boxShadow: 'var(--shadow-hard-sm)',
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isReadOnly ? (
            <form onSubmit={handleSendMessage} style={{ padding: '0.65rem', borderTop: 'var(--border-thick)', background: 'var(--color-bg)', display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Type a message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
                disabled={isSending}
              />
              <button className="btn-primary" type="submit" style={{ padding: '0.45rem 0.75rem' }} disabled={isSending || !inputText.trim()}>
                <Send size={14} strokeWidth={2.5} />
              </button>
            </form>
          ) : (
            <div style={{ padding: '0.65rem', borderTop: 'var(--border-thick)', background: '#F3F4F6', fontSize: '0.78rem', color: 'var(--color-muted)', textAlign: 'center' }}>
              <Lock size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Archived session chat (Read-Only)
            </div>
          )}
        </>
      )}

      {/* LIVE AI TAKEAWAYS TAB */}
      {activeTab === 'ai-log' && (
        <div style={{ flex: 1, padding: '0.85rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
              Live AI Takeaways Log
            </span>

            <button
              className="btn-secondary"
              onClick={handleGenerateAiLog}
              disabled={isGeneratingAiLog}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              title="Refresh AI Session Takeaways"
            >
              <RefreshCw size={12} className={isGeneratingAiLog ? 'spinner' : ''} strokeWidth={2.5} />
              <span>Refresh</span>
            </button>
          </div>

          <div
            style={{
              background: 'var(--color-bg)',
              border: 'var(--border-thick)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem',
              fontSize: '0.82rem',
              color: 'var(--color-ink)',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}
          >
            {aiLogText || (
              <div style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '1rem 0' }}>
                Generating live session takeaways from working chat...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
