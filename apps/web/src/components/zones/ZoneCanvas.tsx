'use client';

/**
 * ZoneCanvas — Frigate-inspired interactive polygon zone drawer.
 *
 * Renders on top of a live camera feed (passed as `frameSrc`).
 * - Click to add polygon vertices
 * - Close polygon by clicking the first point (snaps when within 12px)
 * - Drag existing points to adjust
 * - All coordinates are normalised (0.0–1.0) before saving
 *
 * Uses react-konva / konva instead of a raw <canvas> so we get:
 *   - built-in hit detection on shapes
 *   - easy drag events on individual points
 *   - crisp scaling on high-DPI screens
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Image as KonvaImage, Text, Rect } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';

// ── types ────────────────────────────────────────────────────────────────────

export type Point = [number, number]; // normalised [x, y] in 0..1

export interface ZonePolygon {
  id: string;
  name: string;
  rule_type: string;
  points: Point[]; // normalised
  color: string;
}

interface Props {
  /** Base64 JPEG frame from the AI engine (data:image/jpeg;base64,…) */
  frameSrc: string | null;
  /** Existing zones to render as overlays */
  existingZones: ZonePolygon[];
  /** Whether drawing mode is active */
  isDrawing: boolean;
  /** Called with normalised points when polygon is closed */
  onZoneComplete: (points: Point[]) => void;
  /** Called when a vertex is dragged to a new position */
  onZoneUpdate?: (zoneId: string, points: Point[]) => void;
  /** Active zone colour during drawing */
  drawColor?: string;
}

// colours per rule type
const RULE_COLORS: Record<string, string> = {
  intrusion:     '#ef4444',  // red-500
  loitering:     '#f59e0b',  // amber-500
  line_crossing: '#8b5cf6',  // violet-500
  perimeter:     '#06b6d4',  // cyan-500
};

export function colorForRule(rule: string): string {
  return RULE_COLORS[rule] ?? '#3b82f6';
}

// ── snap helper ──────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ── component ────────────────────────────────────────────────────────────────

