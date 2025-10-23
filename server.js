require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
const PLAYLIST_ID = '4VgRTWWWJPXdV13RLAbabU'; // WEEKLY AT 88 BENEVOLENT
const SCOPES = 'playlist-read-private playlist-modify-public playlist-modify-private user-read-email';
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '955wbru'; // WBRU account only

// Token storage
const TOKEN_FILE = path.join(__dirname, '.tokens.json');
let tokenCache = {
  access_token: null,
  refresh_token: null,
  expires_at: null,
  user_id: null
};

// Load tokens from file
async function loadTokens() {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf8');
    tokenCache = JSON.parse(data);
    console.log('Tokens loaded from file');
  } catch (error) {
    console.log('No existing tokens found');
  }
}

// Save tokens to file
async function saveTokens() {
  try {
    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenCache, null, 2));
    console.log('Tokens saved to file');
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

// Get valid access token (refresh if needed)
async function getAccessToken() {
  // Check if user is authorized
  if (tokenCache.user_id && tokenCache.user_id !== ALLOWED_USER_ID) {
    throw new Error('Access denied: This account is not authorized to use this application.');
  }

  // Check if we have a valid token
  if (tokenCache.access_token && tokenCache.expires_at && Date.now() < tokenCache.expires_at - 60000) {
    return tokenCache.access_token;
  }

  // Need to refresh
  if (!tokenCache.refresh_token) {
    throw new Error('No refresh token available. Please authorize first.');
  }

  console.log('Refreshing access token...');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenCache.refresh_token
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  tokenCache.access_token = data.access_token;
  tokenCache.expires_at = Date.now() + (data.expires_in * 1000);

  if (data.refresh_token) {
    tokenCache.refresh_token = data.refresh_token;
  }

  await saveTokens();

  return tokenCache.access_token;
}

// Spotify API request wrapper with auto-refresh
async function spotifyRequest(endpoint, options = {}) {
  const accessToken = await getAccessToken();

  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`
    }
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 1;
    console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return spotifyRequest(endpoint, options);
  }

  // Handle unauthorized (shouldn't happen after refresh, but just in case)
  if (response.status === 401) {
    console.log('Unauthorized response, clearing token and retrying...');
    tokenCache.access_token = null;
    tokenCache.expires_at = null;
    return spotifyRequest(endpoint, options);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = JSON.stringify(errorJson, null, 2);
    } catch (e) {
      // Keep errorText if not JSON
    }
    console.error(`Spotify API Error Details:
      Status: ${response.status}
      URL: ${endpoint}
      Response: ${errorDetail}
    `);
    throw new Error(`Spotify API error: ${response.status} - ${errorDetail}`);
  }

  return response.json();
}

// ============== AUTH ENDPOINTS ==============

// Start OAuth flow
app.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    show_dialog: true
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// OAuth callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.send('Authorization failed: No code received');
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Store tokens temporarily
    tokenCache.access_token = data.access_token;
    tokenCache.refresh_token = data.refresh_token;
    tokenCache.expires_at = Date.now() + (data.expires_in * 1000);

    // Verify user is authorized
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user information');
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    console.log(`User ${userId} (${userData.display_name}) attempting to authorize`);

    // Check if user is allowed
    if (userId !== ALLOWED_USER_ID) {
      console.log(`❌ Access denied for user ${userId}`);
      // Clear tokens
      tokenCache.access_token = null;
      tokenCache.refresh_token = null;
      tokenCache.expires_at = null;
      tokenCache.user_id = null;

      return res.send(`
        <html>
          <head>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 40px;
                text-align: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
              }
              h1 { font-size: 48px; margin: 0 0 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>🚫 Access Denied</h1>
              <p style="font-size: 18px;">This application is restricted to authorized WBRU accounts only.</p>
              <p style="font-size: 14px; opacity: 0.8;">If you believe this is an error, please contact the administrator.</p>
            </div>
          </body>
        </html>
      `);
    }

    // User is authorized!
    console.log(`✓ Access granted for user ${userId}`);
    tokenCache.user_id = userId;
    await saveTokens();

    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>✓ Authorization Successful!</h1>
          <p>Welcome, ${userData.display_name}!</p>
          <p>You can close this window and return to the app.</p>
          <script>
            // Notify the parent window that authorization succeeded
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'spotify-auth-success' }, '*');
            }
            // Close after a short delay
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Authorization error:', error);
    res.send(`Authorization failed: ${error.message}`);
  }
});

// Check auth status
app.get('/api/auth-status', async (req, res) => {
  try {
    await getAccessToken();
    res.json({ authorized: true });
  } catch (error) {
    res.json({ authorized: false, message: error.message });
  }
});

// Get current user info (temporary endpoint to get user ID)
app.get('/api/me', async (req, res) => {
  try {
    const userData = await spotifyRequest('/me');
    res.json({
      id: userData.id,
      display_name: userData.display_name,
      email: userData.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== VIBE-MATCH UTILITIES ==============

// Fetch all playlist tracks (with pagination)
async function getAllPlaylistTracks() {
  let allTracks = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}/tracks?fields=items(track(id,name,artists(name),album(name,images),duration_ms,explicit)),total&limit=${limit}&offset=${offset}`);

    const tracks = data.items
      .filter(item => item.track && item.track.id) // Filter out null tracks
      .map(item => item.track);

    allTracks = allTracks.concat(tracks);

    if (allTracks.length >= data.total || tracks.length < limit) {
      break;
    }

    offset += limit;
  }

  return allTracks;
}

