'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Fingerprint, Search, Clock, Camera, ArrowRight, UserCircle } from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch { return null; }
}

interface ReIDMatch {
  id: string;
  global_id: string;
  camera_id: string;
  matched_camera: string;
  similarity: number;
  sighting_count: number;
  timestamp: string;
}

interface SearchResult {
  camera_id: string;
  timestamp: string;
  score: number;
  detections: string[];
}

export default function ReIDPage() {
  const [matches, setMatches] = useState<ReIDMatch[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on('reid_match', (payload: any) => {
      const match: ReIDMatch = {
        id: `reid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        global_id: payload.global_id || '',
        camera_id: payload.camera_id || '',
        matched_camera: payload.matched_camera || '',
        similarity: payload.similarity || 0,
        sighting_count: payload.sighting_count || 0,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      setMatches(prev => [match, ...prev].slice(0, 50));
    });

    socket.on('search_video_result', (payload: any) => {
      setSearching(false);
      if (payload.error) {
        setSearchError(payload.error);
        setSearchResults([]);
      } else {
        setSearchResults(payload.results || []);
        setSearchError('');
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  const handleSearch = () => {
    if (!query.trim() || !socketRef.current) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    socketRef.current.emit('search_video', { query: query.trim() });
  };

  // Group ReID matches by global_id for timeline
  const timelines = matches.reduce<Record<string, ReIDMatch[]>>((acc, m) => {
    if (!acc[m.global_id]) acc[m.global_id] = [];
    acc[m.global_id].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Person Re-ID & Video Search</h1>
        <p className="text-sm text-slate-400 mt-1">Cross-camera person tracking, timeline visualization, and natural language video search</p>
      </div>

      {/* NLP Video Search */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-purple-400" />
          Natural Language Video Search
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          Search through indexed video frames using natural language — powered by CLIP (ViT-B/32)
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder='e.g. "person wearing red jacket near entrance" or "car parked in loading zone"'
            className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {searching ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching...</>
            ) : (
              <><Search className="w-4 h-4" /> Search</>
            )}
          </button>
        </div>

        {searchError && (
          <p className="text-red-400 text-sm mt-3">{searchError}</p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-400">{searchResults.length} results found</p>
            <div className="divide-y divide-slate-800/40 max-h-[300px] overflow-y-auto rounded-lg border border-slate-800/40">
              {searchResults.map((r, i) => (
                <div key={i} className="px-4 py-3 hover:bg-slate-800/30 transition-colors flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">Camera {r.camera_id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{new Date(r.timestamp).toLocaleString()} · Relevance: {(r.score * 100).toFixed(0)}%</p>
                  </div>
                  <span className="text-xs text-slate-600">{r.detections?.join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ReID Timeline */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-purple-400" />
            Cross-Camera Person Timeline
          </h2>
          <span className="text-xs text-slate-500">{Object.keys(timelines).length} tracked individuals</span>
        </div>

        {Object.keys(timelines).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Fingerprint className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No cross-camera matches yet</p>
            <p className="text-xs text-slate-600 mt-1">When the same person appears on multiple cameras, their timeline will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
            {Object.entries(timelines).map(([gid, sightings]) => (
              <div key={gid} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Person {gid.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{sightings.length} sightings across cameras</p>
                  </div>
                </div>

                {/* Horizontal timeline */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2 pl-12">
                  {sightings.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex flex-col items-center">
                        <div className="px-3 py-1.5 bg-slate-800/60 border border-slate-700/40 rounded-lg text-center">
                          <p className="text-[10px] text-purple-400 font-medium">Cam {s.camera_id.slice(0, 6)}</p>
                          <p className="text-[10px] text-slate-500">{new Date(s.timestamp).toLocaleTimeString()}</p>
                          <p className="text-[9px] text-slate-600">{(s.similarity * 100).toFixed(0)}% match</p>
                        </div>
                      </div>
                      {i < sightings.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