export default function ZoneCanvas({
  frameSrc,
  existingZones,
  isDrawing,
  onZoneComplete,
  onZoneUpdate,
  drawColor = '#22d3ee',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });

  // Track canvas dimensions dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load background frame image
  const [bgImage] = useImage(frameSrc ?? '');

  // Current draft polygon (pixel coords while drawing)
  const [draftPx, setDraftPx] = useState<{ x: number; y: number }[]>([]);
  const [cursorPx, setCursorPx] = useState<{ x: number; y: number } | null>(null);
  const [isClosed, setIsClosed] = useState(false);

  // Reset draft when drawing mode turns off
  useEffect(() => {
    if (!isDrawing) {
      setDraftPx([]);
      setCursorPx(null);
      setIsClosed(false);
    }
  }, [isDrawing]);

  // ── coordinate helpers ───────────────────────────────────────────────────

  const toNorm = useCallback(
    (px: number, py: number): Point => [px / size.w, py / size.h],
    [size],
  );

  const toPx = useCallback(
    (nx: number, ny: number) => ({ x: nx * size.w, y: ny * size.h }),
    [size],
  );

  // ── stage click — add point or close polygon ─────────────────────────────

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing || isClosed) return;

      const stage = e.target.getStage()!;
      const pos = stage.getPointerPosition()!;

      // Snap to first point to close polygon
      if (draftPx.length >= 3) {
        const first = draftPx[0];
        if (dist(pos.x, pos.y, first.x, first.y) < 14) {
          // Close — fire callback with normalised coords
          const norm = draftPx.map((p) => toNorm(p.x, p.y));
          onZoneComplete(norm);
          setDraftPx([]);
          setCursorPx(null);
          setIsClosed(false);
          return;
        }
      }

      setDraftPx((prev) => [...prev, { x: pos.x, y: pos.y }]);
    },
    [isDrawing, isClosed, draftPx, toNorm, onZoneComplete],
  );

  // ── mouse move — rubber-band line ────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing || isClosed) return;
      const pos = e.target.getStage()!.getPointerPosition()!;
      setCursorPx(pos);
    },
    [isDrawing, isClosed],
  );

  // ── existing zone vertex drag ────────────────────────────────────────────

  const handleVertexDrag = useCallback(
    (zoneId: string, normPoints: Point[], vertexIdx: number, e: Konva.KonvaEventObject<DragEvent>) => {
      if (!onZoneUpdate) return;
      const newPx = e.target.position();
      const updated: Point[] = normPoints.map((p, i) =>
        i === vertexIdx ? toNorm(newPx.x, newPx.y) : p,
      );
      onZoneUpdate(zoneId, updated);
    },
    [onZoneUpdate, toNorm],
  );

  // ── build flat points array for Konva Line ───────────────────────────────

  const draftFlat = draftPx.flatMap((p) => [p.x, p.y]);
  const draftWithCursor =
    cursorPx && draftPx.length > 0
      ? [...draftFlat, cursorPx.x, cursorPx.y]
      : draftFlat;

  // first-point snap indicator
  const isNearFirst =
    draftPx.length >= 3 &&
    cursorPx != null &&
    dist(cursorPx.x, cursorPx.y, draftPx[0].x, draftPx[0].y) < 14;

  return (
    <div ref={containerRef} className="w-full h-full">
      <Stage
        width={size.w}
        height={size.h}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        style={{ cursor: isDrawing ? 'crosshair' : 'default' }}
      >
        <Layer>
          {/* Background frame */}
          {bgImage && (
            <KonvaImage
              image={bgImage}
              width={size.w}
              height={size.h}
              listening={false}
            />
          )}

          {/* Existing zones */}
          {existingZones.map((zone) => {
            const flat = zone.points.flatMap(([nx, ny]) => [nx * size.w, ny * size.h]);
            return (
              <React.Fragment key={zone.id}>
                {/* Filled polygon */}
                <Line
                  points={flat}
                  closed
                  fill={zone.color + '33'}   // 20% opacity fill
                  stroke={zone.color}
                  strokeWidth={2}
                  dash={[6, 3]}
                  listening={!!onZoneUpdate}
                />
                {/* Zone label */}
                {zone.points.length > 0 && (() => {
                  const cx = zone.points.reduce((s, [x]) => s + x, 0) / zone.points.length * size.w;
                  const cy = zone.points.reduce((s, [, y]) => s + y, 0) / zone.points.length * size.h;
                  return (
                    <>
                      <Rect
                        x={cx - 30} y={cy - 10}
                        width={60} height={20}
                        fill="#00000080"
                        cornerRadius={4}
                        listening={false}
                      />
                      <Text
                        x={cx - 28} y={cy - 7}
                        text={zone.name || zone.rule_type}
                        fontSize={11}
                        fontStyle="bold"
                        fill={zone.color}
                        listening={false}
                      />
                    </>
                  );
                })()}
                {/* Draggable vertices */}
                {onZoneUpdate && zone.points.map(([nx, ny], vi) => (
                  <Circle
                    key={vi}
                    x={nx * size.w}
                    y={ny * size.h}
                    radius={6}
                    fill={zone.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                    draggable
                    onDragEnd={(e) => handleVertexDrag(zone.id, zone.points, vi, e)}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* Draft polygon being drawn */}
          {draftPx.length > 0 && (
            <>
              <Line
                points={draftWithCursor}
                stroke={drawColor}
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                dash={[6, 4]}
                listening={false}
              />
              {/* Vertices */}
              {draftPx.map((p, i) => (
                <Circle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={i === 0 ? (isNearFirst ? 10 : 7) : 5}
                  fill={i === 0 ? (isNearFirst ? '#22d3ee' : drawColor) : drawColor}
                  stroke="#fff"
                  strokeWidth={1.5}
                  listening={false}
                  opacity={isNearFirst && i === 0 ? 1 : 0.9}
                />
              ))}
              {/* Close hint */}
              {isNearFirst && (
                <Text
                  x={draftPx[0].x + 12}
                  y={draftPx[0].y - 18}
                  text="Close polygon"
                  fontSize={11}
                  fill="#22d3ee"
                  listening={false}
                />
              )}
            </>
          )}

          {/* Instruction overlay when drawing and no points yet */}
          {isDrawing && draftPx.length === 0 && (
            <>
              <Rect x={0} y={0} width={size.w} height={32} fill="#00000066" listening={false} />
              <Text
                x={0} y={8}
                width={size.w}
                text="Click on the feed to place zone vertices • Click first point to close"
                fontSize={12}
                fill="#22d3ee"
                align="center"
                listening={false}
              />
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}

// Need React in scope for JSX in this file
import React from 'react';
