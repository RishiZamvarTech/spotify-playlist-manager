# Deployment Guide - Render.com

This guide will help you deploy your Spotify Playlist Manager to Render.com for free hosting.

## Prerequisites

- GitHub account with the repository pushed
- Render.com account (free) - sign up at https://render.com

## Step 1: Update Spotify Developer Dashboard

Before deploying, you need to add your production redirect URI:

1. Go to https://developer.spotify.com/dashboard
2. Click on your app "Playlist Manager - WBRU"
3. Click **Settings**
4. Under **Redirect URIs**, add:
   ```
   https://YOUR-APP-NAME.onrender.com/callback
   ```
   *(You'll get the actual URL in Step 3, so come back here later)*
5. Click **Save**

## Step 2: Deploy to Render.com

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if you haven't already
4. Select your repository: `spotify-playlist-manager`
5. Configure the service:
   - **Name**: `spotify-playlist-manager` (or your choice)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: **Free**

## Step 3: Add Environment Variables

In the "Environment Variables" section, add these:

### Required Variables:

1. **SPOTIFY_CLIENT_ID**
   - Value: `1839949ccd3a42bd828c33ccfdcc1294`

2. **SPOTIFY_CLIENT_SECRET**
   - Value: `e66f698edd0a40d7af3aa15c86371db1`

3. **REDIRECT_URI**
   - Value: `https://YOUR-APP-NAME.onrender.com/callback`
   - *(Replace YOUR-APP-NAME with the actual name you chose)*

4. **ALLOWED_USER_ID**
   - Value: `955wbru`

5. **PORT** (Optional - Render sets this automatically)
   - Value: `10000`

## Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for the deployment to complete (2-5 minutes)
3. You'll see a URL like: `https://spotify-playlist-manager-XXXX.onrender.com`

## Step 5: Complete Spotify Redirect URI Setup

1. Copy your Render.com URL
2. Go back to Spotify Developer Dashboard (Step 1)
3. Add the redirect URI:
   ```
   https://spotify-playlist-manager-XXXX.onrender.com/callback
   ```
4. Click **Save**

## Step 6: First-Time Authorization

1. Visit your Render.com URL
2. Click "Authorize with Spotify" or go to `/login`
3. Log in with the WBRU account (media@wbru.com)
4. Accept the permissions
5. You should see "Authorization Successful!"

**Note**: The authorization token will be stored, so you only need to do this once!

## Important Notes

### Free Tier Limitations

- ⏰ **Sleeps after 15 minutes of inactivity**
  - First request after sleep takes 30-60 seconds
  - Subsequent requests are instant

- 💾 **Disk storage is temporary**
  - `.tokens.json` is stored in memory
  - If service restarts, you'll need to re-authorize
  - Consider upgrading to paid tier for persistent storage

### Security

- ✅ Only WBRU account (`955wbru`) can authorize
- ✅ Other users will see "Access Denied" message
- ✅ Environment variables are encrypted by Render
- ✅ Never share your Client Secret

### Monitoring

- View logs: Render Dashboard → Your Service → Logs
- See requests and authorization attempts in real-time

## Troubleshooting

### "Invalid Redirect URI" Error

- Make sure the redirect URI in Spotify Dashboard **exactly** matches your Render URL
- Include `/callback` at the end
- Use `https://` not `http://`

### "Access Denied" After Login

- Make sure you're logging in with media@wbru.com (WBRU account)
- Check that `ALLOWED_USER_ID` is set to `955wbru`

### Service Won't Start

- Check the Render logs for errors
- Verify all environment variables are set correctly
- Make sure `PORT` is not hardcoded in `.env`

## Keeping It Alive

If you want to prevent the service from sleeping:

### Option 1: Use a Ping Service (Free)
- https://uptimerobot.com - Pings your URL every 5 minutes
- Add your Render URL as a monitor

### Option 2: Upgrade to Paid Plan
- $7/month for always-on service
- Persistent disk storage
- Faster cold starts

## Alternative: Railway.app

If you prefer Railway.app instead:

1. Go to https://railway.app
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Add the same environment variables
6. Deploy!

Railway also has a free tier with similar features.

---

**You're all set!** 🚀

Your Spotify Playlist Manager is now hosted and accessible from anywhere!
