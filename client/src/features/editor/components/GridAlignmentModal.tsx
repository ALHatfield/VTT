// GridAlignmentModal — Phase 5E
// Modal for aligning a tile to the canvas grid via manual trace or auto-detection.
// Resizes the tile asset only — never the canvas grid.
import type { ChangeEvent, MouseEvent, ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GRID_DETECTION_MIN_CONFIDENCE, type TileAsset, type TilePlacement } from '@vtt/shared';

import { calcAlignedDimensions, detectGridSpacing } from '../utils/grid-alignment';
import styles from './GridAlignmentModal.module.css';

const DEFAULT_CELLS_ACROSS = 3;
const FINE_TUNE_MIN = 0.5;
const FINE_TUNE_MAX = 2.0;

interface TracePoint {
  x: number;
  y: number;
}

type DetectionStatus = 'idle' | 'detecting' | 'success' | 'failed';

export interface GridAlignmentModalProps {
  placement: TilePlacement;
  asset: TileAsset;
  canvasGridSize: number;
  onApply: (width: number, height: number) => void;
  onClose: () => void;
}

export function GridAlignmentModal({
  placement,
  asset,
  canvasGridSize,
  onApply,
  onClose,
}: GridAlignmentModalProps): ReactElement {
  const imgRef = useRef<HTMLImageElement>(null);

  const [cellsAcross, setCellsAcross] = useState(DEFAULT_CELLS_ACROSS);
  const [traceStart, setTraceStart] = useState<TracePoint | null>(null);
  const [traceEnd, setTraceEnd] = useState<TracePoint | null>(null);
  const [isTracing, setIsTracing] = useState(false);

  // Alignment state
  const [alignedWidth, setAlignedWidth] = useState<number | null>(null);
  const [alignedHeight, setAlignedHeight] = useState<number | null>(null);
  const [fineTune, setFineTune] = useState(1.0);
  const [lockAspect, setLockAspect] = useState(true);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('idle');

  // Re-compute alignment whenever the trace rect or cellsAcross changes
  useEffect(() => {
    if (!traceStart || !traceEnd || !imgRef.current) {
      setAlignedWidth(null);
      setAlignedHeight(null);
      return;
    }
    const displayWidth = imgRef.current.getBoundingClientRect().width;
    if (displayWidth === 0) return;
    const tracedDisplayPx = Math.abs(traceEnd.x - traceStart.x);
    if (tracedDisplayPx <= 0) {
      setAlignedWidth(null);
      setAlignedHeight(null);
      return;
    }
    const tracedAssetPx = (tracedDisplayPx / displayWidth) * asset.width;
    const result = calcAlignedDimensions(
      tracedAssetPx,
      cellsAcross,
      canvasGridSize,
      asset.width,
      asset.height,
    );
    setAlignedWidth(result.width);
    setAlignedHeight(result.height);
    setFineTune(1.0);
  }, [traceStart, traceEnd, cellsAcross, canvasGridSize, asset]);

  // SVG trace interaction — coordinates relative to the SVG element
  const getSvgPoint = (e: MouseEvent<SVGSVGElement>): TracePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleSvgMouseDown = (e: MouseEvent<SVGSVGElement>): void => {
    e.preventDefault();
    const pt = getSvgPoint(e);
    setTraceStart(pt);
    setTraceEnd(pt);
    setIsTracing(true);
  };

  const handleSvgMouseMove = (e: MouseEvent<SVGSVGElement>): void => {
    if (!isTracing) return;
    setTraceEnd(getSvgPoint(e));
  };

  const handleSvgMouseUp = (e: MouseEvent<SVGSVGElement>): void => {
    if (!isTracing) return;
    setTraceEnd(getSvgPoint(e));
    setIsTracing(false);
  };

  // Auto-detection
  const handleAutoDetect = useCallback((): void => {
    setDetectionStatus('detecting');
    void detectGridSpacing(
      asset.url,
      canvasGridSize,
      { cellsAcross: DEFAULT_CELLS_ACROSS, cellsDown: DEFAULT_CELLS_ACROSS },
      asset.width,
      asset.height,
    ).then((result) => {
      if ((result.confidence ?? 0) < GRID_DETECTION_MIN_CONFIDENCE) {
        setDetectionStatus('failed');
      } else {
        setAlignedWidth(result.width);
        setAlignedHeight(result.height);
        setFineTune(1.0);
        setDetectionStatus('success');
      }
    });
  }, [asset, canvasGridSize]);

  // Fine-tune: each W/H input respects the aspect ratio lock
  const aspectRatio = alignedWidth && alignedHeight ? alignedWidth / alignedHeight : 1;

  const handleWidthChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const w = parseInt(e.target.value, 10);
    if (!Number.isFinite(w) || w <= 0) return;
    setAlignedWidth(w);
    if (lockAspect) setAlignedHeight(Math.round(w / aspectRatio));
  };

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const h = parseInt(e.target.value, 10);
    if (!Number.isFinite(h) || h <= 0) return;
    setAlignedHeight(h);
    if (lockAspect) setAlignedWidth(Math.round(h * aspectRatio));
  };

  // Final dimensions after fine-tune scale
  const finalWidth =
    alignedWidth !== null ? Math.max(1, Math.round(alignedWidth * fineTune)) : null;
  const finalHeight =
    alignedHeight !== null ? Math.max(1, Math.round(alignedHeight * fineTune)) : null;

  // Trace rect in SVG-coordinate space
  const traceRect =
    traceStart && traceEnd
      ? {
          x: Math.min(traceStart.x, traceEnd.x),
          y: Math.min(traceStart.y, traceEnd.y),
          width: Math.abs(traceEnd.x - traceStart.x),
          height: Math.abs(traceEnd.y - traceStart.y),
        }
      : null;

  const cellDividers =
    traceRect && cellsAcross > 1
      ? Array.from({ length: cellsAcross - 1 }, (_, i) => ({
          x: traceRect.x + traceRect.width * ((i + 1) / cellsAcross),
          y1: traceRect.y,
          y2: traceRect.y + traceRect.height,
        }))
      : [];

  const hasResult = finalWidth !== null && finalHeight !== null;
  const canApply = hasResult;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Align Tile to Grid"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Align to Grid</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {/* Left: image preview with trace overlay */}
          <div className={styles.previewArea}>
            <p className={styles.hint}>
              Draw a rectangle over{' '}
              <strong>
                {cellsAcross} cell{cellsAcross !== 1 ? 's' : ''}
              </strong>{' '}
              of the tile&apos;s grid.
            </p>
            <div className={styles.imageWrap}>
              <img
                ref={imgRef}
                src={asset.url}
                alt={asset.filename}
                className={styles.previewImage}
                draggable={false}
              />
              {/* SVG overlay receives all pointer events for trace drawing */}
              <svg
                className={styles.traceOverlay}
                onMouseDown={handleSvgMouseDown}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
                onMouseLeave={() => {
                  if (isTracing) setIsTracing(false);
                }}
                aria-label="Trace area"
              >
                {traceRect && (
                  <>
                    <rect
                      x={traceRect.x}
                      y={traceRect.y}
                      width={traceRect.width}
                      height={traceRect.height}
                      fill="rgba(79,195,247,0.15)"
                      stroke="#4fc3f7"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                    />
                    {cellDividers.map((d) => (
                      <line
                        key={d.x}
                        x1={d.x}
                        y1={d.y1}
                        x2={d.x}
                        y2={d.y2}
                        stroke="#4fc3f7"
                        strokeWidth={1}
                        strokeDasharray="3 2"
                        opacity={0.6}
                      />
                    ))}
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Right: controls */}
          <div className={styles.controls}>
            <div className={styles.controlRow}>
              <label className={styles.controlLabel} htmlFor="align-cells-across">
                Cells across
              </label>
              <input
                id="align-cells-across"
                type="number"
                className={styles.controlInput}
                min={1}
                max={20}
                value={cellsAcross}
                onChange={(e) =>
                  setCellsAcross(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_CELLS_ACROSS))
                }
              />
            </div>

            <button
              type="button"
              className={styles.autoDetectBtn}
              onClick={handleAutoDetect}
              disabled={detectionStatus === 'detecting'}
            >
              {detectionStatus === 'detecting' ? 'Detecting…' : 'Auto-Detect Grid'}
            </button>

            {detectionStatus === 'failed' && (
              <p className={styles.fallbackMsg} role="alert">
                Grid detection failed. Please adjust manually.
              </p>
            )}
            {detectionStatus === 'success' && (
              <p className={styles.successMsg}>Grid detected — adjust fine-tune if needed.</p>
            )}

            {hasResult && (
              <>
                <hr className={styles.divider} />

                <div className={styles.controlRow}>
                  <label className={styles.controlLabel} htmlFor="align-fine-tune">
                    Scale
                  </label>
                  <input
                    id="align-fine-tune"
                    type="range"
                    className={styles.rangeInput}
                    min={FINE_TUNE_MIN}
                    max={FINE_TUNE_MAX}
                    step={0.01}
                    value={fineTune}
                    onChange={(e) => setFineTune(parseFloat(e.target.value))}
                  />
                  <span className={styles.rangeValue}>{Math.round(fineTune * 100)}%</span>
                </div>

                <div className={styles.dimensionRow}>
                  <input
                    type="number"
                    className={styles.dimInput}
                    aria-label="Width"
                    min={1}
                    value={alignedWidth ?? ''}
                    onChange={handleWidthChange}
                  />
                  <button
                    type="button"
                    className={`${styles.lockBtn} ${lockAspect ? styles.locked : ''}`}
                    onClick={() => setLockAspect((v) => !v)}
                    aria-pressed={lockAspect}
                    aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                    title={lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                  >
                    {lockAspect ? '🔒' : '🔓'}
                  </button>
                  <input
                    type="number"
                    className={styles.dimInput}
                    aria-label="Height"
                    min={1}
                    value={alignedHeight ?? ''}
                    onChange={handleHeightChange}
                  />
                </div>

                <p className={styles.resultSummary}>
                  {finalWidth} × {finalHeight} px{' '}
                  <span className={styles.resultOld}>
                    (was {placement.width} × {placement.height})
                  </span>
                </p>
              </>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.applyBtn}
            disabled={!canApply}
            onClick={() => {
              if (finalWidth === null || finalHeight === null) return;
              onApply(finalWidth, finalHeight);
            }}
          >
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}
