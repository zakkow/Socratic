import React, { useState } from 'react';
import { Sparkles, ArrowRight, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { createUser, submitQuizAttempt } from '../api';

export function QuizScreen({ onQuizCompleted, currentUser }) {
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [freeText, setFreeText] = useState('');
  const [isStuck, setIsStuck] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [classifiedTopic, setClassifiedTopic] = useState(null);
  const [activeUser, setActiveUser] = useState(currentUser);

  const handleClassifyStruggle = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    if (!userName.trim()) {
      setErrorMessage('Please enter your name first.');
      return;
    }

    if (!freeText.trim()) {
      setErrorMessage('Please describe what topic or problem you are working on.');
      return;
    }

    setIsSubmitting(true);

    try {
      let user = activeUser;
      if (!user || user.name !== userName.trim()) {
        user = await createUser(userName.trim());
        setActiveUser(user);
      }

      const attemptResult = await submitQuizAttempt(
        user.id,
        freeText.trim(),
        !isStuck
      );

      setClassifiedTopic(attemptResult.classified_topic);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToMatch = () => {
    if (activeUser && classifiedTopic) {
      onQuizCompleted(activeUser, classifiedTopic);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">What are you working on today?</h2>
      <p className="card-subtitle">
        Describe your current struggle in plain words. Our model pairs you in real time with classmates working through the exact same concept.
      </p>

      {errorMessage && (
        <div className="error-banner" role="alert">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleClassifyStruggle}>
        <div className="form-group">
          <label className="form-label" htmlFor="student-name">Your Name</label>
          <input
            id="student-name"
            type="text"
            className="form-input"
            placeholder="e.g. Alex Chen"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            disabled={isSubmitting || classifiedTopic !== null}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="free-text-input">
            What are you stuck on right now?
          </label>
          <textarea
            id="free-text-input"
            className="form-textarea"
            placeholder="I don't get how the base case works in recursion"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            disabled={isSubmitting || classifiedTopic !== null}
            required
          />
        </div>

        <div className="form-group">
          <div 
            className="toggle-wrapper"
            onClick={() => !classifiedTopic && setIsStuck(!isStuck)}
            tabIndex={0}
            role="switch"
            aria-checked={isStuck}
            aria-label="Toggle stuck or confident state"
          >
            <div className="toggle-info">
              <span className="toggle-title">
                {isStuck ? "I'm currently stuck on this" : "I completed this problem correctly"}
              </span>
              <span className="toggle-description">
                {isStuck 
                  ? "Toggle if you want extra peer support on this topic" 
                  : "Toggle if you got the answer and feel confident"}
              </span>
            </div>
            <div className={`toggle-switch ${isStuck ? 'active' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
        </div>

        {!classifiedTopic ? (
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !freeText.trim() || !userName.trim()}
          >
            {isSubmitting ? (
              <>
                <div className="spinner" />
                <span>Classifying topic...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Analyze & Classify Topic</span>
              </>
            )}
          </button>
        ) : (
          <div>
            <div className="classified-box">
              <div className="classified-header">Topic Identified</div>
              <div className="classified-topic-name">
                That's a <span style={{ color: '#818cf8' }}>{classifiedTopic}</span> topic!
              </div>
              <p style={{ marginTop: '0.5rem', color: '#cbd5e1', fontSize: '0.92rem' }}>
                We've logged your struggle vector for {classifiedTopic}. Click below to find a classmate who needs a partner.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleProceedToMatch}
              style={{ background: 'var(--warm-gradient)' }}
            >
              <span>Find a Study Partner</span>
              <ArrowRight size={20} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
