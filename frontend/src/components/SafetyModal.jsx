import React, { useState } from 'react';
import { X, ShieldAlert, Ban, UserX, AlertCircle } from 'lucide-react';
import { unmatchSession, blockUser, reportUser } from '../api';

export function SafetyModal({ isOpen, mode, onClose, currentUser, matchData, onActionSuccess }) {
  const [reportReason, setReportReason] = useState('inappropriate_messages');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !matchData || !currentUser) return null;

  const partnerName = matchData.partner_name;
  const partnerId = matchData.partner_id || (matchData.user_a_id === currentUser.id ? matchData.user_b_id : matchData.user_a_id);

  const handleExecuteUnmatch = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await unmatchSession(matchData.session_id, currentUser.id);
      onActionSuccess('unmatch', 'You have unmatched from this session.');
      onClose();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteBlock = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await blockUser(currentUser.id, partnerId);
      onActionSuccess('block', `You have blocked ${partnerName}. They will no longer be matched with you.`);
      onClose();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteReport = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await reportUser(
        currentUser.id,
        partnerId,
        matchData.session_id,
        reportReason,
        reportDetails.trim() || null
      );

      if (alsoBlock) {
        await blockUser(currentUser.id, partnerId);
        onActionSuccess('report', `Report submitted and ${partnerName} has been blocked.`);
      } else {
        onActionSuccess('report', `Report submitted for review.`);
      }
      onClose();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="card-title" style={{ fontSize: '1.3rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={20} strokeWidth={2.5} style={{ color: 'var(--color-error)' }} />
            {mode === 'unmatch' && 'End Session / Unmatch'}
            {mode === 'block' && `Block ${partnerName}`}
            {mode === 'report' && `Report ${partnerName}`}
          </h3>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {errorMessage && (
          <div className="error-banner">
            <AlertCircle size={16} strokeWidth={2.5} />
            <span>{errorMessage}</span>
          </div>
        )}

        {mode === 'unmatch' && (
          <div>
            <p className="card-subtitle">
              Are you sure you want to end this study session with <strong>{partnerName}</strong>? You can return to the topic explore board anytime.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleExecuteUnmatch} disabled={isSubmitting}>
                {isSubmitting ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        )}

        {mode === 'block' && (
          <div>
            <p className="card-subtitle">
              Blocking <strong>{partnerName}</strong> will immediately terminate your active session and bidirectionally prevent you from ever matching with each other again.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn-primary btn-danger" onClick={handleExecuteBlock} disabled={isSubmitting}>
                {isSubmitting ? 'Blocking...' : `Block ${partnerName}`}
              </button>
            </div>
          </div>
        )}

        {mode === 'report' && (
          <form onSubmit={handleExecuteReport}>
            <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
              Submit a report regarding <strong>{partnerName}</strong> for moderator review.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="report-reason">Reason</label>
              <select
                id="report-reason"
                className="form-select"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="inappropriate_messages">Inappropriate Messages / Harassment</option>
                <option value="spam">Spam or Unsolicited Links</option>
                <option value="off_topic">Off-topic / Non-educational behavior</option>
                <option value="other">Other Reason</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="report-details">Additional Details (Optional)</label>
              <textarea
                id="report-details"
                className="form-textarea"
                placeholder="Provide any context that will help our moderation team..."
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={alsoBlock}
                  onChange={(e) => setAlsoBlock(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-ink)' }}
                />
                <span>Also block {partnerName} immediately</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn-primary btn-danger" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
