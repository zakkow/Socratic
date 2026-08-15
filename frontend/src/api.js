const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' && window.location.port === '5173'
    ? '' 
    : 'http://localhost:8000');

const DEFAULT_COURSE_ID = 'cs101';
const USER_STORAGE_KEY = 'socratic_user';

export function getSavedUser() {
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem('studymatch_user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setSavedUser(user) {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSavedUser() {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore storage clear errors
  }
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return { detail: `Server error (${response.status}). Please try again.` };
  }
}

export async function signupUser(name, email, password, avatarSeed = 'bottts-1') {
  const response = await fetch(`${API_BASE_URL}/users/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      email,
      password,
      course_id: DEFAULT_COURSE_ID,
      avatar_seed: avatarSeed,
    }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Sign up failed. Ensure you are using a valid .edu email.');
  }

  if (data.verified) {
    setSavedUser(data);
  }
  return data;
}

export async function verifyEmailPin(userId, pin) {
  const response = await fetch(`${API_BASE_URL}/users/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, pin }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Invalid 6-digit verification PIN.');
  }

  setSavedUser(data);
  return data;
}

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Invalid .edu email or password.');
  }

  setSavedUser(data);
  return data;
}

export async function createUser(name) {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, course_id: DEFAULT_COURSE_ID }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to create student profile.');
  }

  setSavedUser(data);
  return data;
}

export async function updateProfile(userId, name, avatarSeed, schoolName) {
  const response = await fetch(`${API_BASE_URL}/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      name,
      avatar_seed: avatarSeed,
      school_name: schoolName,
    }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update profile.');
  }

  setSavedUser(data);
  return data;
}

export async function deleteAccount(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete account.');
  }

  clearSavedUser();
  return safeParseJson(response);
}

export async function getUserSessions(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/sessions`);
  if (!response.ok) {
    throw new Error('Failed to fetch session history.');
  }
  return safeParseJson(response);
}

export async function getFriendsList(userId) {
  const response = await fetch(`${API_BASE_URL}/friends/${userId}`);
  if (!response.ok) {
    return [];
  }
  return safeParseJson(response);
}

export async function sendFriendRequest(userId, targetEmailOrName) {
  const response = await fetch(`${API_BASE_URL}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, friend_email_or_name: targetEmailOrName }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to send friend request.');
  }
  return data;
}

export async function startDirectMatch(userId, friendId, topicName = 'General Study Session') {
  const response = await fetch(`${API_BASE_URL}/match/direct-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, friend_id: friendId, topic_name: topicName }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to start direct study session.');
  }
  return data;
}

export async function startAiMatchSession(userId, topicName) {
  const response = await fetch(`${API_BASE_URL}/match/ai-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, topic_name: topicName }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to launch AI Peer session.');
  }
  return data;
}

export async function getPinnedQuestions(userId = '') {
  const url = userId
    ? `${API_BASE_URL}/questions/pinned?user_id=${encodeURIComponent(userId)}`
    : `${API_BASE_URL}/questions/pinned`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return safeParseJson(response);
}

export async function pinQuestionToBoard(userId, topicName, struggleText) {
  const response = await fetch(`${API_BASE_URL}/questions/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, topic_name: topicName, struggle_text: struggleText }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to pin struggle to question board.');
  }
  return data;
}

export async function updatePinnedQuestion(questionId, topicName, struggleText) {
  const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic_name: topicName, struggle_text: struggleText }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to update question.');
  }
  return data;
}

export async function deletePinnedQuestion(questionId) {
  const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
    method: 'DELETE',
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to delete question.');
  }
  return data;
}

export async function getActiveSession(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/active-session`);
  if (!response.ok) {
    return { has_active_session: false };
  }
  return safeParseJson(response);
}

export async function getTopics(courseId = DEFAULT_COURSE_ID, category = 'All') {
  const url = `${API_BASE_URL}/topics?course_id=${encodeURIComponent(courseId)}&category=${encodeURIComponent(category)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load topic catalog.');
  }
  return safeParseJson(response);
}

export async function submitQuizAttempt(userId, freeText, isCorrect, proficiencyLevel = 5, preConfidence = 3) {
  const response = await fetch(`${API_BASE_URL}/quiz/attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      free_text: freeText,
      correct: isCorrect,
      proficiency_level: proficiencyLevel,
      pre_confidence: preConfidence,
    }),
  });

  if (response.status === 422) {
    throw new Error("We couldn't figure out the topic from your description. Try rephrasing what you're working on!");
  }

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Could not submit struggle entry.');
  }

  return data;
}

export async function requestMatch(userId, topicName = '') {
  const response = await fetch(`${API_BASE_URL}/match/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, topic_name: topicName, allow_demo_peer: true }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to request a peer match.');
  }

  return data;
}

export async function getScratchpadContent(sessionId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/scratchpad`);

  if (!response.ok) {
    throw new Error('Unable to sync scratchpad content.');
  }

  return safeParseJson(response);
}

export async function saveScratchpadContent(sessionId, content) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/scratchpad`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error('Failed to save scratchpad updates.');
  }

  return data;
}

export async function getCanvasContent(sessionId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/canvas`);
  if (!response.ok) {
    throw new Error('Unable to sync whiteboard canvas.');
  }
  return safeParseJson(response);
}

export async function saveCanvasContent(sessionId, content) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/canvas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error('Failed to save canvas updates.');
  }
  return data;
}

export async function getSessionAiLog(sessionId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/ai-log`);
  if (!response.ok) {
    return { ai_log: '' };
  }
  return safeParseJson(response);
}

