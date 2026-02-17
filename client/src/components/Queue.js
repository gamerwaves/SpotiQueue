import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Queue.css';

const CACHE_KEY = 'spotiqueue.queue.current.v1';
const CACHE_TTL_MS = 30_000;      // cache queue for 30s
const POLL_MS = 15_000;           // normal polling every 15s
const BACKOFF_BASE_MS = 30_000;   // start backing off at 30s
const BACKOFF_MAX_MS = 60_000;    // cap backoff at 60s

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore storage errors
  }
}

function Queue() {
  const [queue, setQueue] = useState(() => readCache());
  const [loading, setLoading] = useState(() => !readCache());

  const timerRef = useRef(null);
  const backoffRef = useRef(0); // 0 = no backoff

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = (ms) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (cancelled) return;

      try {
        const response = await axios.get('/api/queue/current');

        if (cancelled) return;
        setQueue(response.data);
        writeCache(response.data);

        // success: reset backoff and schedule normal poll
        backoffRef.current = 0;
        setLoading(false);
        scheduleNext(POLL_MS);
      } catch (error) {
        console.error('Error fetching queue:', error);

        // If server returns 429, prefer Retry-After if present
        const status = error?.response?.status;
        const retryAfter = error?.response?.headers?.['retry-after'];

        let nextMs;
        if (status === 429 && retryAfter) {
          const seconds = Number(retryAfter);
          nextMs = Number.isFinite(seconds) ? seconds * 1000 : BACKOFF_BASE_MS;
        } else {
          // generic exponential-ish backoff
          const prev = backoffRef.current || BACKOFF_BASE_MS;
          nextMs = Math.min(prev * 2, BACKOFF_MAX_MS);
        }

        backoffRef.current = nextMs;
        setLoading(false);
        scheduleNext(nextMs);
      }
    };

    // Start immediately (but you already have cached data to show)
    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="queue-container">
        <div className="queue-loading">Loading queue...</div>
      </div>
    );
  }

  if (!queue || !queue.queue || queue.queue.length === 0) {
    return (
      <div className="queue-container">
        <h3 className="queue-title">Queue</h3>
        <div className="queue-empty">No songs in queue</div>
      </div>
    );
  }

  return (
    <div className="queue-container">
      <h3 className="queue-title">Queue ({queue.queue.length})</h3>
      <div className="queue-list">
        {queue.queue.map((track, index) => (
          <div key={`${track.uri}-${index}`} className="queue-item">
            <div className="queue-item-number">{index + 1}</div>
            {track.album_art && (
              <img src={track.album_art} alt={track.album} className="queue-item-art" />
            )}
            <div className="queue-item-info">
              <div className="queue-item-name">{track.name}</div>
              <div className="queue-item-artist">{track.artists}</div>
            </div>
            <div className="queue-item-duration">
              {Math.floor(track.duration_ms / 60000)}:
              {String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Queue;