// Fetch audio features in batches
async function getAudioFeatures(trackIds) {
  const features = [];
  const batchSize = 100;

  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const data = await spotifyRequest(`/audio-features?ids=${batch.join(',')}`);
    features.push(...data.audio_features.filter(f => f !== null));
  }

  return features;
}

// Calculate centroid (mean) of audio features
function calculateCentroid(audioFeatures) {
  if (audioFeatures.length === 0) return null;

  const features = ['danceability', 'energy', 'valence', 'tempo', 'acousticness', 'instrumentalness', 'liveness', 'speechiness'];
  const centroid = {};

  features.forEach(feature => {
    const values = audioFeatures.map(f => f[feature]).filter(v => v !== null && v !== undefined);
    if (values.length > 0) {
      centroid[feature] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  });

  // Calculate variance for each feature
  centroid.variance = {};
  features.forEach(feature => {
    const values = audioFeatures.map(f => f[feature]).filter(v => v !== null && v !== undefined);
    if (values.length > 0) {
      const mean = centroid[feature];
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      centroid.variance[feature] = variance;
    }
  });

  return centroid;
}

// Find tracks closest to centroid
function findRepresentativeTracks(audioFeatures, centroid, count = 5) {
  const features = ['danceability', 'energy', 'valence', 'acousticness', 'instrumentalness', 'liveness', 'speechiness'];

  const scored = audioFeatures.map(track => {
    // Calculate normalized Euclidean distance
    let distance = 0;
    let validFeatures = 0;

    features.forEach(feature => {
      if (track[feature] !== null && track[feature] !== undefined && centroid[feature] !== undefined) {
        // Normalize tempo (0-200 BPM) to 0-1 range for fair comparison
        const trackVal = feature === 'tempo' ? track[feature] / 200 : track[feature];
        const centroidVal = feature === 'tempo' ? centroid[feature] / 200 : centroid[feature];
        distance += Math.pow(trackVal - centroidVal, 2);
        validFeatures++;
      }
    });

    return {
      id: track.id,
      distance: validFeatures > 0 ? Math.sqrt(distance / validFeatures) : Infinity
    };
  });

  return scored
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(s => s.id);
}

// Calculate distance between track and centroid (for ranking recommendations)
function calculateDistance(trackFeatures, centroid) {
  const features = ['danceability', 'energy', 'valence', 'acousticness', 'instrumentalness', 'liveness', 'speechiness'];

  let distance = 0;
  let validFeatures = 0;

  features.forEach(feature => {
    if (trackFeatures[feature] !== null && trackFeatures[feature] !== undefined && centroid[feature] !== undefined) {
      const trackVal = feature === 'tempo' ? trackFeatures[feature] / 200 : trackFeatures[feature];
      const centroidVal = feature === 'tempo' ? centroid[feature] / 200 : centroid[feature];
      distance += Math.pow(trackVal - centroidVal, 2);
      validFeatures++;
    }
  });

  return validFeatures > 0 ? Math.sqrt(distance / validFeatures) : Infinity;
}

// Generate explanation for why tracks match
function explainMatch(trackFeatures, centroid) {
  const explanations = [];

  if (trackFeatures.energy !== undefined && centroid.energy !== undefined) {
    if (trackFeatures.energy > 0.7) explanations.push('high energy');
    else if (trackFeatures.energy < 0.3) explanations.push('low energy');
  }

  if (trackFeatures.valence !== undefined && centroid.valence !== undefined) {
    if (trackFeatures.valence > 0.6) explanations.push('upbeat vibe');
    else if (trackFeatures.valence < 0.4) explanations.push('mellow vibe');
  }

  if (trackFeatures.danceability !== undefined && centroid.danceability !== undefined) {
    if (trackFeatures.danceability > 0.7) explanations.push('very danceable');
  }

  if (trackFeatures.tempo !== undefined && centroid.tempo !== undefined) {
    if (trackFeatures.tempo > 140) explanations.push('fast tempo');
    else if (trackFeatures.tempo < 90) explanations.push('slow tempo');
    else explanations.push('mid-tempo');
  }

  if (trackFeatures.acousticness !== undefined && centroid.acousticness !== undefined) {
    if (trackFeatures.acousticness > 0.6) explanations.push('acoustic');
  }

  return explanations.slice(0, 3).join(', ');
}

// ============== PLAYLIST ENDPOINTS ==============

// Get playlist details
app.get('/api/playlist-details', async (req, res) => {
  try {
    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}?fields=name,description,images,public,collaborative,followers(total)`);

    res.json({
      name: data.name,
      description: data.description,
      images: data.images,
      public: data.public,
      collaborative: data.collaborative,
      followers: data.followers?.total || 0
    });
  } catch (error) {
    console.error('Playlist details fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update playlist details
app.put('/api/playlist-details', async (req, res) => {
  const { name, description, public: isPublic } = req.body;

  try {
    const body = {};
    if (name !== undefined) body.name = name;
    if (description !== undefined) body.description = description;
    if (isPublic !== undefined) body.public = isPublic;

    await spotifyRequest(`/playlists/${PLAYLIST_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update playlist details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get playlist tracks with pagination (left pane)
app.get('/api/playlist', async (req, res) => {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 30;

    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}/tracks?fields=items(track(id,name,artists(name),album(name,images),duration_ms,explicit)),total&limit=${limit}&offset=${offset}`);

    // Transform to simplified format
    const tracks = data.items.map(item => {
      const track = item.track;
      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[2]?.url || track.album.images[0]?.url, // Small image
        duration: track.duration_ms,
        explicit: track.explicit
      };
    });

    res.json({
      total: data.total,
      tracks: tracks,
      offset: offset,
      limit: limit,
      hasMore: offset + tracks.length < data.total
    });
  } catch (error) {
    console.error('Playlist fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search tracks (right pane)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  try {
    const data = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=20`);

    const tracks = data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[2]?.url || track.album.images[0]?.url,
      uri: track.uri,
      preview_url: track.preview_url
    }));

    res.json({ tracks });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommendations (right pane)
app.get('/api/recommendations', async (req, res) => {
  const seedTracks = req.query.seed_tracks;

  if (!seedTracks) {
    return res.status(400).json({ error: 'seed_tracks parameter required' });
  }

  try {
    const data = await spotifyRequest(`/recommendations?seed_tracks=${seedTracks}&limit=20`);

    const tracks = data.tracks.map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[2]?.url || track.album.images[0]?.url,
      uri: track.uri,
      preview_url: track.preview_url
    }));

    res.json({ tracks });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get simple recommendations based on playlist
app.get('/api/vibe-match', async (req, res) => {
  try {
    console.log('\n========== VIBE-MATCH REQUEST ==========');
    console.log('Getting recommendations based on playlist...');

    // 1. Fetch playlist tracks (just first 100 for seed selection)
    console.log('Step 1: Fetching playlist tracks...');
    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}/tracks?limit=100&fields=items(track(id,name,type))`);

    const playlistTracks = data.items
      .filter(item => item.track && item.track.id && item.track.type === 'track')
      .map(item => item.track);

    if (playlistTracks.length === 0) {
      console.log('❌ No tracks in playlist');
      return res.json({ tracks: [], message: 'No tracks in playlist' });
    }

    console.log(`✅ Found ${playlistTracks.length} valid tracks in playlist`);

    // 2. Pick random 5 tracks as seeds (simple approach)
    console.log('Step 2: Selecting random seed tracks...');
    const shuffled = [...playlistTracks].sort(() => 0.5 - Math.random());
    const seedTracks = shuffled.slice(0, Math.min(5, playlistTracks.length));
    const seedIds = seedTracks.map(t => t.id).filter(id => id); // Filter out any nulls

    if (seedIds.length === 0) {
      console.log('❌ No valid seed tracks');
      return res.json({ tracks: [], message: 'No valid seed tracks' });
    }

    console.log(`✅ Selected ${seedIds.length} seed tracks:`);
    seedTracks.forEach((track, i) => {
      console.log(`   ${i + 1}. ${track.name} (ID: ${track.id})`);
    });

    // 3. Alternative approach - get artist IDs from tracks
    console.log('Step 3: Getting artist information from seed tracks...');

    const artistIds = [];
    for (const seedId of seedIds.slice(0, 2)) { // Just use first 2 tracks
      try {
        const trackInfo = await spotifyRequest(`/tracks/${seedId}`);
        if (trackInfo.artists && trackInfo.artists.length > 0) {
          artistIds.push(trackInfo.artists[0].id);
        }
      } catch (err) {
        console.log(`   ⚠️  Could not get track ${seedId}:`, err.message);
      }
    }

    console.log(`✅ Found ${artistIds.length} artists from seeds`);

    if (artistIds.length === 0) {
      console.log('❌ No artists found, cannot generate recommendations');
      return res.json({ tracks: [], message: 'No artists found for recommendations' });
    }

    // 4. Get recommended tracks by getting top tracks from related artists
    console.log('Step 4: Getting top tracks from these artists...');

    const recommendedTracks = [];
    for (const artistId of artistIds) {
      try {
        const topTracks = await spotifyRequest(`/artists/${artistId}/top-tracks?market=US`);
        if (topTracks.tracks) {
          recommendedTracks.push(...topTracks.tracks.slice(0, 5));
        }
      } catch (err) {
        console.log(`   ⚠️  Could not get top tracks for artist ${artistId}:`, err.message);
      }
    }

    console.log(`✅ Found ${recommendedTracks.length} recommended tracks`);

    const recsData = { tracks: recommendedTracks };

    if (!recsData.tracks || recsData.tracks.length === 0) {
      console.log('❌ No recommended tracks found');
      return res.json({ tracks: [], message: 'No recommendations found' });
    }

    console.log(`✅ Got ${recsData.tracks.length} candidate tracks`);


    // 5. De-dupe: remove tracks already in playlist
    console.log('Step 5: De-duplicating tracks...');
    const playlistTrackIds = new Set(playlistTracks.map(t => t.id));
    const newTracks = recsData.tracks.filter(track => !playlistTrackIds.has(track.id));

    console.log(`   Before de-dupe: ${recsData.tracks.length} tracks`);
    console.log(`   After de-dupe: ${newTracks.length} new tracks`);

    // 6. Take first 10 and format
    console.log('Step 6: Formatting tracks...');
    const tracks = newTracks.slice(0, 10).map(track => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[2]?.url || track.album.images[0]?.url,
      uri: track.uri,
      preview_url: track.preview_url,
      explanation: 'based on your playlist'
    }));

    console.log(`✅ SUCCESS: Returning ${tracks.length} recommendations`);
    tracks.forEach((track, i) => {
      console.log(`   ${i + 1}. ${track.name} - ${track.artists}`);
    });
    console.log('========================================\n');

    res.json({ tracks });
  } catch (error) {
    console.error('\n========== ERROR ==========');
    console.error('❌ Recommendations error:', error.message);
    console.error('Error stack:', error.stack);
    console.error('===========================\n');
    res.status(500).json({ error: 'Failed to get recommendations: ' + error.message });
  }
});

// Add tracks to playlist
app.post('/api/add-tracks', async (req, res) => {
  const { uris, position } = req.body;

  if (!uris || !Array.isArray(uris) || uris.length === 0) {
    return res.status(400).json({ error: 'uris array required' });
  }

  try {
    const body = { uris };
    if (position !== undefined) {
      body.position = position;
    }

    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    res.json({ success: true, snapshot_id: data.snapshot_id });
  } catch (error) {
    console.error('Add tracks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove tracks from playlist
app.delete('/api/remove-tracks', async (req, res) => {
  const { uris } = req.body;

  if (!uris || !Array.isArray(uris) || uris.length === 0) {
    return res.status(400).json({ error: 'uris array required' });
  }

  try {
    const tracks = uris.map(uri => ({ uri }));

    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}/tracks`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tracks })
    });

    res.json({ success: true, snapshot_id: data.snapshot_id });
  } catch (error) {
    console.error('Remove tracks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder tracks in playlist
app.put('/api/reorder-tracks', async (req, res) => {
  const { range_start, insert_before } = req.body;

  if (range_start === undefined || insert_before === undefined) {
    return res.status(400).json({ error: 'range_start and insert_before required' });
  }

  try {
    const data = await spotifyRequest(`/playlists/${PLAYLIST_ID}/tracks`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range_start: range_start,
        insert_before: insert_before,
        range_length: 1
      })
    });

    res.json({ success: true, snapshot_id: data.snapshot_id });
  } catch (error) {
    console.error('Reorder tracks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============== START SERVER ==============

loadTokens().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🎵 Spotify Playlist Manager running on http://localhost:${PORT}`);
    console.log(`\n📋 Managing playlist: WEEKLY AT 88 BENEVOLENT`);
    console.log(`   https://open.spotify.com/playlist/${PLAYLIST_ID}\n`);

    if (!tokenCache.refresh_token) {
      console.log('⚠️  No authorization found. Please visit:');
      console.log(`   http://localhost:${PORT}/login\n`);
    } else {
      console.log('✓ Authorization found. Ready to use!\n');
    }
  });
});
