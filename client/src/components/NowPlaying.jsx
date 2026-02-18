import { Music } from 'lucide-react'

function NowPlaying({ track }) {
  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border p-4">
      {/* Header label with optional playing indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Now Playing
        </span>
        {track && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
        )}
      </div>

      {!track ? (
        /* No track state */
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Music className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nothing playing</p>
        </div>
      ) : (
        /* Track info with album art */
        <div className="flex items-center gap-4">
          {track.album_art ? (
            <img
              src={track.album_art}
              alt={track.album}
              className="w-20 h-20 rounded-lg object-cover shadow-md flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base truncate text-foreground">
              {track.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {track.artists}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {track.album}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default NowPlaying
