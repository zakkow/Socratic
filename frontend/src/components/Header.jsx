import React from 'react';
import { Sparkles, BookOpen, PlusCircle, Compass, LogIn, Users, Pin } from 'lucide-react';
import { AvatarIcon } from './AvatarIcon';
import { StatusBadge } from './StatusBadge';

export function Header({
  currentUser,
  userStatus = 'online',
  unreadCount = 0,
  onOpenStruggleModal,
  onGoHome,
  onGoQuestionsBoard,
  currentView,
  onOpenProfileDrawer,
  onOpenAuthModal,
  onOpenFriendsDrawer,
  selectedCourse,
  onSelectCourse,
}) {
  return (
    <header className="app-header">
      <div className="brand-container" onClick={onGoHome} title="Go to Topic Explore Board">
        <div style={{
          width: '74px',
          height: '74px',
          overflow: 'hidden',
          borderRadius: '14px',
          border: '3px solid #1F2421',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src="/socratic-logo.png"
            alt="Socratic Logo"
            style={{ width: '130px', height: '130px', display: 'block' }}
          />
        </div>
        <div>
          <h1 className="brand-title">Socratic</h1>
        </div>

        {/* Interactive Course Selector */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <select
            value={selectedCourse}
            onChange={(e) => onSelectCourse(e.target.value)}
            className="course-badge"
            style={{
              cursor: 'pointer',
              border: 'var(--border-thick)',
              padding: '0.2rem 0.5rem',
              outline: 'none',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
            }}
            title="Filter by enrolled course"
          >
            <option value="cs101">CS101: Computer Science</option>
            <option value="math201">MATH201: Calculus</option>
            <option value="eng101">ENG101: English</option>
            <option value="civ101">CIV101: Civics</option>
            <option value="phys150">PHYS150: Physics</option>
            <option value="all">All Enrolled Courses</option>
          </select>
        </div>
      </div>

      <div className="header-actions">
        <button
          className={`btn-secondary ${currentView === 'explore' ? 'active-nav-tab' : ''}`}
          onClick={onGoHome}
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
        >
          <Compass size={16} strokeWidth={2.5} />
          <span>Explore Topics</span>
        </button>

        <button
          className={`btn-secondary ${currentView === 'questions' ? 'active-nav-tab' : ''}`}
          onClick={onGoQuestionsBoard}
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}
        >
          <Pin size={16} strokeWidth={2.5} />
          <span>Question Board</span>
        </button>

        <button className="btn-primary" onClick={onOpenStruggleModal} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          <PlusCircle size={16} strokeWidth={2.5} />
          <span>What Are You Working On?</span>
        </button>

        <button
          className="btn-secondary"
          onClick={onOpenFriendsDrawer}
          style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', position: 'relative' }}
          title="Open Study Partners & Friends"
        >
          <Users size={16} strokeWidth={2.5} />
          <span>Friends</span>
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: 'var(--color-error)',
                color: '#FFFFFF',
                fontSize: '0.65rem',
                fontWeight: 800,
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--color-surface)',
                boxShadow: 'var(--shadow-hard-sm)',
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {currentUser ? (
          <button
            className="btn-secondary"
            onClick={onOpenProfileDrawer}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: 'var(--color-light-sage)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            title="Open Profile & Settings"
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <AvatarIcon seed={currentUser.avatar_seed || 'bottts-1'} size={26} />
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}>
                <StatusBadge status={userStatus || currentUser.status || 'online'} size={12} />
              </div>
            </div>
            <span style={{ fontWeight: 700 }}>{currentUser.name}</span>
          </button>
        ) : (
          <button className="btn-secondary" onClick={onOpenAuthModal} style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}>
            <LogIn size={16} strokeWidth={2.5} />
            <span>Sign In / Up (.edu)</span>
          </button>
        )}
      </div>
    </header>
  );
}
