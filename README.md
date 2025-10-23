# Spotify Playlist Manager

A two-pane web application for managing your Spotify playlist **"WEEKLY AT 88 BENEVOLENT"** with search and recommendations functionality.

## Features

- **Left Pane**: Live view of playlist tracks with filtering
- **Right Pane**: Search for tracks and get AI-powered recommendations
- **One-Time OAuth**: Authorize once, then automatic token refresh
- **Add Tracks**: Seamlessly add tracks to your playlist
- **Seed-Based Recommendations**: Select up to 5 tracks as seeds for personalized recommendations

## Prerequisites

- Node.js 14+ installed
- A Spotify account
- Spotify Developer App credentials

## Setup Instructions

### 1. Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **"Create app"**
3. Fill in the details:
   - **App name**: Spotify Playlist Manager (or any name)
   - **App description**: Manage my playlists
   - **Redirect URI**: `http://localhost:3000/callback`
   - **API**: Check "Web API"
4. Click **"Save"**
5. On the app page, click **"Settings"**
6. Note your **Client ID** and **Client Secret** (click "View client secret")

### 2. Configure the Application

1. Navigate to the project directory:
   ```bash
   cd ~/Desktop/spotify-playlist-manager
   ```

2. Create a `.env` file by copying the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   REDIRECT_URI=http://localhost:3000/callback
   PORT=3000
   ```

   Replace `your_client_id_here` and `your_client_secret_here` with the values from your Spotify app.

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
node server.js
```

You should see:
```
🎵 Spotify Playlist Manager running on http://localhost:3000

📋 Managing playlist: WEEKLY AT 88 BENEVOLENT
   https://open.spotify.com/playlist/4VgRTWWWJPXdV13RLAbabU

⚠️  No authorization found. Please visit:
   http://localhost:3000/login
```

### 5. Authorize the App (One-Time)

1. Open your browser and go to: `http://localhost:3000/login`
2. You'll be redirected to Spotify to authorize
3. Log in with your account: **media@wbru.com**
4. Click **"Agree"** to grant permissions
5. You'll be redirected back and see "Authorization Successful!"

The app will save a refresh token, so you won't need to authorize again.

### 6. Use the App

Open `http://localhost:3000` in your browser. You should now see:

- **Left Pane**: Your current playlist tracks
- **Right Pane**: Search box and recommendations

## Usage Guide

### Viewing Your Playlist

- The left pane shows all tracks from "WEEKLY AT 88 BENEVOLENT"
- Use the filter box to search within your playlist
- Click **Refresh** to reload the playlist

### Searching for Tracks

1. Type in the search box (right pane)
2. Results appear after a short delay
3. Click **Add** to add a track to your playlist
4. Click **Seed** to use the track for recommendations

### Getting Recommendations

1. Select 1-5 tracks by clicking **Seed** (from playlist or search results)
2. Selected seeds appear in the "Seed tracks" section
3. Click **Get Recommendations**
4. Spotify will suggest similar tracks based on your seeds
5. Click **Add** to add recommended tracks to your playlist

### Adding Tracks

- Tracks are added to the **beginning** of your playlist (position 0)
- After adding, the playlist refreshes automatically
- Already-added tracks show "✓ In Playlist" (disabled button)

## Playlist Information

- **Playlist Name**: WEEKLY AT 88 BENEVOLENT
- **Playlist ID**: 4VgRTWWWJPXdV13RLAbabU
- **Direct Link**: [Open in Spotify](https://open.spotify.com/playlist/4VgRTWWWJPXdV13RLAbabU?si=iZYl5cbSQUKiKOYDOq1iXg)

## Technical Details

### Architecture

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript (no framework needed)
- **OAuth Flow**: Authorization Code Flow with refresh token
- **API**: Spotify Web API

### Security

- Client Secret stays on the server (never sent to browser)
- Refresh token stored securely in `.tokens.json` (keep this file private)
- Access tokens auto-refresh before expiry
- CORS enabled only for local development

### Rate Limiting

The app automatically handles Spotify's rate limits:
- On 429 response, waits for `Retry-After` duration
- Retries the request automatically

### Token Management

- Access tokens are cached and reused until near expiry
- Refresh happens automatically 60 seconds before expiration
- Tokens are persisted to `.tokens.json` so they survive server restarts

## Troubleshooting

### "No authorization found" after restart

The refresh token is saved in `.tokens.json`. If you deleted this file, you'll need to authorize again at `/login`.

### "Failed to load playlist"

1. Check your Spotify credentials in `.env`
2. Ensure you've authorized the app
3. Verify the playlist is accessible with your account

### Search/Recommendations not working

1. Check the browser console for errors
2. Ensure the backend server is running
3. Try refreshing your authorization: visit `/login` again

### Port 3000 already in use

Change the `PORT` in your `.env` file:
```
PORT=3001
```

Then update the Redirect URI in both:
1. Your `.env` file: `REDIRECT_URI=http://localhost:3001/callback`
2. Your Spotify app settings in the Developer Dashboard

## Development

### File Structure

```
spotify-playlist-manager/
├── server.js              # Backend API server
├── public/
│   ├── index.html        # Frontend HTML
│   ├── styles.css        # UI styles (light theme)
│   └── app.js            # Frontend logic
├── .env                  # Your credentials (keep private)
├── .env.example          # Template for .env
├── .tokens.json          # Saved tokens (keep private)
├── package.json          # Dependencies
└── README.md             # This file
```

### API Endpoints

- `GET /login` - Start OAuth flow
- `GET /callback` - OAuth callback handler
- `GET /api/auth-status` - Check if authorized
- `GET /api/playlist` - Get playlist tracks
- `GET /api/search?q={query}` - Search tracks
- `GET /api/recommendations?seed_tracks={ids}` - Get recommendations
- `POST /api/add-tracks` - Add tracks to playlist

## Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Authorization Code Flow Guide](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
- [Refreshing Tokens](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## License

ISC

---

Built with the Spotify Web API
