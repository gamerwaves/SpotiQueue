# SpotiQueue

A self-hosted web application that enables guests to queue Spotify tracks to your account during events. Features anti-spam protection, live playback display, and a comprehensive admin interface for complete control over the queue experience.
## What It Does

This application creates a collaborative music experience for events by allowing guests to add songs to your Spotify queue through a simple web interface. Guests can search for tracks or paste Spotify URLs, while you maintain full control through an admin panel. The system prevents spam through device fingerprinting and configurable cooldowns, displays the currently playing track in real-time, and provides detailed statistics about queue activity.

## Features

### Guest Interface
- Clean, mobile-responsive UI for easy song queueing
- Real-time Spotify track search with instant results
- Direct URL input for Spotify track links
- Live "Now Playing" display with album artwork and track information
- Visual feedback for queue status and cooldown timers

### Anti-Spam Protection
- Device fingerprinting to track unique users
- Configurable cooldown periods between queue attempts
- Rate limiting to prevent API abuse
- Block/unblock specific devices through admin panel
- Manual cooldown reset capability

### Content Control
- Ban specific tracks by Spotify ID
- Optional explicit content filtering
- Search results automatically filtered based on settings
- Prevent repeat offenders with device blocking

### Admin Panel
- Spotify account connection with automatic token refresh
- Device management with detailed fingerprint information
- Banned tracks list with easy add/remove functionality
- Configuration controls for all app settings
- Usage statistics and queue attempt metrics
- Password protection with customizable credentials
- No restart required for most configuration changes

### Technical Features
- SQLite database for lightweight data persistence
- Express.js backend with RESTful API
- React frontend with modern UI components
- PM2 or systemd process management support
- Docker deployment option
- Nginx reverse proxy compatibility
- HTTPS support with Let's Encrypt integration

## How to Deploy

### Prerequisites

- Node.js 18 or higher
- Spotify Premium account (required for queue functionality)
- Spotify Developer account for API credentials

### Deployment Options

#### Option 1: Local Development

Best for testing and development on your local machine.

1. Install dependencies:
```bash
npm run install:all
```

2. Configure environment:
```bash
cp env.example .env
# Edit .env with your Spotify Client ID and Client Secret
```

3. Start development servers:
```bash
npm run dev
```

Access the application:
- Public interface: http://localhost:3000
- Admin panel: http://localhost:3002

#### Option 2: Production Server (Ubuntu/Debian)

Recommended for hosting on a VPS or dedicated server.

1. Install Node.js 18+

2. Clone:
```bash
git clone https://github.com/gamerwaves/SpotiQueue.git
cd SpotiQueue
```
3. Configure environment:
```bash
cp env.example .env
nano .env
# Add your Spotify credentials and production URLs
```
4. Setup
```a
npm run install:all
npm run build
```



5. Run:
```bash
npm start
```

Access the application:
- Public interface: http://your-server-ip:3000
- Admin panel: http://your-server-ip:3000/admin

## Configuration and Usage

### Admin Panel

Access the admin panel to manage all aspects of the application:
- Development: http://localhost:3002
- Production: http://localhost:3001 or https://your-domain.com/admin

Default password: `admin` (change immediately after first login)

The admin panel provides five management tabs:

1. Spotify Connection
   - Connect or reconnect your Spotify account
   - View current connection status
   - No restart required after connecting

2. Device Management
   - View all devices that have attempted to queue tracks
   - See device fingerprints and last activity
   - Block or unblock specific devices
   - Reset cooldowns for individual devices or all at once

3. Banned Tracks
   - Add Spotify track IDs to prevent specific songs
   - Remove tracks from the ban list
   - Banned tracks are rejected when queued

4. Configuration
   - Cooldown Duration: Set time between queue attempts (default: 5 minutes)
   - Device Fingerprinting: Enable/disable tracking
   - Input Methods: Toggle search UI and URL input
   - Explicit Content Filter: Automatically ban explicit songs
   - Admin Password: Update admin panel credentials
   - Data Reset: Clear all devices, statistics, and banned tracks

5. Statistics
   - View total queue attempts
   - See successful vs. failed attempts
   - Monitor unique devices
   - Track usage patterns

### Guest Interface

The public interface provides a simple queueing experience:

1. Search for tracks using the search bar
2. Or paste a Spotify track URL directly
3. Click "Queue" to add the song
4. View the currently playing track with album artwork
5. Wait for the cooldown period before queueing again

Explicit content is automatically filtered if enabled in admin settings.

## Troubleshooting

### Common Issues

No active Spotify device found
- Ensure Spotify is open and actively playing on at least one device
- The device must not be paused for extended periods
- Try playing a song to reactivate the device

Failed to authenticate with Spotify
- Verify Client ID and Client Secret in .env are correct
- Use the admin panel Spotify tab to reconnect your account
- Check that redirect URI matches in Spotify Developer Dashboard
- No restart needed after reconnecting

Admin panel authentication error
- Default password is `admin`
- Verify you're accessing the correct port (3002 for dev, 3001 for production)
- Clear browser cache and cookies
- Check admin password hasn't been changed

Now Playing display not updating
- Confirm SPOTIFY_USER_ID is set correctly in .env
- Ensure an active playback session exists
- Check browser console for JavaScript errors
- Verify Spotify account is connected in admin panel

Explicit content blocked message
- Content filtering is enabled in admin Configuration tab
- Disable if you want to allow explicit songs
- Filtered tracks won't appear in search results when enabled

Application won't start
- Check if ports 3000 and 3001 are already in use
- Verify all dependencies are installed: `npm run install:all`
- Review PM2 logs: `pm2 logs spotify-queue`
- Check .env file is properly configured

Database permission errors
- Ensure data directory exists and is writable
- Run: `chmod -R 755 ./data`
- Verify DB_PATH in .env points to correct location

### Getting Help

For additional troubleshooting steps, see TROUBLESHOOTING.md in the repository. For deployment-specific issues, refer to DEPLOYMENT.md.

## Security Considerations

- Change the default admin password immediately after deployment
- Use HTTPS in production environments (Let's Encrypt provides free certificates)
- The admin panel uses HTTP Basic Auth for simplicity
- Device fingerprinting relies on cookies and can be reset by clearing browser data
- Rate limiting prevents API abuse but is not foolproof
- Keep Node.js and dependencies updated regularly
- Restrict admin panel access to trusted networks when possible

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome. Please open an issue to discuss proposed changes before submitting pull requests.

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.
