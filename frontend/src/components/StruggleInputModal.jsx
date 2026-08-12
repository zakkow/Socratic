import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, ShieldAlert, AlertCircle, Upload, FileText, CheckCircle2, Layers, X, Pin, Star } from 'lucide-react';
import { submitQuizAttempt, createUser, pinQuestionToBoard, createStudyRequest } from '../api';
import { soundFX } from '../utils/soundFX';

export function StruggleInputModal({
  isOpen,
  onClose,
  initialTopicName = '',
  currentUser,
  targetFriend = null,
  onStruggleSubmitted,
  onTopicClassified,
  onOpenAuthModal,
  onGoToQuestionBoard,
}) {
  const [userName, setUserName] = useState('');
  const [activeUser, setActiveUser] = useState(currentUser);
  const [freeText, setFreeText] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState(5);
  const [preConfidence, setPreConfidence] = useState(3);
  const [classifiedTopic, setClassifiedTopic] = useState(null);
  const [showBroadPrompt, setShowBroadPrompt] = useState(false);
  const [aiFeedbackReason, setAiFeedbackReason] = useState('');
  const [aiSuggestedTopics, setAiSuggestedTopics] = useState([]);
  const [showAiClarification, setShowAiClarification] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [extractedPdfText, setExtractedPdfText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setUserName(currentUser.name);
      setActiveUser(currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (initialTopicName) {
      setFreeText(`I am working through ${initialTopicName}`);
    } else {
      setFreeText('');
    }
    setClassifiedTopic(null);
    setShowBroadPrompt(false);
    setShowAiClarification(false);
    setAiFeedbackReason('');
    setAiSuggestedTopics([]);
    setErrorMessage('');
    setUploadedFileName('');
    setExtractedPdfText('');
    setPreConfidence(3);
  }, [initialTopicName, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    soundFX.playSoftClick();
    setErrorMessage('');
    const file = e.target.files[0];
    if (!file) return;

    const MAX_BYTES = 5 * 1024 * 1024; // 5MB Limit
    if (file.size > MAX_BYTES) {
      setErrorMessage(`File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please attach a smaller homework file.`);
      e.target.value = '';
      return;
    }

    const validExtensions = ['.pdf', '.txt', '.md', '.doc', '.docx'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage('Invalid file type. Please upload a PDF, text, or document file.');
      e.target.value = '';
      return;
    }

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const cleanExtracted = typeof text === 'string' ? text.slice(0, 1500) : '';
      setExtractedPdfText(cleanExtracted);
    };
    reader.readAsText(file);
  };

  const handleClearFile = (e) => {
    e.stopPropagation();
    soundFX.playSoftClick();
    setUploadedFileName('');
    setExtractedPdfText('');
  };

  const getCombinedText = () => {
    let text = freeText.trim();
    if (extractedPdfText.trim()) {
      text += `\n[Homework File Context]: ${extractedPdfText.trim()}`;
    }
    return text;
  };

  const handleSubmitStruggle = async (e) => {
    e.preventDefault();
    soundFX.playSoftClick();
    setErrorMessage('');

    const combinedText = getCombinedText();
    if (!combinedText) {
      setErrorMessage('Please type a description of your problem or attach a homework file.');
      return;
    }

    let userToUse = activeUser;

    if (!userToUse) {
      if (!userName.trim()) {
        setErrorMessage('Please enter your name.');
        return;
      }
      setIsSubmitting(true);
      try {
        userToUse = await createUser(userName.trim());
        setActiveUser(userToUse);
      } catch (err) {
        setErrorMessage(err.message);
        setIsSubmitting(false);
        return;
      }
    }

    if (targetFriend) {
      setIsSubmitting(true);
      try {
        await createStudyRequest(
          userToUse.id,
          userToUse.name,
          userToUse.avatar_seed || 'bottts-1',
          targetFriend.id,
          initialTopicName || 'General Practice',
          combinedText,
          proficiencyLevel,
          preConfidence
        );
        soundFX.playNotification();
        onClose();
        // Show a toast via the errorMessage slot temporarily re-purposed as success,
        // or simply close -- the friend will see the request in their DM drawer
        // (The parent App.jsx showToast will surface the success feedback)
        if (typeof onGoToQuestionBoard === 'function') {
          onGoToQuestionBoard(); // re-uses the toast callback to signal success
        }
      } catch (err) {
        setErrorMessage(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cleanInput = combinedText.toLowerCase();
    if (cleanInput.includes('calculus') && !cleanInput.includes('calc 1') && !cleanInput.includes('calc 2') && !cleanInput.includes('calc 3')) {
      setShowBroadPrompt(true);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitQuizAttempt(userToUse.id, combinedText, false, proficiencyLevel, preConfidence);
      if (res && res.is_valid_topic === false) {
        setShowAiClarification(true);
        setAiFeedbackReason(res.feedback_reason || 'Please specify a valid course subject or concept.');
        setAiSuggestedTopics(res.suggested_topics || []);
        setIsSubmitting(false);
        return;
      }

      const classified = res.classified_topic || 'Recursion & Base Cases';
      setClassifiedTopic(classified);
      soundFX.playSoftClick();
      const callback = onStruggleSubmitted || onTopicClassified;
      if (callback) {
        callback(userToUse, classified);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSubTopic = async (subTopicName) => {
    soundFX.playSoftClick();
    setShowBroadPrompt(false);

    let userToUse = activeUser;
    if (!userToUse) {
      if (!userName.trim()) {
        setErrorMessage('Please enter your name.');
        return;
      }
      try {
        userToUse = await createUser(userName.trim());
        setActiveUser(userToUse);
      } catch (err) {
        setErrorMessage(err.message);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await submitQuizAttempt(userToUse.id, subTopicName, false, proficiencyLevel, preConfidence);
      setClassifiedTopic(res.classified_topic);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToMatching = () => {
    soundFX.playSoftClick();
    const callback = onStruggleSubmitted || onTopicClassified;
    if (callback) {
      callback(activeUser, classifiedTopic || initialTopicName || 'Recursion & Base Cases');
    }
    onClose();
  };

  const handlePinDirectlyToBoard = async () => {
    soundFX.playSoftClick();
    setErrorMessage('');

    let userToUse = activeUser;
    if (!userToUse) {
      if (!userName.trim()) {
        setErrorMessage('Please enter your name first.');
        return;
      }
      try {
        userToUse = await createUser(userName.trim());
        setActiveUser(userToUse);
      } catch (err) {
        setErrorMessage(err.message);
        return;
      }
    }

    const topicToUse = classifiedTopic || initialTopicName || 'General Struggle';
    const textToUse = getCombinedText() || 'Looking for a study partner!';

    try {
      await pinQuestionToBoard(userToUse.id, topicToUse, textToUse);
      onClose();
      if (onGoToQuestionBoard) {
        onGoToQuestionBoard();
      }
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.4rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
            <span>Post Your Study Struggle</span>
          </h2>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {errorMessage && (
          <div className="error-banner" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} strokeWidth={2.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* AI Topic Moderation & Clarification Box */}
        {showAiClarification && (
          <div style={{ background: '#FEF3C7', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={18} strokeWidth={2.5} style={{ color: 'var(--color-ink)' }} />
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                AI Topic Verification Guidance
              </h4>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-ink)', marginBottom: '0.85rem', lineHeight: '1.45' }}>
              {aiFeedbackReason}
            </p>
            {aiSuggestedTopics.length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '0.4rem' }}>
                  Click a suggested academic topic below:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {aiSuggestedTopics.map((top, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setShowAiClarification(false);
                        handleSelectSubTopic(top);
                      }}
                      style={{ textAlign: 'left', justifyContent: 'flex-start', background: '#FFF', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      <span>✦ {top}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Broad Term Calculus Disambiguation Box */}
        {showBroadPrompt && (
          <div style={{ background: '#EFF6FF', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Layers size={18} strokeWidth={2.5} style={{ color: 'var(--color-cobalt)' }} />
              <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 800, margin: 0 }}>
                Which area of Calculus specifically?
              </h4>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
              Calculus covers multiple sub-disciplines. Choose your specific area for better peer matching, or skip to use our best guess:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSelectSubTopic('Calculus 1: Power & Chain Rule Derivatives')}
                style={{ textAlign: 'left', justifyContent: 'flex-start', background: '#FFF' }}
              >
                <strong>Calc 1</strong>: Differential Calculus (Limits, Derivatives, Chain Rule)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSelectSubTopic('Calculus 2: Integration Techniques')}
                style={{ textAlign: 'left', justifyContent: 'flex-start', background: '#FFF' }}
              >
                <strong>Calc 2</strong>: Integral Calculus & Series (Integrals, Series, Taylor Polynomials)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSelectSubTopic('Calculus 3: Partial Derivatives & Gradients')}
                style={{ textAlign: 'left', justifyContent: 'flex-start', background: '#FFF' }}
              >
                <strong>Calc 3</strong>: Multivariable Calculus (Partial Derivatives, Vector Calculus)
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowBroadPrompt(false)}
                style={{ marginTop: '0.25rem', width: '100%' }}
              >
                <span>Skip & Match Best Guess</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitStruggle}>
          {!currentUser && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" htmlFor="modal-student-name" style={{ margin: 0 }}>Your Name</label>
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Have a .edu account? Sign in
                </button>
              </div>
              <input
                id="modal-student-name"
                type="text"
                className="form-input"
                placeholder="e.g. Alex Chen"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isSubmitting || classifiedTopic !== null}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="modal-free-text">Describe Your Problem / Struggle</label>
            <textarea
              id="modal-free-text"
              className="form-textarea"
              placeholder="e.g. 9 - 3 / 1/3 + 1 or chain rule derivatives"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              disabled={isSubmitting || classifiedTopic !== null}
              rows={3}
            />
          </div>

          {/* PDF / Homework Document File Scanner Dropzone */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <FileText size={15} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
              <span>Optional: Scan Homework / Worksheet File (5MB Limit)</span>
            </label>
            <div
              style={{
                border: '2px dashed var(--color-ink)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                padding: '0.75rem',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                {uploadedFileName ? (
                  <>
                    <FileText size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                    <span style={{ color: 'var(--color-primary-deep)' }}>{uploadedFileName}</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleClearFile}
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', marginLeft: '0.4rem', border: '1px solid #999' }}
                    >
                      <X size={12} strokeWidth={2.5} />
                      <span>Remove</span>
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
                    <Upload size={16} strokeWidth={2.5} style={{ color: 'var(--color-muted)' }} />
                    <span>Click or Drag File to AI Scan</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 1-10 Numerical Proficiency Slider */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ margin: 0 }}>How Proficient Are You in This Topic?</label>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  padding: '0.15rem 0.6rem',
                  background: 'var(--color-primary)',
                  borderRadius: '4px',
                  border: '1px solid var(--color-ink)',
                }}
              >
                Level {proficiencyLevel} / 10
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="10"
              value={proficiencyLevel}
              onChange={(e) => setProficiencyLevel(Number(e.target.value))}
              disabled={isSubmitting || classifiedTopic !== null}
              style={{ width: '100%', accentColor: 'var(--color-ink)', margin: '0.5rem 0' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)' }}>
              <span>1: Beginner / Lost</span>
              <span>5: Intermediate</span>
              <span>10: Mastery / Tutor</span>
            </div>
          </div>

          {/* Interactive Green Star Pre-Session Confidence Rating */}
          <div className="form-group" style={{ marginTop: '0.85rem', textAlign: 'center' }}>
            <label className="form-label" style={{ marginBottom: '0.5rem', textAlign: 'center' }}>
              How Confident Do You Feel Right Now?
            </label>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', margin: '0.4rem 0' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    soundFX.playSoftClick();
                    setPreConfidence(star);
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
                  title={`${star} Star Confidence`}
                >
                  <Star
                    size={28}
                    fill={star <= preConfidence ? 'var(--color-primary-deep)' : 'transparent'}
                    stroke="var(--color-primary-deep)"
                    strokeWidth={2.5}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Classification Output Result Card */}
          {classifiedTopic && (
            <div style={{ background: 'var(--color-light-sage)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem', margin: '1.25rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <CheckCircle2 size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.95rem' }}>
                  Identified Concept Topic
                </span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>
                {classifiedTopic}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {classifiedTopic ? (
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handleProceedToMatching}>
                <span>Search Live Peer Match</span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            ) : (
              <>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="spinner" />
                      <span>Classifying Topic...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} strokeWidth={2.5} />
                      <span>Search Live Match</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePinDirectlyToBoard}
                  disabled={isSubmitting}
                  style={{ background: '#FFF' }}
                  title="Pin your struggle directly to the Classmate Questions Board"
                >
                  <Pin size={16} strokeWidth={2.5} style={{ color: 'var(--color-accent)' }} />
                  <span>Post to Board</span>
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
