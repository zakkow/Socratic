import React, { useState, useEffect } from 'react';
import { X, Search, Calendar, History, Clock, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';
import { getUserSessions } from '../api';
import { AvatarIcon } from './AvatarIcon';

export function SessionHistoryModal({ isOpen, onClose, currentUser, onRejoinSession }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'week' | 'month' | 'year'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen && currentUser?.id) {
      setIsLoading(true);
      setErrorMessage('');
      getUserSessions(currentUser.id)
        .then((data) => {
          if (Array.isArray(data)) {
            setSessions(data);
          } else {
            setSessions([]);
          }
        })
        .catch((err) => {
          setErrorMessage(err.message);
          setSessions([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen || !currentUser) return null;

  const filteredSessions = sessions
    .filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchKeyword =
        !q ||
        s.shared_topic.toLowerCase().includes(q) ||
        s.partner_name.toLowerCase().includes(q) ||
        s.explanation.toLowerCase().includes(q);

      if (!matchKeyword) return false;

      if (dateFilter === 'all') return true;
      const sessionDate = new Date(s.timestamp);
      const now = new Date();
      const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 3600 * 24);

      if (dateFilter === 'week') return diffDays <= 7;
      if (dateFilter === 'month') return diffDays <= 30;
      if (dateFilter === 'year') return diffDays <= 365;

      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${mm}/${dd}/${yyyy} at ${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: 'var(--border-thick)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={22} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
            <h2 className="card-title" style={{ fontSize: '1.4rem', margin: 0 }}>Study Session History</h2>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search className="search-input-icon" size={16} strokeWidth={2.5} />
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search history by topic (e.g. recursion, derivatives) or partner name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.88rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="category-pills" style={{ margin: 0 }}>
              <button
                className={`category-pill ${dateFilter === 'all' ? 'active' : ''}`}
                onClick={() => setDateFilter('all')}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                All Time
              </button>
              <button
                className={`category-pill ${dateFilter === 'week' ? 'active' : ''}`}
                onClick={() => setDateFilter('week')}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Past Week
              </button>
              <button
                className={`category-pill ${dateFilter === 'month' ? 'active' : ''}`}
                onClick={() => setDateFilter('month')}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Past Month
              </button>
              <button
                className={`category-pill ${dateFilter === 'year' ? 'active' : ''}`}
                onClick={() => setDateFilter('year')}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
              >
                Past Year
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <Calendar size={14} strokeWidth={2.5} />
              <select
                className="form-input"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sessions List Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingRight: '0.2rem' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>Loading session history...</p>
            </div>
          ) : errorMessage ? (
            <div className="error-banner">
              <AlertCircle size={16} strokeWidth={2.5} />
              <span>{errorMessage}</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)' }}>
              <History size={36} style={{ color: 'var(--color-muted)', margin: '0 auto 0.75rem auto' }} strokeWidth={2} />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800 }}>No Sessions Found</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', maxWidth: '400px', margin: '0.25rem auto 0 auto' }}>
                {searchQuery ? `No study sessions matched "${searchQuery}".` : 'You haven\'t completed any study sessions in this date range yet.'}
              </p>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <div
                key={session.id}
                style={{
                  background: 'var(--color-surface)',
                  border: 'var(--border-thick)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.25rem',
                  boxShadow: 'var(--shadow-hard-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                {/* Card Top Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <AvatarIcon seed={session.partner_avatar} size={34} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>
                        Matched with {session.partner_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={12} strokeWidth={2.5} />
                        <span>{formatDate(session.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="course-badge" style={{ textTransform: 'capitalize', margin: 0 }}>
                      {session.shared_topic}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: 'var(--border-thick)',
                        background: session.is_active ? 'var(--color-light-sage)' : '#F3F4F6',
                        color: session.is_active ? 'var(--color-primary-deep)' : 'var(--color-muted)',
                      }}
                    >
                      {session.is_active ? 'Active Now' : 'Ended'}
                    </span>
                  </div>
                </div>

                {/* Explanation Banner */}
                <div style={{ background: 'var(--color-bg)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.82rem', color: 'var(--color-ink)', lineHeight: '1.4' }}>
                  {session.explanation}
                </div>

                {/* View / Rejoin Action Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                  {session.is_active ? (
                    <button
                      className="btn-primary"
                      onClick={() => {
                        onRejoinSession(session);
                        onClose();
                      }}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      <span>Rejoin Session</span>
                      <ArrowRight size={14} strokeWidth={2.5} />
                    </button>
                  ) : (
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        onRejoinSession(session);
                        onClose();
                      }}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      <BookOpen size={14} strokeWidth={2.5} />
                      <span>View Archived Notes</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
