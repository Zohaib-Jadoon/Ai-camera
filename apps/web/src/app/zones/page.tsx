'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Save, RotateCcw, Box } from 'lucide-react';

export default function ZoneEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPoints([...points, { x, y }]);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background placeholder
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#3f3f46';
    ctx.font = '14px sans-serif';
    ctx.fillText('CAMERA SNAPSHOT PLACEHOLDER', canvas.width / 2 - 100, canvas.height / 2);

    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p) => ctx.lineTo(p.x, p.y));

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();

      // Draw points
      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.stroke();
      });
    }
  };

  useEffect(() => {
    draw();
  }, [points]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white text-gradient bg-clip-text">Zone & Boundary Editor</h1>
          <p className="text-zinc-500">Draw detection zones and crossing lines on camera feeds</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPoints([])} className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Reset
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Zone
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 relative aspect-video">
            <canvas
                ref={canvasRef}
                width={800}
                height={450}
                onClick={handleCanvasClick}
                className="w-full h-full cursor-crosshair"
            />
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white text-xs font-medium flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-400" />
                Click on the feed to define zone points
            </div>
        </div>

        <div className="space-y-6">
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Rule Configuration</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Rule Type</label>
                        <select className="w-full mt-1.5 p-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-lg text-sm">
                            <option>Human Intrusion</option>
                            <option>Vehicle Entry</option>
                            <option>Loitering Detection</option>
                            <option>Line Crossing</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Sensitivity</label>
                        <input type="range" className="w-full mt-2" />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="alert" className="rounded" />
                        <label htmlFor="alert" className="text-sm">Trigger immediate alert</label>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-2">
                    <Shield className="w-5 h-5" />
                    <span className="font-bold">Pro Tip</span>
                </div>
                <p className="text-sm text-blue-800/70 dark:text-blue-300/70 leading-relaxed">
                    Closed polygons work best for restricted areas, while single lines are ideal for entrance monitoring.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
