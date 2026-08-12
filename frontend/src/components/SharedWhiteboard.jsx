import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Eraser, Square, Circle, Minus, PaintBucket, Trash2, Download, Undo2, Redo2, Lock } from 'lucide-react';
import { getCanvasContent, saveCanvasContent } from '../api';

const COLOR_PALETTE = [
  { name: 'Ink Black', hex: '#1F2421' },
  { name: 'Pastel Sage', hex: '#9CC5A1' },
  { name: 'Deep Sage', hex: '#6B9A73' },
  { name: 'Terracotta', hex: '#C97B4A' },
  { name: 'Brick Red', hex: '#B5533C' },
  { name: 'Cobalt Blue', hex: '#3B82F6' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'White', hex: '#FFFFFF' },
];

function getCustomCursor(tool, color, strokeWidth, isReadOnly) {
  if (isReadOnly) return 'default';
  const size = Math.max(16, Math.min(64, strokeWidth + 10));
  const center = size / 2;

  if (tool === 'brush') {
    const radius = Math.max(3, strokeWidth / 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="#1F2421" stroke-width="1.5" opacity="0.85"/>
      <circle cx="${center}" cy="${center}" r="1" fill="#FFFFFF"/>
    </svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
  }

  if (tool === 'eraser') {
    const rectSize = Math.max(8, strokeWidth);
    const half = rectSize / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="${center - half}" y="${center - half}" width="${rectSize}" height="${rectSize}" fill="rgba(240, 240, 240, 0.7)" stroke="#1F2421" stroke-width="2" rx="2"/>
    </svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${center} ${center}, crosshair`;
  }

  if (tool === 'fill') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F2421" stroke-width="2">
      <path d="M19 11L12 4L4 12L11 19L19 11Z" fill="${color}"/>
    </svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 4 19, crosshair`;
  }

  return 'crosshair';
}

export function SharedWhiteboard({ sessionId, matchData, isReadOnly = false, wsSend = null, remoteCanvasData = null, onCanvasSave = null }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser' | 'line' | 'rect' | 'circle' | 'fill'
  const [color, setColor] = useState('#1F2421');
  const [strokeWidth, setStrokeWidth] = useState(6);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState(null);

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const isUserDrawingRef = useRef(false);
  const lastLocalEditTimeRef = useRef(0);
  const debounceTimerRef = useRef(null);

  // Push state to undo stack before modifications
  const pushUndoState = () => {
    if (isReadOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(imageData);
    if (undoStackRef.current.length > 35) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleUndo = () => {
    if (isReadOnly || undoStackRef.current.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    redoStackRef.current.push(currentState);

    const previousState = undoStackRef.current.pop();
    ctx.putImageData(previousState, 0, 0);

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);

    lastLocalEditTimeRef.current = Date.now();
    isUserDrawingRef.current = true;
    triggerAutoSave();
  };

  const handleRedo = () => {
    if (isReadOnly || redoStackRef.current.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(currentState);

    const nextState = redoStackRef.current.pop();
    ctx.putImageData(nextState, 0, 0);

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);

    lastLocalEditTimeRef.current = Date.now();
    isUserDrawingRef.current = true;
    triggerAutoSave();
  };

  // Keyboard shortcut listener for Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    if (isReadOnly) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadOnly]);

  // Dynamically resize canvas resolution to match container dimensions (prevent edge cutoff)
  const syncCanvasResolution = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth - 24;
    const height = container.clientHeight - 24;

    if (width > 0 && height > 0 && (Math.abs(canvas.width - width) > 5 || Math.abs(canvas.height - height) > 5)) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  };

  useEffect(() => {
    syncCanvasResolution();
    window.addEventListener('resize', syncCanvasResolution);
    return () => window.removeEventListener('resize', syncCanvasResolution);
  }, []);

  // Fetch canvas content on mount & session change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fetchCanvas();
  }, [sessionId]);

  const fetchCanvas = async () => {
    if (!isReadOnly && (isUserDrawingRef.current || Date.now() - lastLocalEditTimeRef.current < 2500)) {
      return;
    }
    try {
      const data = await getCanvasContent(sessionId);
      if (data.content && canvasRef.current) {
        const img = new Image();
        img.onload = () => {
          if (!isReadOnly && (isUserDrawingRef.current || Date.now() - lastLocalEditTimeRef.current < 2500)) return;
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          }
        };
        img.src = data.content;
      }
    } catch {
      // Ignore background poll errors
    }
  };

  useEffect(() => {
    if (!isReadOnly) {
      const intervalId = setInterval(fetchCanvas, 2000);
      return () => clearInterval(intervalId);
    }
  }, [sessionId, isReadOnly]);

  // React to remote canvas updates pushed via WebSocket
  useEffect(() => {
    if (!remoteCanvasData || !canvasRef.current) return;
    // Don't overwrite if the local user just drew (avoids flicker)
    if (!isReadOnly && (isUserDrawingRef.current || Date.now() - lastLocalEditTimeRef.current < 1500)) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = remoteCanvasData;
  }, [remoteCanvasData]);

  const triggerAutoSave = () => {
    if (isReadOnly || !canvasRef.current) return;
    lastLocalEditTimeRef.current = Date.now();
    isUserDrawingRef.current = true;

    const dataUrl = canvasRef.current.toDataURL('image/png');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      // Broadcast via WebSocket first for instant peer update
      if (wsSend) {
        wsSend({ type: 'canvas', payload: { content: dataUrl } });
      }
      // Also call HTTP callback for DB persistence
      if (onCanvasSave) {
        onCanvasSave(dataUrl);
      }
      try {
        await saveCanvasContent(sessionId, dataUrl);
      } catch {
        // Ignore save error
      } finally {
        lastLocalEditTimeRef.current = Date.now();
        setTimeout(() => {
          isUserDrawingRef.current = false;
        }, 800);
      }
    }, 300);
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e) => {
    if (isReadOnly) return;
    pushUndoState();

    const pos = getCanvasCoords(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    setIsDrawing(true);
    isUserDrawingRef.current = true;
    lastLocalEditTimeRef.current = Date.now();
    setStartPos(pos);

    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === 'brush' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (tool === 'fill') {
      floodFill(Math.floor(pos.x), Math.floor(pos.y), color);
      setIsDrawing(false);
      triggerAutoSave();
    }
  };

  const handleMouseMove = (e) => {
    if (isReadOnly || !isDrawing) return;
    lastLocalEditTimeRef.current = Date.now();
    isUserDrawingRef.current = true;

    const pos = getCanvasCoords(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (tool === 'brush' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.fillStyle = color;

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
      } else if (tool === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = () => {
    if (isReadOnly || !isDrawing) return;
    setIsDrawing(false);
    triggerAutoSave();
  };

  const handleClearCanvas = () => {
    if (isReadOnly) return;
    pushUndoState();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    triggerAutoSave();
  };

  const handleExportCanvas = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `Socratic_Whiteboard_${matchData.shared_topic.replace(/\s+/g, '_')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const floodFill = (startX, startY, fillHex) => {
    if (isReadOnly) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const r = parseInt(fillHex.slice(1, 3), 16);
    const g = parseInt(fillHex.slice(3, 5), 16);
    const b = parseInt(fillHex.slice(5, 7), 16);

    const targetIdx = (startY * canvas.width + startX) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];

    if (targetR === r && targetG === g && targetB === b) return;

    const stack = [[startX, startY]];
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

      const idx = (y * canvas.width + x) * 4;
      if (data[idx] === targetR && data[idx + 1] === targetG && data[idx + 2] === targetB) {
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const customCursorStyle = getCustomCursor(tool, color, strokeWidth, isReadOnly);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          background: 'var(--color-bg)',
          borderBottom: 'var(--border-thick)',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {!isReadOnly ? (
          <>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                onClick={handleUndo}
                disabled={!canUndo}
                style={{ padding: '0.4rem 0.6rem', opacity: canUndo ? 1 : 0.4 }}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={15} strokeWidth={2.5} />
              </button>
              <button
                className="btn-secondary"
                onClick={handleRedo}
                disabled={!canRedo}
                style={{ padding: '0.4rem 0.6rem', opacity: canRedo ? 1 : 0.4 }}
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={15} strokeWidth={2.5} />
              </button>

              <div style={{ width: '1px', height: '20px', background: 'var(--color-ink)', margin: '0 0.2rem', opacity: 0.3 }} />

              <button
                className={`btn-secondary ${tool === 'brush' ? 'btn-primary' : ''}`}
                onClick={() => setTool('brush')}
                style={{ padding: '0.4rem 0.6rem' }}
                title="Brush Pen"
              >
                <Edit3 size={15} strokeWidth={2.5} />
              </button>
              <button
                className={`btn-secondary ${tool === 'eraser' ? 'btn-primary' : ''}`}
                onClick={() => setTool('eraser')}
                style={{ padding: '0.4rem 0.6rem' }}
                title="Eraser"
              >
                <Eraser size={15} strokeWidth={2.5} />
              </button>
              <button
                className={`btn-secondary ${tool === 'line' ? 'btn-primary' : ''}`}
                onClick={() => setTool('line')}
                style={{ padding: '0.4rem 0.6rem' }}
                title="Straight Line"
              >
                <Minus size={15} strokeWidth={2.5} />
              </button>
              <button
                className={`btn-secondary ${tool === 'rect' ? 'btn-primary' : ''}`}
                onClick={() => setTool('rect')}
                style={{ padding: '0.4rem 0.6rem' }}
                title="Rectangle"
              >
                <Square size={15} strokeWidth={2.5} />
              </button>
              <button
                className={`btn-secondary ${tool === 'circle' ? 'btn-primary' : ''}`}
                onClick={() => setTool('circle')}
                style={{ padding: '0.4rem 0.6rem' }}
                title="Circle"
              >
                <Circle size={15} strokeWidth={2.5} />
              </button>
              <button
                className={`btn-secondary ${tool === 'fill' ? 'btn-primary' : ''}`}
                onClick={() => setTool('fill')}
                style={{ padding: '0.4rem 0.6rem' }}
                title="Bucket Fill"
              >
                <PaintBucket size={15} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {COLOR_PALETTE.map((c) => (
                <div
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    background: c.hex,
                    border: color === c.hex ? '2px solid var(--color-ink)' : '1px solid rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                    boxShadow: color === c.hex ? 'var(--shadow-hard-sm)' : 'none',
                  }}
                  title={c.name}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700 }}>
                <span>Size:</span>
                <input
                  type="range"
                  min="2"
                  max="32"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  style={{ width: '80px', accentColor: 'var(--color-ink)' }}
                />
                <span style={{ fontSize: '0.75rem', width: '20px', color: 'var(--color-muted)' }}>{strokeWidth}px</span>
              </div>

              <button className="btn-secondary" onClick={handleClearCanvas} style={{ padding: '0.4rem 0.6rem' }} title="Clear Canvas">
                <Trash2 size={15} strokeWidth={2.5} />
              </button>

              <button className="btn-secondary" onClick={handleExportCanvas} style={{ padding: '0.4rem 0.6rem' }} title="Export Canvas Image">
                <Download size={15} strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-muted)' }}>
              <Lock size={15} strokeWidth={2.5} />
              <span>Archived Whiteboard Canvas (Read-Only)</span>
            </div>

            <button className="btn-secondary" onClick={handleExportCanvas} style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
              <Download size={15} strokeWidth={2.5} />
              <span>Download Canvas (.png)</span>
            </button>
          </div>
        )}
      </div>

      {/* Canvas Bounding Area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          background: 'var(--color-bg)',
          padding: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#FFFFFF',
            border: 'var(--border-thick)',
            boxShadow: 'var(--shadow-hard-sm)',
            borderRadius: 'var(--radius-md)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: customCursorStyle,
            }}
          />
        </div>
      </div>
    </div>
  );
}
