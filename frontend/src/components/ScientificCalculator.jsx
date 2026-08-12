import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Move,
  History,
  Trash2,
  FileText,
  Check,
} from 'lucide-react';
import { evaluateMathExpression, decimalToFraction } from '../utils/mathEvaluator';
import { soundFX } from '../utils/soundFX';

export function ScientificCalculator({ isOpen, onClose, onInsertToNotes }) {
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'func' | 'history'
  const [expression, setExpression] = useState('');
  const [angleMode, setAngleMode] = useState('DEG'); // 'DEG' | 'RAD'
  const [isFractionView, setIsFractionView] = useState(false);
  const [history, setHistory] = useState([
    { expression: 'sin(30)', result: '0.5', numericResult: 0.5 },
    { expression: '√(144) + 5^2', result: '37', numericResult: 37 },
  ]);
  const [lastAns, setLastAns] = useState(37);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState('');

  // Dragging state
  const [position, setPosition] = useState({ x: 80, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 80, y: 80 });
  const calcNodeRef = useRef(null);

  // Real-time evaluated result
  const evalResult = evaluateMathExpression(expression, angleMode, lastAns);

  // Drag handlers
  const handleMouseDownHeader = (e) => {
    if (e.target.closest('button')) return; // Ignore drag on buttons
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(10, posStartRef.current.x + dx),
        y: Math.max(10, posStartRef.current.y + dy),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Keyboard shortcut listener when calculator is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;

      const key = e.key;

      if (key >= '0' && key <= '9') {
        handleAppend(key);
      } else if (['+', '-', '*', '/', '(', ')', '.', '^', '%'].includes(key)) {
        let symbol = key;
        if (key === '*') symbol = '×';
        if (key === '/') symbol = '÷';
        handleAppend(symbol);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleCalculate();
      } else if (key === 'Backspace') {
        handleBackspace();
      } else if (key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, expression, angleMode, lastAns]);

  if (!isOpen) return null;

  const handleAppend = (token) => {
    soundFX.playSoftClick();
    setExpression((prev) => prev + token);
  };

  const handleBackspace = () => {
    soundFX.playSoftClick();
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    soundFX.playSoftClick();
    setExpression('');
  };

  const handleCalculate = () => {
    soundFX.playSoftClick();
    if (!expression.trim()) return;

    const res = evaluateMathExpression(expression, angleMode, lastAns);
    if (res.error) return;

    const newHistoryItem = {
      expression: angleMode === 'DEG' ? expression.replace(/\bsin\b/g, 'sin') : expression,
      result: res.result,
      numericResult: res.numericResult,
    };

    setHistory((prev) => [newHistoryItem, ...prev]);
    setLastAns(res.numericResult);
  };

  const handleInsertHistoryItem = (item) => {
    soundFX.playSoftClick();
    setExpression((prev) => prev + item.result);
  };

  const handleInsertToScratchpadNotes = () => {
    soundFX.playSoftClick();
    const finalVal = evalResult.result || lastAns;
    const str = expression ? `${expression} = ${finalVal}` : String(finalVal);
    if (onInsertToNotes) {
      onInsertToNotes(str);
      setCopiedMsg('Pasted into Notes!');
      setTimeout(() => setCopiedMsg(''), 3000);
    }
  };

  const displayResultStr = evalResult.error
    ? evalResult.error
    : isFractionView && evalResult.numericResult
    ? decimalToFraction(evalResult.numericResult)
    : evalResult.result;

  return (
    <div
      ref={calcNodeRef}
      className="scientific-calculator-container"
      style={{
        position: 'fixed',
        left: isMaximized ? '5vw' : `${position.x}px`,
        top: isMaximized ? '5vh' : `${position.y}px`,
        width: isMaximized ? '90vw' : '420px',
        height: isMaximized ? '90vh' : '560px',
        minWidth: '340px',
        minHeight: '480px',
        background: 'var(--color-surface)',
        border: 'var(--border-thick)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-hard-lg)',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
        resize: isMaximized ? 'none' : 'both',
        overflow: 'hidden',
        animation: 'stampIn 0.2s ease forwards',
      }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDownHeader}
        style={{
          background: 'var(--color-ink)',
          color: '#FFF',
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Move size={16} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.03em' }}>
            DESMOS SCIENTIFIC CALCULATOR
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="calc-top-btn"
            title={isMaximized ? 'Restore window size' : 'Maximize window'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="calc-top-btn calc-close-btn" title="Close Calculator">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Sub-bar: DEG/RAD toggle, Fraction toggle, History tab toggle, Copy to Notes */}
      <div
        style={{
          background: 'var(--color-bg)',
          borderBottom: 'var(--border-thick)',
          padding: '0.4rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              soundFX.playSoftClick();
              setAngleMode(angleMode === 'DEG' ? 'RAD' : 'DEG');
            }}
            className="calc-pill-toggle"
            title="Toggle Angle Unit (Degrees vs Radians)"
          >
            {angleMode}
          </button>

          <button
            onClick={() => {
              soundFX.playSoftClick();
              setIsFractionView(!isFractionView);
            }}
            className={`calc-pill-toggle ${isFractionView ? 'active' : ''}`}
            title="Toggle Fraction Output Format (a b/c)"
          >
            a b/c
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              soundFX.playSoftClick();
              setActiveTab(activeTab === 'history' ? 'main' : 'history');
            }}
            className={`calc-pill-toggle ${activeTab === 'history' ? 'active' : ''}`}
            title="View calculation history log"
          >
            <History size={14} />
            <span>History</span>
          </button>

          {onInsertToNotes && (
            <button
              onClick={handleInsertToScratchpadNotes}
              className="calc-pill-toggle"
              style={{ background: 'var(--color-primary)', color: 'var(--color-ink)', fontWeight: 800 }}
              title="Insert output into active scratchpad notes"
            >
              {copiedMsg ? <Check size={14} /> : <FileText size={14} />}
              <span>{copiedMsg || 'Insert Note'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Screen Display Area */}
      <div
        style={{
          background: '#FAFAFA',
          borderBottom: 'var(--border-thick)',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          minHeight: '84px',
        }}
      >
        {/* Input Expression Line */}
        <input
          type="text"
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="0"
          style={{
            width: '100%',
            textAlign: 'right',
            background: 'none',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-ink)',
          }}
        />

        {/* Realtime Live Evaluated Result */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.4rem',
            fontWeight: 800,
            color: evalResult.error ? 'var(--color-error)' : 'var(--color-primary-deep)',
            marginTop: '0.2rem',
          }}
        >
          {expression ? `= ${displayResultStr}` : `Ans = ${lastAns}`}
        </div>
      </div>

      {/* Keypad or History Panel */}
      {activeTab === 'history' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', background: 'var(--color-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.85rem' }}>
              CALCULATION HISTORY
            </span>
            {history.length > 0 && (
              <button
                onClick={() => {
                  soundFX.playSoftClick();
                  setHistory([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-error)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              No previous calculations recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleInsertHistoryItem(item)}
                  style={{
                    background: 'var(--color-surface)',
                    border: 'var(--border-thick)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.6rem 0.85rem',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-hard-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                  }}
                  title="Click to insert into expression"
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                    {item.expression}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-ink)' }}>
                    = {item.result}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.6rem', gap: '0.5rem', background: 'var(--color-bg)' }}>
          {/* Keypad Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => {
                soundFX.playSoftClick();
                setActiveTab('main');
              }}
              className={`calc-tab-btn ${activeTab === 'main' ? 'active' : ''}`}
            >
              Main
            </button>
            <button
              onClick={() => {
                soundFX.playSoftClick();
                setActiveTab('func');
              }}
              className={`calc-tab-btn ${activeTab === 'func' ? 'active' : ''}`}
            >
              Functions (Func)
            </button>
          </div>

          {/* Keypad Grid */}
          {activeTab === 'main' && (
            <div className="calc-grid-main">
              <button onClick={handleClearAll} className="calc-btn calc-btn-accent">
                AC
              </button>
              <button onClick={handleBackspace} className="calc-btn calc-btn-accent">
                ⌫
              </button>
              <button onClick={() => handleAppend('(')} className="calc-btn">
                (
              </button>
              <button onClick={() => handleAppend(')')} className="calc-btn">
                )
              </button>
              <button onClick={() => handleAppend('÷')} className="calc-btn calc-btn-op">
                ÷
              </button>

              <button onClick={() => handleAppend('7')} className="calc-btn">
                7
              </button>
              <button onClick={() => handleAppend('8')} className="calc-btn">
                8
              </button>
              <button onClick={() => handleAppend('9')} className="calc-btn">
                9
              </button>
              <button onClick={() => handleAppend('√(')} className="calc-btn">
                √
              </button>
              <button onClick={() => handleAppend('×')} className="calc-btn calc-btn-op">
                ×
              </button>

              <button onClick={() => handleAppend('4')} className="calc-btn">
                4
              </button>
              <button onClick={() => handleAppend('5')} className="calc-btn">
                5
              </button>
              <button onClick={() => handleAppend('6')} className="calc-btn">
                6
              </button>
              <button onClick={() => handleAppend('^2')} className="calc-btn">
                x²
              </button>
              <button onClick={() => handleAppend('-')} className="calc-btn calc-btn-op">
                -
              </button>

              <button onClick={() => handleAppend('1')} className="calc-btn">
                1
              </button>
              <button onClick={() => handleAppend('2')} className="calc-btn">
                2
              </button>
              <button onClick={() => handleAppend('3')} className="calc-btn">
                3
              </button>
              <button onClick={() => handleAppend('^')} className="calc-btn">
                a^b
              </button>
              <button onClick={() => handleAppend('+')} className="calc-btn calc-btn-op">
                +
              </button>

              <button onClick={() => handleAppend('0')} className="calc-btn">
                0
              </button>
              <button onClick={() => handleAppend('.')} className="calc-btn">
                .
              </button>
              <button onClick={() => handleAppend('π')} className="calc-btn">
                π
              </button>
              <button onClick={() => handleAppend('ans')} className="calc-btn">
                ans
              </button>
              <button onClick={handleCalculate} className="calc-btn calc-btn-op" style={{ background: 'var(--color-primary)', fontWeight: 800 }}>
                =
              </button>
            </div>
          )}

          {activeTab === 'func' && (
            <div className="calc-grid-func">
              <button onClick={() => handleAppend('sin(')} className="calc-btn">
                sin
              </button>
              <button onClick={() => handleAppend('cos(')} className="calc-btn">
                cos
              </button>
              <button onClick={() => handleAppend('tan(')} className="calc-btn">
                tan
              </button>

              <button onClick={() => handleAppend('asin(')} className="calc-btn">
                sin⁻¹
              </button>
              <button onClick={() => handleAppend('acos(')} className="calc-btn">
                cos⁻¹
              </button>
              <button onClick={() => handleAppend('atan(')} className="calc-btn">
                tan⁻¹
              </button>

              <button onClick={() => handleAppend('sinh(')} className="calc-btn">
                sinh
              </button>
              <button onClick={() => handleAppend('cosh(')} className="calc-btn">
                cosh
              </button>
              <button onClick={() => handleAppend('tanh(')} className="calc-btn">
                tanh
              </button>

              <button onClick={() => handleAppend('ln(')} className="calc-btn">
                ln
              </button>
              <button onClick={() => handleAppend('log(')} className="calc-btn">
                log
              </button>
              <button onClick={() => handleAppend('10^(')} className="calc-btn">
                10^x
              </button>

              <button onClick={() => handleAppend('!')} className="calc-btn">
                x!
              </button>
              <button onClick={() => handleAppend('nCr(')} className="calc-btn">
                nCr
              </button>
              <button onClick={() => handleAppend('nPr(')} className="calc-btn">
                nPr
              </button>

              <button onClick={() => handleAppend('abs(')} className="calc-btn">
                |x|
              </button>
              <button onClick={() => handleAppend('round(')} className="calc-btn">
                round
              </button>
              <button onClick={() => handleAppend('floor(')} className="calc-btn">
                floor
              </button>
            </div>
          )}

          {/* Big Action Equals Button */}
          <button
            onClick={handleCalculate}
            className="btn-primary"
            style={{ width: '100%', padding: '0.65rem', marginTop: 'auto', fontSize: '1.1rem', letterSpacing: '0.05em' }}
          >
            = EXECUTE CALCULATION
          </button>
        </div>
      )}
    </div>
  );
}