export async function generateSessionAiLog(sessionId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/ai-log/generate`, {
    method: 'POST',
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to generate Session AI Log.');
  }
  return data;
}

export async function getSocraticHint(sessionId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/socratic-hint`, {
    method: 'POST',
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to generate Socratic hint.');
  }
  return data;
}

export async function rateSessionConfidence(sessionId, userId, postConfidence) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/rate-confidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, post_confidence: postConfidence }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to rate session confidence.');
  }
  return data;
}

export async function getChatMessages(sessionId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/messages`);
  if (!response.ok) {
    return [];
  }
  return safeParseJson(response);
}

export async function sendChatMessage(sessionId, senderId, text) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: senderId, text }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Message sending failed.');
  }
  return data;
}

export async function unmatchSession(sessionId, userId) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/unmatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to end match session.');
  }

  return data;
}

export async function updateUserStatus(userId, status) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, status }),
  });
  return safeParseJson(response);
}

export async function getUserStatus(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/status`);
  if (!response.ok) return { status: 'online' };
  return safeParseJson(response);
}

export async function getRecentPartners(userId) {
  const response = await fetch(`${API_BASE_URL}/recent-partners/${userId}`);
  if (!response.ok) return [];
  return safeParseJson(response);
}

export async function getFriendRequests(userId) {
  const response = await fetch(`${API_BASE_URL}/friend-requests/${userId}`);
  if (!response.ok) return { incoming: [], outgoing: [] };
  return safeParseJson(response);
}

export async function respondFriendRequest(requestId, userId, action) {
  const response = await fetch(`${API_BASE_URL}/friend-requests/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_id: requestId, user_id: userId, action }),
  });
  return safeParseJson(response);
}

export async function getDmMessages(userId, friendId) {
  const response = await fetch(`${API_BASE_URL}/dm/${userId}/${friendId}/messages`);
  if (!response.ok) return [];
  return safeParseJson(response);
}

export async function sendDmMessage(userId, friendId, senderName, senderAvatar, text) {
  const response = await fetch(`${API_BASE_URL}/dm/${userId}/${friendId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: userId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: friendId,
      text,
    }),
  });
  return safeParseJson(response);
}

export async function editDmMessage(msgId, text) {
  const response = await fetch(`${API_BASE_URL}/dm/messages/${msgId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return safeParseJson(response);
}

export async function deleteDmMessage(msgId) {
  const response = await fetch(`${API_BASE_URL}/dm/messages/${msgId}`, {
    method: 'DELETE',
  });
  return safeParseJson(response);
}

export async function createStudyRequest(senderId, senderName, senderAvatar, receiverId, topicName, struggleText, proficiencyLevel = 5, preConfidence = 3) {
  const response = await fetch(`${API_BASE_URL}/study-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: senderId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: receiverId,
      topic_name: topicName,
      struggle_text: struggleText,
      proficiency_level: proficiencyLevel,
      pre_confidence: preConfidence,
    }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to create study session request.');
  }
  return data;
}

export async function getStudyRequests(userId) {
  const response = await fetch(`${API_BASE_URL}/study-requests/${userId}`);
  if (!response.ok) return [];
  return safeParseJson(response);
}

export async function respondStudyRequest(requestId, action) {
  const response = await fetch(`${API_BASE_URL}/study-requests/${requestId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return safeParseJson(response);
}

export async function requestEmailChange(userId, newEmail) {
  const response = await fetch(`${API_BASE_URL}/users/request-email-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, new_email: newEmail }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to request email change code.');
  }
  return data;
}

export async function verifyEmailChange(userId, newEmail, pin) {
  const response = await fetch(`${API_BASE_URL}/users/verify-email-change`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, new_email: newEmail, pin }),
  });
  const data = await safeParseJson(response);
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to verify email PIN code.');
  }
  return data;
}

export async function resolvePinnedQuestion(questionId) {
  const response = await fetch(`${API_BASE_URL}/questions/${questionId}/resolve`, {
    method: 'PUT',
  });
  return safeParseJson(response);
}

export async function togglePublishConsent(sessionId, userId, consent = true) {
  const response = await fetch(`${API_BASE_URL}/match/${sessionId}/publish-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, consent }),
  });
  return safeParseJson(response);
}

export async function getPublicSolutionsForTopic(topicName) {
  const response = await fetch(`${API_BASE_URL}/topics/${encodeURIComponent(topicName)}/public-solutions`);
  if (!response.ok) return [];
  return safeParseJson(response);
}

export async function blockUser(blockerId, targetId) {
  const response = await fetch(`${API_BASE_URL}/users/block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocker_id: blockerId, target_id: targetId }),
  });
  return safeParseJson(response);
}

export async function unblockUser(blockerId, targetId) {
  const response = await fetch(`${API_BASE_URL}/users/unblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocker_id: blockerId, target_id: targetId }),
  });
  return safeParseJson(response);
}

export async function getBlockedUsers(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/blocked`);
  if (!response.ok) return [];
  return safeParseJson(response);
}

export async function reportUser(reporterId, targetId, reason = 'Inappropriate conduct', details = '') {
  const response = await fetch(`${API_BASE_URL}/users/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reporter_id: reporterId, target_id: targetId, reason, details }),
  });
  return safeParseJson(response);
}
