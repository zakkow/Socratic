import React, { useState, useEffect } from 'react';
import { Search, Flame, Sparkles, BookOpen, AlertCircle, RefreshCw, X, Globe, FileText, Tag, Eye, Clock, CheckCircle2 } from 'lucide-react';
import { getTopics, getPublicSolutionsForTopic } from '../api';
import { soundFX } from '../utils/soundFX';
import { CuteMathDecorations } from './CuteMathDecorations';
import { AvatarIcon } from './AvatarIcon';

const CATEGORY_MAP = [
  { id: 'All', label: 'All Topics' },
  { id: 'cs', label: 'Computer Science' },
  { id: 'math', label: 'Math & Calculus' },
  { id: 'eng', label: 'English & Literature' },
  { id: 'civ', label: 'Civics & Government' },
  { id: 'phys', label: 'Natural Sciences' },
];

export function TopicExploreBoard({ onSelectTopicStruggle, selectedCourse = 'cs101' }) {
  const [topics, setTopics] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [viewingPublicTopic, setViewingPublicTopic] = useState(null);
  const [publicSolutions, setPublicSolutions] = useState([]);
  const [isLoadingSolutions, setIsLoadingSolutions] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [selectedSolutionDetail, setSelectedSolutionDetail] = useState(null);

  const fetchTopics = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await getTopics(selectedCourse, activeCategory);
      setTopics(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMessage(err.message);
      setTopics([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, [selectedCourse, activeCategory]);

  const handleOpenPublicSolutions = async (topic, e) => {
    e.stopPropagation();
    soundFX.playSoftClick();
    setViewingPublicTopic(topic);
    setIsLoadingSolutions(true);
    setTagSearchQuery('');
    try {
      const data = await getPublicSolutionsForTopic(topic.name);
      setPublicSolutions(Array.isArray(data) ? data : []);
    } catch {
      setPublicSolutions([]);
    } finally {
      setIsLoadingSolutions(false);
    }
  };

  const getCourseNameDisplay = (courseId) => {
    switch (courseId) {
      case 'cs101': return 'Computer Science (CS101)';
      case 'math201': return 'Calculus & Math (MATH201)';
      case 'eng101': return 'English (ENG101)';
      case 'civ101': return 'Civics (CIV101)';
      case 'phys150': return 'Physics (PHYS150)';
      default: return 'All Registered Courses';
    }
  };

  const filteredTopics = topics.filter((t) => {
    if (!searchQuery) return true;
    return t.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const filteredSolutions = publicSolutions.filter((sol) => {
    if (!tagSearchQuery.trim()) return true;
    const cleanTag = tagSearchQuery.toLowerCase().trim();
    const matchesTag = sol.ai_tags?.some((t) => t.toLowerCase().includes(cleanTag));
    const matchesText = sol.scratchpad_content?.toLowerCase().includes(cleanTag);
    const matchesAuthor = sol.author_a_name?.toLowerCase().includes(cleanTag) || sol.author_b_name?.toLowerCase().includes(cleanTag);
    return matchesTag || matchesText || matchesAuthor;
  });

  return (
    <section className="explore-section">
      {/* Banner */}
      <div className="question-board-banner" style={{ textAlign: 'center' }}>
        <CuteMathDecorations />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.1rem', fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>
            What are you working on today?
          </h2>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary-deep)', maxWidth: '580px', margin: 0, lineHeight: '1.5' }}>
            Select a topic to match with a classmate, or describe your homework struggle for Socratic AI tutoring!
          </p>

          <button
            className="btn-primary"
            onClick={() => {
              soundFX.playSoftClick();
              onSelectTopicStruggle('');
            }}
            style={{ fontSize: '0.95rem', padding: '0.7rem 1.35rem', marginTop: '0.35rem' }}
          >
            <Sparkles size={18} strokeWidth={2.5} />
            <span>Post What You're Working On</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Category Filter Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '280px' }}>
            <Search className="search-input-icon" size={18} strokeWidth={2.5} />
            <input
              type="text"
              className="form-input search-input"
              placeholder={`Search topics in ${getCourseNameDisplay(selectedCourse)}...`}
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
            {CATEGORY_MAP.map((cat) => (
              <button
                key={cat.id}
                className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  soundFX.playSoftClick();
                  setActiveCategory(cat.id);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Topics Grid */}
      {errorMessage && (
        <div className="error-banner" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} strokeWidth={2.5} />
          <span>{errorMessage}</span>
          <button className="btn-secondary" onClick={fetchTopics} style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem' }}>
            <RefreshCw size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-muted)' }}>
            Loading course topic catalog...
          </p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div style={{ background: 'var(--color-surface)', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center', boxShadow: 'var(--shadow-hard-md)' }}>
          <BookOpen size={44} style={{ color: 'var(--color-muted)', margin: '0 auto 1rem auto' }} strokeWidth={2} />
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            No Topics Found
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', maxWidth: '460px', margin: '0 auto 1.25rem auto', lineHeight: '1.5' }}>
            {searchQuery
              ? `No existing topic matched "${searchQuery}" under ${getCourseNameDisplay(selectedCourse)}.`
              : `No topic cards are currently listed under ${getCourseNameDisplay(selectedCourse)}.`}
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              soundFX.playSoftClick();
              onSelectTopicStruggle(searchQuery);
            }}
          >
            <Sparkles size={16} strokeWidth={2.5} />
            <span>{searchQuery ? `Post Struggle for "${searchQuery}"` : "Post What You're Working On"}</span>
          </button>
        </div>
      ) : (
        <div className="topic-grid">
          {filteredTopics.map((topic) => (
            <div
              key={topic.id}
              className="topic-card"
              onClick={() => {
                soundFX.playSoftClick();
                onSelectTopicStruggle(topic.name);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="course-badge">{(topic.course_id || topic.category).toUpperCase()}</span>
                {topic.stuck_count > 0 && (
                  <div className="topic-stuck-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginLeft: '-2px' }}>
                      {['bottts-1', 'bottts-3', 'bottts-7'].slice(0, Math.min(topic.stuck_count, 3)).map((seed, idx) => (
                        <div key={idx} style={{ marginLeft: idx > 0 ? '-6px' : 0, borderRadius: '50%', border: '1.5px solid var(--color-ink)', overflow: 'hidden', background: '#FFF', display: 'flex' }}>
                          <AvatarIcon seed={seed} size={15} />
                        </div>
                      ))}
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>{topic.stuck_count} Active</span>
                  </div>
                )}
              </div>

              <h3 className="topic-title">{topic.name}</h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={(e) => handleOpenPublicSolutions(topic, e)}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.74rem', gap: '0.3rem' }}
                  title="View AI-vetted community solution history for this topic"
                >
                  <Globe size={13} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                  <span>Public History</span>
                </button>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-primary-deep)' }}>
                  Find Peer →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Public Community Solutions History Modal */}
      {viewingPublicTopic && (
        <div className="modal-overlay" onClick={() => setViewingPublicTopic(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe size={20} strokeWidth={2.5} style={{ color: 'var(--color-primary-deep)' }} />
                  Community Solution History
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-muted)', fontWeight: 700 }}>
                  Topic: <strong>{viewingPublicTopic.name}</strong> (AI Quality Vetted)
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setViewingPublicTopic(null)} style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="search-input-wrapper" style={{ marginBottom: '1.25rem' }}>
              <Tag className="search-input-icon" size={16} strokeWidth={2.5} />
              <input
                type="text"
                className="form-input search-input"
                placeholder="Search solutions by AI tags (e.g. Chain Rule, Base Case, Formula)..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
              {tagSearchQuery && (
                <button
                  onClick={() => setTagSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {isLoadingSolutions ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div className="spinner" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-muted)' }}>Loading AI-vetted community solutions...</p>
              </div>
            ) : filteredSolutions.length === 0 ? (
              <div style={{ background: '#F9FAFB', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '2.5rem 1rem', textAlign: 'center' }}>
                <FileText size={38} style={{ color: 'var(--color-muted)', margin: '0 auto 0.75rem auto' }} strokeWidth={2} />
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                  No Vetted Community Solutions Published Yet
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', maxWidth: '420px', margin: '0 auto', lineHeight: '1.45' }}>
                  {tagSearchQuery
                    ? `No solution matched tag "${tagSearchQuery}".`
                    : 'Be the first to complete a study session and grant (x/2) mutual consent to publish your workspace here!'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '380px', overflowY: 'auto' }}>
                {filteredSolutions.map((sol) => (
                  <div
                    key={sol.id}
                    onClick={() => setSelectedSolutionDetail(sol)}
                    style={{ background: '#FFF', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', padding: '1rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--color-ink)' }}>
                        Authors: {sol.author_a_name} & {sol.author_b_name}
                      </div>
                      <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: '0.72rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <CheckCircle2 size={12} strokeWidth={2.5} />
                        AI Vetted ({sol.votes_count} Consents)
                      </span>
                    </div>
                    <div style={{ background: 'var(--color-bg)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--color-ink)', marginBottom: '0.6rem', maxHeight: '60px', overflow: 'hidden' }}>
                      "{sol.scratchpad_content ? sol.scratchpad_content.slice(0, 150) + '...' : 'Interactive Whiteboard Derivation'}"
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      <Tag size={12} strokeWidth={2.5} style={{ color: 'var(--color-muted)' }} />
                      {sol.ai_tags?.map((t, idx) => (
                        <span key={idx} style={{ background: '#EFF6FF', color: 'var(--color-cobalt)', fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '8px' }}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Solution Detail View Modal */}
      {selectedSolutionDetail && (
        <div className="modal-overlay" onClick={() => setSelectedSolutionDetail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                  Community Solution Workspace
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  By {selectedSolutionDetail.author_a_name} & {selectedSolutionDetail.author_b_name}
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedSolutionDetail(null)} style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ background: 'var(--color-bg)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: 'var(--border-thick)', marginBottom: '1rem', fontSize: '0.88rem', lineHeight: '1.45', maxHeight: '180px', overflowY: 'auto' }}>
              <strong>Scratchpad Notes:</strong>
              <div style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                {selectedSolutionDetail.scratchpad_content || 'No text notes provided for this session.'}
              </div>
            </div>

            {selectedSolutionDetail.canvas_content && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.35rem' }}>Whiteboard Derivation:</strong>
                <img
                  src={selectedSolutionDetail.canvas_content}
                  alt="Whiteboard Derivation"
                  style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', border: 'var(--border-thick)', borderRadius: 'var(--radius-md)', background: '#FFF' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1.25rem' }}>
              {selectedSolutionDetail.ai_tags?.map((t, idx) => (
                <span key={idx} style={{ background: '#EFF6FF', color: 'var(--color-cobalt)', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
                  #{t}
                </span>
              ))}
            </div>

            <button className="btn-primary" onClick={() => setSelectedSolutionDetail(null)} style={{ width: '100%' }}>
              Close Solution
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
