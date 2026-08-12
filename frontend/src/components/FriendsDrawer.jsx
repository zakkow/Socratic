import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserPlus,
  Users,
  Search,
  MoreVertical,
  MessageSquare,
  Clock,
  Send,
  Edit2,
  Trash2,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Check,
  Calendar,
  UserX,
  UserCheck
} from 'lucide-react';
import {
  getFriendsList,
  sendFriendRequest,
  getRecentPartners,
  getFriendRequests,
  respondFriendRequest,
  getDmMessages,
  sendDmMessage,
  editDmMessage,
  deleteDmMessage,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser
} from '../api';
import { AvatarIcon } from './AvatarIcon';
import { StatusBadge } from './StatusBadge';
import { soundFX } from '../utils/soundFX';

export function FriendsDrawer({
  isOpen,
  onClose,
  currentUser,
  onUnreadCountChange,
  onRequestStudySession,
  onStartDirectSession,
  onOpenAuthModal
}) {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'recent' | 'blocked' | 'requests' | 'dm'
  const [friends, setFriends] = useState([]);
  const [recentPartners, setRecentPartners] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [searchQuery, setSearchQuery] = useState('');

  // Add friend by email state
  const [targetEmail, setTargetEmail] = useState('');
  const [isSendingReq, setIsSendingReq] = useState(false);

  // Active DM Chat State
  const [selectedDmFriend, setSelectedDmFriend] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInputText, setDmInputText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editMsgText, setEditMsgText] = useState('');

  // Active Kebab Menu State
  const [openKebabId, setOpenKebabId] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const chatEndRef = useRef(null);

  const fetchAllSocialData = async () => {
    if (!currentUser?.id) {
      setFriends([]);
      setRecentPartners([]);
      setFriendRequests({ incoming: [], outgoing: [] });
      setBlockedUsers([]);
      setIsLoading(false);
      return;
    }
    const userId = currentUser.id;
    try {
      const [friendsData, recentData, reqsData, blockedData] = await Promise.all([
        getFriendsList(userId),
        getRecentPartners(userId),
        getFriendRequests(userId),
        getBlockedUsers(userId),
      ]);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setRecentPartners(Array.isArray(recentData) ? recentData : []);
      setFriendRequests(reqsData || { incoming: [], outgoing: [] });
      setBlockedUsers(Array.isArray(blockedData) ? blockedData : []);

      const incCount = Array.isArray(reqsData?.incoming) ? reqsData.incoming.length : 0;
      if (onUnreadCountChange) {
        onUnreadCountChange(incCount);
      }
    } catch {
      // Fallback defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      fetchAllSocialData();
    }
  }, [isOpen, currentUser?.id]);

  // Fetch DM messages when selecting DM friend
  useEffect(() => {
    if (!currentUser?.id) return;
    const userId = currentUser.id;
    if (selectedDmFriend) {
      const fetchDM = async () => {
        try {
          const msgs = await getDmMessages(userId, selectedDmFriend.id);
          setDmMessages(Array.isArray(msgs) ? msgs : []);
        } catch {
          setDmMessages([]);
        }
      };
      fetchDM();
      const interval = setInterval(fetchDM, 2500);
      return () => clearInterval(interval);
    }
  }, [selectedDmFriend, currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'dm' && selectedDmFriend) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dmMessages.length, activeTab, selectedDmFriend]);

  if (!isOpen) return null;

  if (!currentUser) {
    return (
      <div className="modal-overlay" onClick={onClose} style={{ justifyContent: 'flex-end', padding: 0 }}>
        <div className="drawer-card" onClick={(e) => e.stopPropagation()} style={{ width: '440px', maxWidth: '100vw', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <Users size={48} style={{ color: 'var(--color-primary-deep)', marginBottom: '1rem' }} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            Sign In Required
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Sign in with your school .edu email to connect with classmates, chat with friends, and view your study history.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Close</button>
            <button className="btn-primary" onClick={() => { onClose(); if (onOpenAuthModal) onOpenAuthModal(); }} style={{ flex: 1 }}>Sign In / Up</button>
          </div>
        </div>
      </div>
    );
  }

  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeRecentPartners = Array.isArray(recentPartners) ? recentPartners : [];
  const incomingReqs = Array.isArray(friendRequests?.incoming) ? friendRequests.incoming : [];
  const blockedIdsSet = new Set(blockedUsers.map(b => str(b.id)));

  function str(val) {
    return val ? String(val) : '';
  }

  const handleSendFriendReq = async (e) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;
    soundFX.playSoftClick();
    setIsSendingReq(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await sendFriendRequest(currentUser.id, targetEmail.trim());
      soundFX.playNotification();
      setSuccessMessage(res.message || `Friend request sent to ${targetEmail.trim()}`);
      setTargetEmail('');
      fetchAllSocialData();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsSendingReq(false);
    }
  };

  const handleRespondFreq = async (reqId, action) => {
    soundFX.playSoftClick();
    try {
      const res = await respondFriendRequest(reqId, currentUser.id, action);
      if (action === 'accept') {
        soundFX.playSuccess();
      }
      setSuccessMessage(res.message);
      fetchAllSocialData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleSendDM = async (e) => {
    e.preventDefault();
    if (!dmInputText.trim() || !selectedDmFriend) return;
    soundFX.playSoftClick();

    const text = dmInputText.trim();
    setDmInputText('');
    try {
      const newMsg = await sendDmMessage(currentUser.id, selectedDmFriend.id, currentUser.name, currentUser.avatar_seed || 'bottts-1', text);
      soundFX.playNotification();
      setDmMessages((prev) => [...prev, newMsg]);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleSaveEditMsg = async (msgId) => {
    if (!editMsgText.trim()) return;
    soundFX.playSoftClick();
    try {
      await editDmMessage(msgId, editMsgText.trim());
      setDmMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: editMsgText.trim(), is_edited: true } : m))
      );
      setEditingMsgId(null);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleDeleteMsg = async (msgId) => {
    soundFX.playSoftClick();
    try {
      await deleteDmMessage(msgId);
      setDmMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, text: 'This message was deleted.', is_deleted: true } : m))
      );
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleBlockUser = async (targetId) => {
    soundFX.playSoftClick();
    setOpenKebabId(null);
    try {
      await blockUser(currentUser.id, targetId);
      soundFX.playNotification();
      setSuccessMessage('User blocked.');
      fetchAllSocialData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleUnblockUser = async (targetId) => {
    soundFX.playSoftClick();
    setOpenKebabId(null);
    try {
      await unblockUser(currentUser.id, targetId);
      soundFX.playSuccess();
      setSuccessMessage('User unblocked.');
      fetchAllSocialData();
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleReportUser = async (targetId) => {
    soundFX.playSoftClick();
    setOpenKebabId(null);
    try {
      await reportUser(currentUser.id, targetId, 'Inappropriate Conduct', 'Reported via drawer');
      soundFX.playNotification();
      setSuccessMessage('Report submitted to moderators.');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.school_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose} style={{ justifyContent: 'flex-end', padding: 0 }}>
      <div className="drawer-card" onClick={(e) => e.stopPropagation()} style={{ width: '440px', maxWidth: '100vw' }}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: 'var(--border-thick)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Social & Peer Network</h3>
            </div>
            <button className="btn-secondary" onClick={onClose} style={{ padding: '0.3rem 0.5rem' }}>
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="category-pills" style={{ marginBottom: '1rem' }}>
            <button
              className={`category-pill ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => { soundFX.playSoftClick(); setActiveTab('friends'); }}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
            >
              Friends
            </button>
            <button
              className={`category-pill ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => { soundFX.playSoftClick(); setActiveTab('recent'); }}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
            >
              Recent
            </button>
            <button
              className={`category-pill ${activeTab === 'blocked' ? 'active' : ''}`}
              onClick={() => { soundFX.playSoftClick(); setActiveTab('blocked'); }}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
            >
              Blocked ({blockedUsers.length})
            </button>
            <button
              className={`category-pill ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => { soundFX.playSoftClick(); setActiveTab('requests'); }}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', position: 'relative' }}
            >
              Requests
              {incomingReqs.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--color-error)', color: '#FFF', fontSize: '0.65rem', borderRadius: '50%', width: '15px', height: '15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {incomingReqs.length}
                </span>
              )}
            </button>
            <button
              className={`category-pill ${activeTab === 'dm' ? 'active' : ''}`}
              onClick={() => { soundFX.playSoftClick(); setActiveTab('dm'); }}
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
            >
              Direct Chat
            </button>
          </div>

          {errorMessage && (
            <div className="error-banner" style={{ marginBottom: '0.75rem' }}>
              <AlertCircle size={15} strokeWidth={2.5} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div style={{ background: 'var(--color-light-sage)', border: 'var(--border-thick)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700 }}>
              <CheckCircle2 size={15} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: ACTIVE FRIENDS */}
          {activeTab === 'friends' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                <Search size={15} strokeWidth={2.5} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                <input
                  className="form-input"
                  placeholder="Search existing friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.2rem', fontSize: '0.82rem', padding: '0.45rem 0.75rem 0.45rem 2.2rem' }}
                />
              </div>

              {/* Friends Count Label Below Search Bar */}
              <div style={{ fontSize: '0.72rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-muted)', marginBottom: '0.65rem', paddingLeft: '0.2rem', textTransform: 'uppercase' }}>
                Active Friends ({safeFriends.length})
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {filteredFriends.length === 0 ? (
                  <div style={{ background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1.25rem', textAlign: 'center' }}>
                    <Users size={28} style={{ color: 'var(--color-muted)', margin: '0 auto 0.4rem auto' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>No Active Friends Found</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                      Send friend requests or add partners from your recent study sessions!
                    </div>
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      style={{
                        background: 'var(--color-surface)',
                        border: 'var(--border-thick)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                          <AvatarIcon seed={friend.avatar_seed || 'bottts-1'} size={38} />
                          <div style={{ position: 'absolute', bottom: '-2px', right: '-2px' }}>
                            <StatusBadge status={friend.status || 'online'} size={14} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-heading)' }}>{friend.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{friend.school_name || 'Stanford University'}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          className="btn-primary"
                          onClick={() => {
                            soundFX.playSoftClick();
                            onRequestStudySession(friend);
                            onClose();
                          }}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          title="Request 1-on-1 Study Session"
                        >
                          <Sparkles size={13} strokeWidth={2.5} />
                          <span>Request Study</span>
                        </button>

                        <button
                          className="btn-secondary"
                          onClick={() => {
                            soundFX.playSoftClick();
                            setSelectedDmFriend(friend);
                            setActiveTab('dm');
                          }}
                          style={{ padding: '0.3rem 0.45rem', fontSize: '0.75rem' }}
                          title="Open Direct Message Chat"
                        >
                          <MessageSquare size={13} strokeWidth={2.5} />
                        </button>

                        {/* Kebab Dropdown Menu */}
                        <div style={{ position: 'relative' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              soundFX.playSoftClick();
                              setOpenKebabId(openKebabId === friend.id ? null : friend.id);
                            }}
                            style={{ padding: '0.3rem 0.4rem' }}
                          >
                            <MoreVertical size={14} strokeWidth={2.5} />
                          </button>

                          {openKebabId === friend.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                zIndex: 100,
                                background: 'var(--color-surface)',
                                border: 'var(--border-thick)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-hard-md)',
                                width: '160px',
                                overflow: 'hidden',
                              }}
                            >
                              <button
                                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                                onClick={() => {
                                  onRequestStudySession(friend);
                                  onClose();
                                }}
                              >
                                Request Study Session
                              </button>
                              <button
                                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                                onClick={() => {
                                  setSelectedDmFriend(friend);
                                  setActiveTab('dm');
                                }}
                              >
                                Open Chat
                              </button>
                              <button
                                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-error)' }}
                                onClick={() => handleBlockUser(friend.id)}
                              >
                                Block User
                              </button>
                              <button
                                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-error)' }}
                                onClick={() => handleReportUser(friend.id)}
                              >
                                Report User
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RECENT PARTNERS (WITH KEBAB MENU & UNBLOCK SUPPORT) */}
          {activeTab === 'recent' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.35rem' }}>
                Classmates you matched with in the last 30 days (FIFO rolling history):
              </div>
              {recentPartners.map((partner) => {
                const isBlocked = blockedIdsSet.has(str(partner.id));
                return (
                  <div
                    key={partner.id}
                    style={{
                      background: 'var(--color-surface)',
                      border: 'var(--border-thick)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <AvatarIcon seed={partner.avatar_seed || 'bottts-8'} size={36} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>{partner.name}</span>
                          {isBlocked && (
                            <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                              Blocked
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{partner.school} • Matched {partner.matched_at}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {!isBlocked && (
                        <button
                          className="btn-primary"
                          onClick={async () => {
                            soundFX.playSoftClick();
                            try {
                              await sendFriendRequest(currentUser.id, partner.name);
                              soundFX.playNotification();
                              setSuccessMessage(`Friend request sent to ${partner.name}!`);
                            } catch (err) {
                              setErrorMessage(err.message);
                            }
                          }}
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          <UserPlus size={13} strokeWidth={2.5} />
                          <span>Add Friend</span>
                        </button>
                      )}

                      {/* Three-Dots Kebab Menu for Recent Partners */}
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            soundFX.playSoftClick();
                            setOpenKebabId(openKebabId === partner.id ? null : partner.id);
                          }}
                          style={{ padding: '0.3rem 0.4rem' }}
                        >
                          <MoreVertical size={14} strokeWidth={2.5} />
                        </button>

                        {openKebabId === partner.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              zIndex: 100,
                              background: 'var(--color-surface)',
                              border: 'var(--border-thick)',
                              borderRadius: 'var(--radius-md)',
                              boxShadow: 'var(--shadow-hard-md)',
                              width: '165px',
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                              onClick={() => {
                                onRequestStudySession({ id: partner.id, name: partner.name });
                                onClose();
                              }}
                            >
                              Request Study Session
                            </button>

                            {isBlocked ? (
                              <button
                                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-primary-deep)' }}
                                onClick={() => handleUnblockUser(partner.id)}
                              >
                                Unblock User
                              </button>
                            ) : (
                              <button
                                style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-error)' }}
                                onClick={() => handleBlockUser(partner.id)}
                              >
                                Block User
                              </button>
                            )}

                            <button
                              style={{ width: '100%', padding: '0.5rem 0.75rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-error)' }}
                              onClick={() => handleReportUser(partner.id)}
                            >
                              Report User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: BLOCKED USERS MANAGEMENT */}
          {activeTab === 'blocked' && (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.35rem' }}>
                Classmates you have blocked. Blocked users cannot send you messages or friend requests:
              </div>
              {blockedUsers.length === 0 ? (
                <div style={{ background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1.25rem', textAlign: 'center' }}>
                  <UserX size={28} style={{ color: 'var(--color-muted)', margin: '0 auto 0.4rem auto' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>No Blocked Users</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
                    You have not blocked any classmates.
                  </div>
                </div>
              ) : (
                blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      background: 'var(--color-surface)',
                      border: 'var(--border-thick)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <AvatarIcon seed={user.avatar_seed || 'bottts-1'} size={36} />
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-heading)' }}>{user.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{user.school || 'University'}</div>
                      </div>
                    </div>

                    <button
                      className="btn-secondary"
                      onClick={() => handleUnblockUser(user.id)}
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: 'var(--color-primary-deep)' }}
                    >
                      <UserCheck size={13} strokeWidth={2.5} />
                      <span>Unblock</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: FRIEND REQUESTS */}
          {activeTab === 'requests' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Send Request Form */}
              <form onSubmit={handleSendFriendReq} style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Send Friend Request (.edu Email)</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="classmate@university.edu"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
                  />
                  <button type="submit" className="btn-primary" disabled={isSendingReq || !targetEmail.trim()} style={{ padding: '0.45rem 0.75rem' }}>
                    <UserPlus size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </form>

              {/* Incoming Requests */}
              <h5 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                Incoming Requests ({incomingReqs.length})
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {incomingReqs.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>No pending incoming requests.</div>
                ) : (
                  incomingReqs.map((req) => (
                    <div key={req.id} style={{ background: 'var(--color-bg)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AvatarIcon seed={req.sender_avatar} size={32} />
                        <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{req.sender_name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="btn-primary" onClick={() => handleRespondFreq(req.id, 'accept')} style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}>
                          Accept
                        </button>
                        <button className="btn-secondary" onClick={() => handleRespondFreq(req.id, 'decline')} style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem' }}>
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DIRECT MESSAGES (DISCORD STYLE CHAT) */}
          {activeTab === 'dm' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {!selectedDmFriend ? (
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.75rem' }}>
                    Select a friend to open direct chat messages:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {friends.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => setSelectedDmFriend(f)}
                        style={{
                          background: 'var(--color-surface)',
                          border: 'var(--border-thick)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          cursor: 'pointer',
                        }}
                      >
                        <AvatarIcon seed={f.avatar_seed || 'bottts-1'} size={34} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{f.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>Click to chat directly</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Selected DM Friend Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', border: 'var(--border-thick)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AvatarIcon seed={selectedDmFriend.avatar_seed || 'bottts-1'} size={28} />
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', fontFamily: 'var(--font-heading)' }}>{selectedDmFriend.name}</span>
                    </div>
                    <button className="btn-secondary" onClick={() => setSelectedDmFriend(null)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}>
                      Switch Friend
                    </button>
                  </div>

                  {/* Messages Feed */}
                  <div style={{ flex: 1, minHeight: '260px', maxHeight: '42vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.75rem', paddingRight: '0.2rem' }}>
                    {dmMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.78rem', marginTop: '2rem' }}>
                        No direct messages yet. Type a message below to start chatting!
                      </div>
                    ) : (
                      dmMessages.map((msg) => (
                        <div
                          key={msg.id}
                          style={{
                            background: msg.sender_id === currentUser.id ? 'var(--color-light-sage)' : 'var(--color-bg)',
                            border: '1.5px solid var(--color-ink)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.65rem 0.85rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <AvatarIcon seed={msg.sender_avatar || 'bottts-1'} size={20} />
                              <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>{msg.sender_name}</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>{msg.timestamp}</span>
                            </div>

                            {msg.sender_id === currentUser.id && !msg.is_deleted && (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem' }}>
                                  <Edit2 size={12} strokeWidth={2.5} />
                                </button>
                                <button onClick={() => handleDeleteMsg(msg.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', color: 'var(--color-error)' }}>
                                  <Trash2 size={12} strokeWidth={2.5} />
                                </button>
                              </div>
                            )}
                          </div>

                          {editingMsgId === msg.id ? (
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                              <input className="form-input" value={editMsgText} onChange={(e) => setEditMsgText(e.target.value)} style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }} />
                              <button className="btn-primary" onClick={() => handleSaveEditMsg(msg.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}>Save</button>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.82rem', lineHeight: '1.4', color: msg.is_deleted ? 'var(--color-muted)' : 'var(--color-ink)', fontStyle: msg.is_deleted ? 'italic' : 'normal' }}>
                              {msg.text}
                              {msg.is_edited && !msg.is_deleted && <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)', marginLeft: '0.35rem' }}>(edited)</span>}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Send Input */}
                  <form onSubmit={handleSendDM} style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      className="form-input"
                      placeholder={`Message ${selectedDmFriend.name}...`}
                      value={dmInputText}
                      onChange={(e) => setDmInputText(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
                    />
                    <button type="submit" className="btn-primary" disabled={!dmInputText.trim()} style={{ padding: '0.5rem 0.85rem' }}>
                      <Send size={15} strokeWidth={2.5} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
