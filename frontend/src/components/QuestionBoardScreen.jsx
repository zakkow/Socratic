import React, { useState, useEffect } from 'react';
import { Search, Pin, Users, Sparkles, ArrowRight, BookOpen, AlertCircle, RefreshCw, X, Edit3, Trash2, CheckCircle2, Calendar, MessageSquare, Clock } from 'lucide-react';
import { getPinnedQuestions, startDirectMatch, updatePinnedQuestion, deletePinnedQuestion, resolvePinnedQuestion } from '../api';
import { AvatarIcon } from './AvatarIcon';
import { soundFX } from '../utils/soundFX';
import { CuteMathDecorations } from './CuteMathDecorations';

const COURSE_PILLS = [
  { id: 'all', label: 'All Courses' },
  { id: 'cs101', label: 'CS101: Computer Science' },
  { id: 'math201', label: 'MATH201: Calculus' },
  { id: 'eng101', label: 'ENG101: English' },
  { id: 'civ101', label: 'CIV101: Civics' },
  { id: 'phys150', label: 'PHYS150: Physics' },
];

export function QuestionBoardScreen({ currentUser, onGoToScratchpad, onOpenStruggleModal, selectedCourse = 'all' }) {
  const [questions, setQuestions] = useState([]);
  const [activeCourseFilter, setActiveCourseFilter] = useState(selectedCourse);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editStruggleText, setEditStruggleText] = useState('');

  const [selectedDetailQuestion, setSelectedDetailQuestion] = useState(null);
  const [offlinePromptState, setOfflinePromptState] = useState(null);

  const fetchPinnedQuestions = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await getPinnedQuestions(currentUser?.id || '');
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMessage(err.message);
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPinnedQuestions();
  }, [activeCourseFilter, currentUser?.id]);

  const filteredQuestions = questions.filter((q) => {
    const courseMatch = activeCourseFilter === 'all' || (q.course_id || 'cs101').toLowerCase() === activeCourseFilter.toLowerCase();
    if (!courseMatch) return false;

    const searchClean = searchQuery.toLowerCase().trim();
    if (!searchClean) return true;

    return (
      q.topic_name.toLowerCase().includes(searchClean) ||
      q.struggle_text.toLowerCase().includes(searchClean) ||
      q.student_name.toLowerCase().includes(searchClean) ||
      q.school_name.toLowerCase().includes(searchClean)
    );
  });

  const handleToggleResolve = async (pin, e) => {
    e.stopPropagation();
    soundFX.playSoftClick();
    try {
      await resolvePinnedQuestion(pin.id);
      setQuestions((prev) =>
        prev.map((q) => (q.id === pin.id ? { ...q, is_resolved: !q.is_resolved } : q))
      );
      if (selectedDetailQuestion && selectedDetailQuestion.id === pin.id) {
        setSelectedDetailQuestion((prev) => (prev ? { ...prev, is_resolved: !prev.is_resolved } : prev));
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleJoinSession = async (pin, e) => {
    if (e) e.stopPropagation();
    soundFX.playSoftClick();
    if (!currentUser) {
      onOpenStruggleModal(pin.topic_name);
      return;
    }

    // Offline poster gap fix: If author is offline, prompt for async study request scheduling
    if (pin.is_online === false) {
      setOfflinePromptState(pin);
      return;
    }

    try {
      const res = await startDirectMatch(currentUser.id, pin.student_id, pin.topic_name);
      // Auto-resolve question when session starts
      await resolvePinnedQuestion(pin.id).catch(() => {});
      if (onGoToScratchpad) {
        onGoToScratchpad(res);
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  return (
    <section className="explore-section">
      {/* Centered & Elegantly Spaced Banner */}
      <div className="question-board-banner">
        <CuteMathDecorations />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>
            Classmates Waiting for Help
          </h2>

          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary-deep)', maxWidth: '560px', margin: 0, lineHeight: '1.5' }}>
            Browse classmate questions or post your own. Join any session to start a 1-on-1 scratchpad!
          </p>

          <button
            className="btn-primary"
            onClick={() => {
              soundFX.playSoftClick();
              onOpenStruggleModal('');
            }}
            style={{ fontSize: '0.92rem', padding: '0.65rem 1.25rem', marginTop: '0.25rem' }}
          >
            <Pin size={16} strokeWidth={2.5} />
            <span>Post Question to Board</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Course Filter Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '280px' }}>
            <Search className="search-input-icon" size={18} strokeWidth={2.5} />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search questions by keyword (e.g. chain rule, recursion, thesis)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  soundFX.playSoftClick();
                  setSearchQuery('');
                }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                }}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <div className="category-pills">
            {COURSE_PILLS.map((c) => (
              <button
                key={c.id}
                className={`category-pill ${activeCourseFilter === c.id ? 'active' : ''}`}
                onClick={() => {
                  soundFX.playSoftClick();
                  setActiveCourseFilter(c.id);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Questions List */}
      {errorMessage && (
        <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} strokeWidth={2.5} />
          <span>{errorMessage}</span>
          <button className="btn-secondary" onClick={fetchPinnedQuestions} style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem' }}>
            <RefreshCw size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-muted)' }}>
            Loading classmate question board...
          </p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: 'var(--shadow-hard-md)' }}>
          <Pin size={44} style={{ color: 'var(--color-muted)', margin: '0 auto 1rem auto' }} strokeWidth={2} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            No Classmate Questions Pinned
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', maxWidth: '460px', margin: '0 auto 1.25rem auto', lineHeight: '1.5' }}>
            {searchQuery
              ? `No pinned question matched "${searchQuery}".`
              : 'Be the first to pin a homework struggle to the question board!'}
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              soundFX.playSoftClick();
              onOpenStruggleModal('');
            }}
          >
            <Sparkles size={16} strokeWidth={2.5} />
            <span>Post Question to Board</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredQuestions.map((pin) => {
            const isAuthor = pin.student_id === currentUser?.id || pin.student_name.includes('You');
            const isResolved = pin.is_resolved;
            const isOnline = pin.is_online !== false;

            return (
              <div
                key={pin.id}
                onClick={() => {
                  soundFX.playSoftClick();
                  setSelectedDetailQuestion(pin);
                }}
                style={{
                  background: isResolved ? '#F9FAFB' : 'var(--color-surface)',
                  border: isResolved ? '2px solid #10B981' : 'var(--border-thick)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-hard-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  opacity: isResolved ? 0.88 : 1,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ position: 'relative' }}>
                      <AvatarIcon seed={pin.student_avatar || 'bottts-1'} size={38} />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: isOnline ? '#10B981' : '#9CA3AF',
                          border: '2px solid #FFF',
                        }}
                        title={isOnline ? 'Online now' : 'Offline'}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{pin.student_name}</span>
                        {!isOnline && <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)', fontWeight: 600 }}>(Offline)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{pin.school_name}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {isResolved ? (
                      <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={12} strokeWidth={2.5} />
                        Resolved
                      </span>
                    ) : (
                      <span className="course-badge" style={{ margin: 0, fontSize: '0.72rem' }}>
                        {(pin.course_id || 'cs101').toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>
                    {pin.topic_name}
                  </div>

                  {isAuthor && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn-secondary"
                        onClick={(e) => handleToggleResolve(pin, e)}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: isResolved ? '#059669' : 'var(--color-primary-deep)' }}
                        title={isResolved ? 'Re-open question' : 'Mark as resolved'}
                      >
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                        <span>{isResolved ? 'Reopen' : 'Resolve'}</span>
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundFX.playSoftClick();
                          setEditingQuestion(pin);
                          setEditTopicName(pin.topic_name);
                          setEditStruggleText(pin.struggle_text);
                        }}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        title="Edit posted question"
                      >
                        <Edit3 size={13} strokeWidth={2.5} />
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={async (e) => {
                          e.stopPropagation();
                          soundFX.playSoftClick();
                          try {
                            await deletePinnedQuestion(pin.id);
                            setQuestions((prev) => prev.filter((q) => q.id !== pin.id));
                          } catch (err) {
                            setErrorMessage(err.message);
                          }
                        }}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--color-error)' }}
                        title="Delete question from board"
                      >
                        <Trash2 size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--color-bg)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,0,0,0.08)', fontSize: '0.85rem', color: 'var(--color-ink)', lineHeight: '1.45' }}>
                  "{pin.struggle_text}"
                </div>

                {pin.answers && pin.answers.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-primary-deep)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MessageSquare size={13} strokeWidth={2.5} />
                    <span>{pin.answers.length} answer/hint provided</span>
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={(e) => handleJoinSession(pin, e)}
                  style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem', marginTop: '0.2rem', background: !isOnline ? 'var(--color-cobalt)' : undefined }}
                >
                  {!isOnline ? (
                    <>
                      <Calendar size={15} strokeWidth={2.5} />
                      <span>Schedule Async Session ({pin.student_name.split(' ')[0]} Offline)</span>
                    </>
                  ) : (
                    <>
                      <Users size={15} strokeWidth={2.5} />
                      <span>Join Live Session with {pin.student_name.split(' ')[0]}</span>
                      <ArrowRight size={15} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail View Modal for Pinned Question & Answers */}
      {selectedDetailQuestion && (
        <div className="modal-overlay" onClick={() => setSelectedDetailQuestion(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AvatarIcon seed={selectedDetailQuestion.student_avatar || 'bottts-1'} size={40} />
                <div>
                  <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                    {selectedDetailQuestion.student_name}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{selectedDetailQuestion.school_name}</div>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedDetailQuestion(null)} style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="topic-pill" style={{ margin: 0 }}>{selectedDetailQuestion.topic_name}</span>
              {selectedDetailQuestion.is_resolved && (
                <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '12px' }}>
                  ✓ Resolved
                </span>
              )}
            </div>

            <div style={{ background: 'var(--color-bg)', padding: '1rem', borderRadius: 'var(--radius-md)', border: 'var(--border-thick)', marginBottom: '1.25rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
              "{selectedDetailQuestion.struggle_text}"
            </div>

            <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Answers & Socratic Guidance ({selectedDetailQuestion.answers?.length || 0})
            </h4>

            {(!selectedDetailQuestion.answers || selectedDetailQuestion.answers.length === 0) ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                No written answers submitted yet. Join a 1-on-1 live workspace to collaborate directly!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '180px', overflowY: 'auto' }}>
                {selectedDetailQuestion.answers.map((ans, idx) => (
                  <div key={idx} style={{ background: '#FFF', border: '1px solid rgba(0,0,0,0.1)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                    <strong style={{ color: 'var(--color-primary-deep)' }}>{ans.sender_name}: </strong>
                    <span>{ans.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {(selectedDetailQuestion.student_id === currentUser?.id || selectedDetailQuestion.student_name.includes('You')) && (
                <button
                  className="btn-secondary"
                  onClick={(e) => handleToggleResolve(selectedDetailQuestion, e)}
                  style={{ flex: 1 }}
                >
                  <CheckCircle2 size={16} strokeWidth={2.5} />
                  <span>{selectedDetailQuestion.is_resolved ? 'Reopen Question' : 'Mark as Resolved'}</span>
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => {
                  const q = selectedDetailQuestion;
                  setSelectedDetailQuestion(null);
                  handleJoinSession(q);
                }}
                style={{ flex: 1 }}
              >
                <Users size={16} strokeWidth={2.5} />
                <span>Collaborate Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Author Scheduling Prompt Modal */}
      {offlinePromptState && (
        <div className="modal-overlay" onClick={() => setOfflinePromptState(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ background: '#FEF3C7', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} strokeWidth={2.5} style={{ color: 'var(--color-ink)' }} />
                {offlinePromptState.student_name} is Currently Offline
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-ink)', margin: '0.35rem 0 0 0', lineHeight: '1.4' }}>
                They are not online right now for a live session. Would you like to send an <strong>Asynchronous Study Session Request</strong> so they are notified when they log back in?
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button className="btn-secondary" onClick={() => setOfflinePromptState(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const targetPin = offlinePromptState;
                  setOfflinePromptState(null);
                  onOpenStruggleModal(targetPin.topic_name);
                }}
                style={{ flex: 1, background: 'var(--color-cobalt)' }}
              >
                <Calendar size={16} strokeWidth={2.5} />
                <span>Send Study Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="modal-overlay" onClick={() => setEditingQuestion(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                Edit Pinned Question
              </h3>
              <button className="btn-secondary" onClick={() => setEditingQuestion(null)} style={{ padding: '0.25rem 0.5rem' }}>
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Topic / Concept Name</label>
              <input
                className="form-input"
                value={editTopicName}
                onChange={(e) => setEditTopicName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Struggle Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={editStruggleText}
                onChange={(e) => setEditStruggleText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
              <button className="btn-secondary" onClick={() => setEditingQuestion(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  soundFX.playSoftClick();
                  try {
                    await updatePinnedQuestion(editingQuestion.id, editTopicName, editStruggleText);
                    setQuestions((prev) =>
                      prev.map((q) =>
                        q.id === editingQuestion.id ? { ...q, topic_name: editTopicName, struggle_text: editStruggleText } : q
                      )
                    );
                    setEditingQuestion(null);
                  } catch (err) {
                    setErrorMessage(err.message);
                  }
                }}
                style={{ flex: 1 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
