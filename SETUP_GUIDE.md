# Complete Setup Guide

## Quick Start for WBRU (media@wbru.com)

This guide will walk you through setting up the Spotify Playlist Manager for the **WEEKLY AT 88 BENEVOLENT** playlist.

---

## Step 1: Create Spotify Developer App

### 1.1 Go to Spotify Developer Dashboard

Visit: https://developer.spotify.com/dashboard

Log in with your credentials if needed.

### 1.2 Create New App

1. Click the **"Create app"** button
2. Fill in the form:

   **App name:**
   ```
   Playlist Manager - WBRU
   ```

   **App description:**
   ```
   Manage WEEKLY AT 88 BENEVOLENT playlist
   ```

   **Website:** (optional)
   ```
   https://wbru.com
   ```

   **Redirect URIs:** (IMPORTANT!)
   ```
   http://localhost:3000/callback
   ```

   **Which API/SDKs are you planning to use?**
   - ✓ Check **Web API**

3. Check the Terms of Service box
4. Click **"Save"**

### 1.3 Get Your Credentials

1. You'll be taken to your new app's page
2. Click **"Settings"** in the top right
3. You'll see:
   - **Client ID** - Copy this 1839949ccd3a42bd828c33ccfdcc1294
   - **Client secret** - Click "View client secret" and copy it e66f698edd0a40d7af3aa15c86371db1

**Keep these safe!** You'll need them in the next step.

---

## Step 2: Configure the Application

### 2.1 Open Terminal

On Mac:
- Press `Cmd + Space`
- Type "Terminal"
- Press Enter

### 2.2 Navigate to the Project

```bash
cd ~/Desktop/spotify-playlist-manager
```

### 2.3 Create Environment File

```bash
cp .env.example .env
```

### 2.4 Edit the .env File

Open the `.env` file in a text editor:

```bash
open -e .env
```

Replace the placeholder values with your actual credentials:

```
SPOTIFY_CLIENT_ID=paste_your_client_id_here
SPOTIFY_CLIENT_SECRET=paste_your_client_secret_here
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

**Example:**
```
SPOTIFY_CLIENT_ID=abc123def456ghi789
SPOTIFY_CLIENT_SECRET=xyz987uvw654rst321
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

Save the file (Cmd+S) and close it.

---

## Step 3: Install and Run

### 3.1 Install Dependencies

In Terminal:

```bash
npm install
```

Wait for it to complete (should take 10-30 seconds).

### 3.2 Start the Server

```bash
npm start
```

You should see:

```
🎵 Spotify Playlist Manager running on http://localhost:3000

📋 Managing playlist: WEEKLY AT 88 BENEVOLENT
   https://open.spotify.com/playlist/4VgRTWWWJPXdV13RLAbabU

⚠️  No authorization found. Please visit:
   http://localhost:3000/login
```

**Leave this terminal window open!** The server needs to keep running.

---

## Step 4: Authorize the App (One-Time Only)

### 4.1 Start Authorization

Open your web browser and go to:

```
http://localhost:3000/login
```

### 4.2 Log In to Spotify

You'll be redirected to Spotify. Log in with:

**Email:** media@wbru.com
**Password:** [your password]

### 4.3 Grant Permissions

You'll see a permissions screen asking to:
- View your Spotify account data
- View your playlists
- Manage your playlists

Click **"Agree"** or **"Accept"**

### 4.4 Success!

You should see:

```
✓ Authorization Successful!
You can close this window and return to the app.
```

The window will auto-close after 2 seconds.

**Important:** The app has now saved a refresh token. You won't need to log in again, even after restarting the server!

---

## Step 5: Use the App

### 5.1 Open the Main App

In your browser, go to:

```
http://localhost:3000
```

You should see:
- **Header:** Green checkmark showing "✓ Authorized"
- **Left Pane:** Your playlist tracks loading
- **Right Pane:** Search box and recommendations

---

## How to Use

### View Your Playlist (Left Pane)

- All tracks from "WEEKLY AT 88 BENEVOLENT" appear here
- **Filter box:** Type to search within your current playlist
- **Refresh button:** Click to reload the playlist
- **Seed button:** Click on any track to use it for recommendations

### Search for New Tracks (Right Pane - Top)

1. Type a song, artist, or album name in the search box
2. Results appear automatically (after a short delay)
3. For each result:
   - **Add:** Adds the track to your playlist (at the top)
   - **Seed:** Uses this track to find similar recommendations

### Get Recommendations (Right Pane - Bottom)

1. Click **Seed** on 1-5 tracks (from playlist or search results)
2. Selected seeds appear in the "Seed tracks" section
3. Click **Get Recommendations**
4. Spotify suggests similar tracks
5. Click **Add** to add them to your playlist

---

## Daily Usage

### Starting the Server

Every time you want to use the app:

1. Open Terminal
2. Navigate to the project:
   ```bash
   cd ~/Desktop/spotify-playlist-manager
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open browser to: `http://localhost:3000`

### Stopping the Server

When you're done:
- Go to the Terminal window
- Press `Ctrl + C`

---

## Troubleshooting

### Problem: "Cannot find module 'dotenv'"

**Solution:** Run `npm install` in the project directory.

### Problem: "Failed to load playlist"

**Solutions:**
1. Check that you've authorized at `/login`
2. Verify your credentials in `.env` are correct
3. Make sure you're logged in as media@wbru.com on Spotify

### Problem: Port 3000 is already in use

**Solution:** Change the port in `.env`:
```
PORT=3001
```

Then also update `REDIRECT_URI`:
```
REDIRECT_URI=http://localhost:3001/callback
```

And update the Redirect URI in your Spotify app settings on the Developer Dashboard.

### Problem: "No authorization found" after restarting

**Check:** Look for the `.tokens.json` file in the project folder. If it's missing, you'll need to authorize again at `/login`.

If the file exists but you're still not authorized, delete it and re-authorize:
```bash
rm .tokens.json
```

Then visit `http://localhost:3000/login` again.

---

## Security Notes

- **Keep `.env` and `.tokens.json` secure**
- These files contain secrets and should stay on your local machine
- Never share these files with anyone

---

## Support Resources

- **Spotify Web API Docs:** https://developer.spotify.com/documentation/web-api
- **Developer Dashboard:** https://developer.spotify.com/dashboard
- **Authorization Flow:** https://developer.spotify.com/documentation/web-api/tutorials/code-flow

---

## File Reference

```
spotify-playlist-manager/
├── server.js              # Backend server (don't edit)
├── public/
│   ├── index.html        # Frontend interface (don't edit)
│   ├── styles.css        # Styling (edit to customize look)
│   └── app.js            # Frontend logic (don't edit)
├── .env                  # YOUR CREDENTIALS (edit this!)
├── .tokens.json          # Saved tokens (auto-generated)
├── package.json          # Dependencies
├── README.md             # Technical documentation
└── SETUP_GUIDE.md        # This file
```

---

## Need Help?

If you run into issues:

1. Check the Terminal window for error messages
2. Check the browser console (F12 → Console tab)
3. Verify all credentials are correct in `.env`
4. Try deleting `.tokens.json` and re-authorizing

---

**You're all set! Enjoy managing your playlist!** 🎵
