import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TopicExploreBoard } from './components/TopicExploreBoard';
import { QuestionBoardScreen } from './components/QuestionBoardScreen';
import { StruggleInputModal } from './components/StruggleInputModal';
import { MatchRevealScreen } from './components/MatchRevealScreen';
import { ScratchpadScreen } from './components/ScratchpadScreen';
import { SafetyModal } from './components/SafetyModal';
import { AuthModal } from './components/AuthModal';
import { ProfileDrawer } from './components/ProfileDrawer';
import { SessionHistoryModal } from './components/SessionHistoryModal';
import { FriendsDrawer } from './components/FriendsDrawer';
import { getSavedUser, setSavedUser, clearSavedUser, getActiveSession, updateUserStatus } from './api';
import { soundFX } from './utils/soundFX';
import { CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('explore'); // 'explore' | 'questions' | 'match' | 'scratchpad'
  const [currentUser, setCurrentUser] = useState(() => getSavedUser());
  const [classifiedTopic, setClassifiedTopic] = useState('');
  const [matchData, setMatchData] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('all');

  const [isStruggleModalOpen, setIsStruggleModalOpen] = useState(false);
  const [initialTopicName, setInitialTopicName] = useState('');

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isFriendsDrawerOpen, setIsFriendsDrawerOpen] = useState(false);

  const [safetyModalState, setSafetyModalState] = useState({
    isOpen: false,
    mode: 'unmatch',
    matchData: null,
  });

  const [toastMessage, setToastMessage] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [userStatus, setUserStatusState] = useState('online');
  const [isManualStatus, setIsManualStatus] = useState(false);

  const handleUpdateStatus = (newStatus, isManual = true) => {
    setUserStatusState(newStatus);
    setIsManualStatus(isManual);
    soundFX.setUserStatus(newStatus);
    if (currentUser?.id) {
      setCurrentUser((prev) => (prev ? { ...prev, status: newStatus } : prev));
      updateUserStatus(currentUser.id, newStatus).catch(() => {});
    }
  };

  // Global Inactivity Listener (5 minutes = 300,000ms Auto-AFK)
  useEffect(() => {
    let timeoutId = null;

    const resetIdleTimer = () => {
      setUserStatusState((currentStatus) => {
        if (currentStatus === 'away' && !isManualStatus) {
          soundFX.setUserStatus('online');
          return 'online';
        }
        return currentStatus;
      });

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        setUserStatusState((currentStatus) => {
          if (!isManualStatus && currentStatus !== 'dnd' && currentStatus !== 'invisible') {
            soundFX.setUserStatus('away');
            return 'away';
          }
          return currentStatus;
        });
      }, 300000); // 5 minutes
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [isManualStatus]);

  const showToast = (text) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Re-check for active sessions on app load / user change
  useEffect(() => {
    if (currentUser?.id) {
      getActiveSession(currentUser.id).then((sessionInfo) => {
        if (sessionInfo.has_active_session) {
          setMatchData(sessionInfo);
          setCurrentView('scratchpad');
        }
      });
    }
  }, [currentUser?.id]);

  const handleOpenStruggleModal = (topicName = '') => {
    soundFX.playSoftClick();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setInitialTopicName(topicName);
    setIsStruggleModalOpen(true);
  };

  const handleStruggleSubmitted = (user, topic) => {
    soundFX.playSoftClick();
    setCurrentUser(user);
    setClassifiedTopic(topic);
    setCurrentView('match');
  };

  const handleMatchFound = (data) => {
    setMatchData(data);
  };

  const handleGoToScratchpad = (data) => {
    soundFX.playSoftClick();
    setMatchData(data);
    setCurrentView('scratchpad');
  };

  const handleRejoinSessionFromHistory = (session) => {
    soundFX.playSoftClick();
    setMatchData({
      session_id: session.id,
      partner_name: session.partner_name,
      partner_id: session.partner_id,
      partner_avatar: session.partner_avatar,
      shared_topic: session.shared_topic,
      explanation: session.explanation,
      is_active: session.is_active,
    });
    setCurrentView('scratchpad');
    showToast(`${session.is_active ? 'Rejoined' : 'Viewing archived'} session with ${session.partner_name}`);
  };

  const handleStartDirectSession = (directMatchRes) => {
    soundFX.playSoftClick();
    setMatchData(directMatchRes);
    setCurrentView('scratchpad');
    showToast(`Started direct 1-on-1 study session with ${directMatchRes.partner_name}`);
  };

  const handleOpenSafetyModal = (mode, targetMatchData = matchData) => {
    soundFX.playSoftClick();
    setSafetyModalState({
      isOpen: true,
      mode,
      matchData: targetMatchData,
    });
  };

  const handleSafetyActionSuccess = (actionType, text) => {
    showToast(text);
    if (actionType === 'unmatch' || actionType === 'block') {
      setMatchData(null);
      setCurrentView('explore');
    }
  };

  const handleAuthSuccess = (user) => {
    soundFX.playSoftClick();
    setCurrentUser(user);
    setSavedUser(user);
    showToast(`Signed in as ${user.name}`);
  };

  const handleLoggedOut = () => {
    soundFX.playSoftClick();
    setCurrentUser(null);
    clearSavedUser();
    setMatchData(null);
    setCurrentView('explore');
    showToast('Signed out of StudyMatch');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        currentUser={currentUser}
        userStatus={userStatus}
        unreadCount={unreadCount}
        currentView={currentView}
        onOpenStruggleModal={() => handleOpenStruggleModal('')}
        onGoHome={() => {
          soundFX.playSoftClick();
          setCurrentView('explore');
        }}
        onGoQuestionsBoard={() => {
          soundFX.playSoftClick();
          setCurrentView('questions');
        }}
        onOpenProfileDrawer={() => {
          soundFX.playSoftClick();
          setIsProfileDrawerOpen(true);
        }}
        onOpenAuthModal={() => {
          soundFX.playSoftClick();
          setIsAuthModalOpen(true);
        }}
        onOpenFriendsDrawer={() => {
          soundFX.playSoftClick();
          setIsFriendsDrawerOpen(true);
        }}
        selectedCourse={selectedCourse}
        onSelectCourse={(course) => {
          soundFX.playSoftClick();
          setSelectedCourse(course);
          showToast(`Switched course catalog to ${course.toUpperCase()}`);
        }}
      />

      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            background: 'var(--color-surface)',
            border: 'var(--border-thick)',
            boxShadow: 'var(--shadow-hard-md)',
            borderRadius: 'var(--radius-md)',
            padding: '0.8rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '0.9rem',
            zIndex: 2000,
            animation: 'stampIn 0.25s ease forwards',
          }}
        >
          <CheckCircle2 size={18} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="app-container">
        {currentView === 'explore' && (
          <TopicExploreBoard
            onSelectTopicStruggle={(topicName) => handleOpenStruggleModal(topicName)}
            selectedCourse={selectedCourse}
            onGoToScratchpad={handleGoToScratchpad}
            currentUser={currentUser}
          />
        )}

        {currentView === 'questions' && (
          <QuestionBoardScreen
            currentUser={currentUser}
            onGoToScratchpad={handleGoToScratchpad}
            onOpenStruggleModal={handleOpenStruggleModal}
            selectedCourse={selectedCourse}
          />
        )}

        {currentView === 'match' && currentUser && (
          <MatchRevealScreen
            currentUser={currentUser}
            topicName={classifiedTopic}
            onMatchFound={handleMatchFound}
            onGoToScratchpad={handleGoToScratchpad}
            onBackToExplore={() => {
              soundFX.playSoftClick();
              setCurrentView('explore');
            }}
            onGoToQuestionBoard={() => {
              soundFX.playSoftClick();
              setCurrentView('questions');
              showToast('Saved question to Question Board!');
            }}
            onOpenSafetyModal={handleOpenSafetyModal}
          />
        )}

        {currentView === 'scratchpad' && currentUser && matchData && (
          <ScratchpadScreen
            currentUser={currentUser}
            matchData={matchData}
            onBack={() => {
              soundFX.playSoftClick();
              setCurrentView('explore');
            }}
            onGoToQuestionBoard={() => {
              soundFX.playSoftClick();
              setCurrentView('questions');
              showToast('Question posted to Question Board for extra classmate help!');
            }}
            onOpenSafetyModal={handleOpenSafetyModal}
          />
        )}
      </main>

      <StruggleInputModal
        isOpen={isStruggleModalOpen}
        onClose={() => setIsStruggleModalOpen(false)}
        currentUser={currentUser}
        initialTopicName={initialTopicName}
        onStruggleSubmitted={handleStruggleSubmitted}
        onOpenAuthModal={() => { setIsStruggleModalOpen(false); setIsAuthModalOpen(true); }}
        onGoToQuestionBoard={() => {
          soundFX.playSoftClick();
          setCurrentView('questions');
          showToast('Question pinned to Question Board!');
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        currentUser={currentUser}
        userStatus={userStatus}
        onUpdateStatus={handleUpdateStatus}
        onProfileUpdated={(updated) => { setCurrentUser(updated); showToast('Profile updated'); }}
        onLoggedOut={handleLoggedOut}
        onOpenSessionHistory={() => setIsHistoryModalOpen(true)}
      />

      <SessionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        currentUser={currentUser}
        onRejoinSession={handleRejoinSessionFromHistory}
      />

      <FriendsDrawer
        isOpen={isFriendsDrawerOpen}
        onClose={() => setIsFriendsDrawerOpen(false)}
        currentUser={currentUser}
        onUnreadCountChange={setUnreadCount}
        onRequestStudySession={(friend) => handleOpenStruggleModal(friend.name)}
        onStartDirectSession={handleStartDirectSession}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <SafetyModal
        isOpen={safetyModalState.isOpen}
        mode={safetyModalState.mode}
        onClose={() => setSafetyModalState({ isOpen: false, mode: 'unmatch', matchData: null })}
        currentUser={currentUser}
        matchData={safetyModalState.matchData}
        onActionSuccess={handleSafetyActionSuccess}
      />
    </div>
  );
}
