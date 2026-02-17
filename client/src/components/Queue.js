import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Queue.css';

function Queue() {
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await axios.get('/api/queue/current');
        setQueue(response.data);
      } catch (error) {
        console.error('Error fetching queue:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="queue-container"><div className="queue-loading">Loading queue...</div></div>;
  }

  if (!queue || queue.queue.length === 0) {
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
