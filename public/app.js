// ============== STATE MANAGEMENT ==============

const state = {
  playlist: [],
  playlistDetails: null,
  searchResults: [],
  recommendations: [],
  seeds: new Set(),
  filterText: '',
  searchCache: new Map(),
  recentSearches: JSON.parse(localStorage.getItem('recentSearches') || '[]'),
  currentPage: 0,
  totalTracks: 0,
  pageSize: 30
};

// ============== DOM ELEMENTS ==============

const elements = {
  authStatus: document.getElementById('auth-status'),
  authModal: document.getElementById('auth-modal'),
  playlistTitle: document.getElementById('playlist-title'),
  playlistDescription: document.getElementById('playlist-description'),
  playlistImage: document.getElementById('playlist-image'),
  playlistFollowers: document.getElementById('playlist-followers'),
  playlistVisibility: document.getElementById('playlist-visibility'),
  editPlaylistBtn: document.getElementById('edit-playlist-btn'),
  editModal: document.getElementById('edit-modal'),
  editTitle: document.getElementById('edit-title'),
  editDescription: document.getElementById('edit-description'),
  editPublic: document.getElementById('edit-public'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),
  saveEditBtn: document.getElementById('save-edit-btn'),
  playlistContainer: document.getElementById('playlist-container'),
  playlistCount: document.getElementById('playlist-count'),
  filterInput: document.getElementById('filter-input'),
  refreshBtn: document.getElementById('refresh-btn'),
  pagination: document.getElementById('pagination'),
  prevPageBtn: document.getElementById('prev-page-btn'),
  nextPageBtn: document.getElementById('next-page-btn'),
  pageInfo: document.getElementById('page-info'),
  pageSelect: document.getElementById('page-select'),
  searchInput: document.getElementById('search-input'),
  searchResults: document.getElementById('search-results'),
  recentSearches: document.getElementById('recent-searches'),
  recentList: document.getElementById('recent-list'),
  refreshRecsBtn: document.getElementById('refresh-recs-btn'),
  recsResults: document.getElementById('recommendations-results'),
  toastContainer: document.getElementById('toast-container')
};

// ============== UTILITY FUNCTIONS ==============

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✗'}</span>
    <span>${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============== API FUNCTIONS ==============

async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth-status');
    const data = await response.json();

    if (data.authorized) {
      elements.authStatus.textContent = '✓ Authorized';
      elements.authStatus.className = 'auth-status authorized';
      elements.authModal.style.display = 'none';
      return true;
    } else {
      elements.authStatus.textContent = '✗ Not Authorized';
      elements.authStatus.className = 'auth-status unauthorized';
      elements.authModal.style.display = 'flex';
      return false;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    elements.authStatus.textContent = '✗ Error';
    elements.authStatus.className = 'auth-status unauthorized';
    return false;
  }
}

async function loadPlaylistDetails() {
  try {
    const response = await fetch('/api/playlist-details');
    if (!response.ok) throw new Error('Failed to load playlist details');

    const data = await response.json();
    state.playlistDetails = data;

    // Update UI
    elements.playlistTitle.textContent = data.name;
    elements.playlistDescription.textContent = data.description || 'No description';
    elements.playlistFollowers.textContent = `${data.followers} followers`;
    elements.playlistVisibility.textContent = data.public ? '🌍 Public' : '🔒 Private';

    // Update image
    if (data.images && data.images.length > 0) {
      elements.playlistImage.src = data.images[0].url;
      elements.playlistImage.style.display = 'block';
      elements.playlistImage.previousElementSibling.style.display = 'none';
    }
  } catch (error) {
    console.error('Load playlist details error:', error);
  }
}

async function loadPlaylist(page = 0) {
  elements.playlistContainer.innerHTML = '<div class="loading">Loading playlist...</div>';

  try {
    const offset = page * state.pageSize;
    const response = await fetch(`/api/playlist?offset=${offset}&limit=${state.pageSize}`);

    if (!response.ok) {
      throw new Error('Failed to load playlist');
    }

    const data = await response.json();
    state.playlist = data.tracks;
    state.totalTracks = data.total;
    state.currentPage = page;

    renderPlaylist();
    updatePagination(data.total, data.hasMore);
  } catch (error) {
    console.error('Load playlist error:', error);
    elements.playlistContainer.innerHTML = `
      <div class="error">Failed to load playlist: ${error.message}</div>
    `;
  }
}

function updatePagination(total, hasMore) {
  const totalPages = Math.ceil(total / state.pageSize);
  const currentPageNum = state.currentPage + 1;

  elements.pageInfo.textContent = `Page ${currentPageNum} of ${totalPages} (${total} total tracks)`;
  elements.prevPageBtn.disabled = state.currentPage === 0;
  elements.nextPageBtn.disabled = !hasMore;

  // Populate page dropdown
  let options = '';
  for (let i = 0; i < totalPages; i++) {
    options += `<option value="${i}">Page ${i + 1}</option>`;
  }
  // Add "Last Page" option
  if (totalPages > 1) {
    options += `<option value="${totalPages - 1}">Last Page (${totalPages})</option>`;
  }
  elements.pageSelect.innerHTML = options;
  elements.pageSelect.value = state.currentPage;

  elements.pagination.style.display = 'flex';
}

async function savePlaylistDetails() {
  try {
    const response = await fetch('/api/playlist-details', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: elements.editTitle.value,
        description: elements.editDescription.value,
        public: elements.editPublic.checked
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update playlist');
    }

    showToast('Playlist updated successfully!', 'success');
    elements.editModal.style.display = 'none';

    // Reload details
    await loadPlaylistDetails();
  } catch (error) {
    console.error('Save playlist error:', error);
    showToast(`Failed to update: ${error.message}`, 'error');
  }
}

function addToRecentSearches(query) {
  if (!query.trim()) return;

  // Remove if already exists
  state.recentSearches = state.recentSearches.filter(q => q !== query);

  // Add to front
  state.recentSearches.unshift(query);

  // Keep only last 5
  state.recentSearches = state.recentSearches.slice(0, 5);

  // Save to localStorage
  localStorage.setItem('recentSearches', JSON.stringify(state.recentSearches));

  renderRecentSearches();
}

function renderRecentSearches() {
  if (state.recentSearches.length === 0) {
    elements.recentSearches.style.display = 'none';
    return;
  }

  elements.recentSearches.style.display = 'block';
  elements.recentList.innerHTML = state.recentSearches.map(query =>
    `<div class="recent-chip" onclick="searchFromRecent('${query.replace(/'/g, "\\'")}')">${query}</div>`
  ).join('');
}

function searchFromRecent(query) {
  elements.searchInput.value = query;
  searchTracks(query);
}

async function searchTracks(query) {
  if (!query.trim()) {
    elements.searchResults.innerHTML = '<div class="empty-state">Type to search for tracks</div>';
    renderRecentSearches();
    return;
  }

  // Add to recent searches
  addToRecentSearches(query);

  // Check cache first
  if (state.searchCache.has(query)) {
    state.searchResults = state.searchCache.get(query);
    renderSearchResults();
    return;
  }

  elements.searchResults.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    state.searchResults = data.tracks;

    // Cache the results (LRU with max 50 entries)
    state.searchCache.set(query, data.tracks);
    if (state.searchCache.size > 50) {
      const firstKey = state.searchCache.keys().next().value;
      state.searchCache.delete(firstKey);
    }

    renderSearchResults();
  } catch (error) {
    console.error('Search error:', error);
    elements.searchResults.innerHTML = `
      <div class="error">Search failed: ${error.message}</div>
    `;
  }
}

async function loadAutoRecommendations() {
  elements.recsResults.innerHTML = '<div class="loading">Loading recommendations...</div>';

  try {
    const response = await fetch('/api/vibe-match');

    if (!response.ok) {
      throw new Error('Failed to get recommendations');
    }

    const data = await response.json();
    state.recommendations = data.tracks;

    renderRecommendations();
  } catch (error) {
    console.error('Recommendations error:', error);
    elements.recsResults.innerHTML = `
      <div class="error">Failed to load recommendations: ${error.message}</div>
    `;
  }
}

async function getRecommendations() {
  if (state.seeds.size === 0) {
    return;
  }

  elements.recsResults.innerHTML = '<div class="loading">Getting recommendations...</div>';

  try {
    const seedTracks = Array.from(state.seeds).slice(0, 5).join(',');
    const response = await fetch(`/api/recommendations?seed_tracks=${seedTracks}`);

    if (!response.ok) {
      throw new Error('Failed to get recommendations');
    }

    const data = await response.json();
    state.recommendations = data.tracks;

    renderRecommendations();
  } catch (error) {
    console.error('Recommendations error:', error);
    elements.recsResults.innerHTML = `
      <div class="error">Failed to get recommendations: ${error.message}</div>
    `;
  }
}

async function addTrackToPlaylist(trackUri, trackName) {
  try {
    const response = await fetch('/api/add-tracks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [trackUri]
        // No position = adds to bottom
      })
    });

    if (!response.ok) {
      throw new Error('Failed to add track');
    }

    showToast(`Added "${trackName}" to playlist`, 'success');

    // Reload playlist to show changes
    setTimeout(() => loadPlaylist(), 500);
  } catch (error) {
    console.error('Add track error:', error);
    showToast(`Failed to add track: ${error.message}`, 'error');
  }
}

async function removeTrackFromPlaylist(trackUri, trackName) {
  if (!confirm(`Remove "${trackName}" from playlist?`)) {
    return;
  }

  try {
    const response = await fetch('/api/remove-tracks', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [trackUri]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to remove track');
    }

    showToast(`Removed "${trackName}" from playlist`, 'success');

    // Reload playlist to show changes
    setTimeout(() => loadPlaylist(), 500);
  } catch (error) {
    console.error('Remove track error:', error);
    showToast(`Failed to remove track: ${error.message}`, 'error');
  }
}

// ============== SEED MANAGEMENT ==============

function toggleSeed(trackId, trackName) {
  if (state.seeds.has(trackId)) {
    state.seeds.delete(trackId);
  } else {
    if (state.seeds.size >= 5) {
      showToast('Maximum 5 seed tracks allowed', 'error');
      return;
    }
    state.seeds.add(trackId);
  }

  renderSeeds();
  updateGetRecsButton();

  // Re-render search results to update seed button states
  renderSearchResults();
}

function removeSeed(trackId) {
  state.seeds.delete(trackId);
  renderSeeds();
  updateGetRecsButton();
  renderSearchResults();
}

function updateGetRecsButton() {
  elements.getRecsBtn.disabled = state.seeds.size === 0;
}

// ============== RENDER FUNCTIONS ==============

function renderTrackItem(track, actions) {
  return `
    <div class="track-item" data-id="${track.id}">
      <img src="${track.albumArt}" alt="Album art" class="track-album-art">
      <div class="track-info">
        <div class="track-name">
          ${track.name}
          ${track.explicit ? '<span class="explicit-badge">E</span>' : ''}
        </div>
        <div class="track-artists">${track.artists}</div>
        <div class="track-album">${track.album}</div>
      </div>
      ${track.duration ? `<div class="track-duration">${formatDuration(track.duration)}</div>` : ''}
      <div class="track-actions">
        ${actions}
      </div>
    </div>
  `;
}

function renderPlaylist() {
  const filteredTracks = state.playlist.filter(track => {
    if (!state.filterText) return true;
    const searchText = state.filterText.toLowerCase();
    return (
      track.name.toLowerCase().includes(searchText) ||
      track.artists.toLowerCase().includes(searchText) ||
      track.album.toLowerCase().includes(searchText)
    );
  });

  elements.playlistCount.textContent = `${filteredTracks.length} tracks${state.filterText ? ` (filtered from ${state.playlist.length})` : ''}`;

  if (filteredTracks.length === 0) {
    elements.playlistContainer.innerHTML = '<div class="empty-state">No tracks found</div>';
    return;
  }

  // Only enable drag-and-drop when not filtering
  const draggable = state.filterText === '';

  elements.playlistContainer.innerHTML = filteredTracks.map((track, index) => {
    // Find actual index in full playlist
    const actualIndex = state.playlist.findIndex(t => t.id === track.id);

    return `
      <div
        class="track-item"
        data-id="${track.id}"
        data-index="${actualIndex}"
        ${draggable ? 'draggable="true"' : ''}
        ondragstart="${draggable ? 'handleDragStart(event)' : ''}"
        ondragover="${draggable ? 'handleDragOver(event)' : ''}"
        ondrop="${draggable ? 'handleDrop(event)' : ''}"
        ondragend="${draggable ? 'handleDragEnd(event)' : ''}">
        ${draggable ? '<div class="drag-handle">⋮⋮</div>' : ''}
        <img src="${track.albumArt}" alt="Album art" class="track-album-art">
        <div class="track-info">
          <div class="track-name">
            ${track.name}
            ${track.explicit ? '<span class="explicit-badge">E</span>' : ''}
          </div>
          <div class="track-artists">${track.artists}</div>
          <div class="track-album">${track.album}</div>
        </div>
        ${track.duration ? `<div class="track-duration">${formatDuration(track.duration)}</div>` : ''}
        <div class="track-actions">
          <button
            class="btn btn-small btn-danger"
            onclick="removeTrackFromPlaylist('spotify:track:${track.id}', '${track.name.replace(/'/g, "\\'")}')">
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderSearchResults() {
  if (state.searchResults.length === 0) {
    elements.searchResults.innerHTML = '<div class="empty-state">No results found</div>';
    return;
  }

  elements.searchResults.innerHTML = state.searchResults.map(track => {
    const alreadyInPlaylist = state.playlist.some(t => t.id === track.id);

    return renderTrackItem(track, `
      <button
        class="btn btn-small btn-primary"
        onclick="addTrackToPlaylist('${track.uri}', '${track.name.replace(/'/g, "\\'")}')">
        ${alreadyInPlaylist ? '✓ In Playlist' : 'Add'}
      </button>
    `);
  }).join('');
}

function renderRecommendations() {
  if (state.recommendations.length === 0) {
    elements.recsResults.innerHTML = '<div class="empty-state">No recommendations found</div>';
    return;
  }

  elements.recsResults.innerHTML = state.recommendations.map(track => {
    const alreadyInPlaylist = state.playlist.some(t => t.id === track.id);

    return `
      <div class="track-item" data-id="${track.id}">
        <img src="${track.albumArt}" alt="Album art" class="track-album-art">
        <div class="track-info">
          <div class="track-name">${track.name}</div>
          <div class="track-artists">${track.artists}</div>
          ${track.explanation ? `<div class="track-explanation">${track.explanation}</div>` : ''}
        </div>
        <div class="track-actions">
          <button
            class="btn btn-small btn-primary"
            onclick="addTrackToPlaylist('${track.uri}', '${track.name.replace(/'/g, "\\'")}')">
            ${alreadyInPlaylist ? '✓ In Playlist' : 'Add'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderSeeds() {
  if (state.seeds.size === 0) {
    elements.seedsList.innerHTML = '<div class="empty-state-small">No seeds selected</div>';
    return;
  }

  // Get track names for seeds
  const seedTracks = Array.from(state.seeds).map(id => {
    const track = state.playlist.find(t => t.id === id) || state.searchResults.find(t => t.id === id);
    return { id, name: track ? track.name : id };
  });

  elements.seedsList.innerHTML = seedTracks.map(track => `
    <div class="seed-chip">
      <span>${track.name}</span>
      <button onclick="removeSeed('${track.id}')">✕</button>
    </div>
  `).join('');
}

// ============== DRAG AND DROP ==============

let draggedElement = null;
let draggedIndex = null;

function handleDragStart(e) {
  draggedElement = e.target.closest('.track-item');
  draggedIndex = parseInt(draggedElement.dataset.index);
  draggedElement.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', draggedElement.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';

  const dropTarget = e.target.closest('.track-item');
  if (dropTarget && dropTarget !== draggedElement) {
    dropTarget.classList.add('drop-target');
  }

  return false;
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  const dropTarget = e.target.closest('.track-item');

  if (dropTarget && dropTarget !== draggedElement) {
    const dropIndex = parseInt(dropTarget.dataset.index);

    // Remove drop-target class
    document.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target');
    });

    // Call reorder API
    reorderTrack(draggedIndex, dropIndex);
  }

  return false;
}

function handleDragEnd(e) {
  document.querySelectorAll('.dragging').forEach(el => {
    el.classList.remove('dragging');
  });
  document.querySelectorAll('.drop-target').forEach(el => {
    el.classList.remove('drop-target');
  });
}

async function reorderTrack(fromIndex, toIndex) {
  try {
    // Calculate insert_before based on drag direction
    let insertBefore = toIndex;
    if (fromIndex < toIndex) {
      insertBefore = toIndex + 1;
    }

    const response = await fetch('/api/reorder-tracks', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range_start: fromIndex,
        insert_before: insertBefore
      })
    });

    if (!response.ok) {
      throw new Error('Failed to reorder track');
    }

    showToast('Track reordered', 'success');

    // Reload playlist to show changes
    setTimeout(() => loadPlaylist(), 300);
  } catch (error) {
    console.error('Reorder error:', error);
    showToast(`Failed to reorder: ${error.message}`, 'error');
  }
}

// ============== EVENT LISTENERS ==============

elements.editPlaylistBtn.addEventListener('click', () => {
  if (state.playlistDetails) {
    elements.editTitle.value = state.playlistDetails.name;
    elements.editDescription.value = state.playlistDetails.description || '';
    elements.editPublic.checked = state.playlistDetails.public;
    elements.editModal.style.display = 'flex';
  }
});

elements.cancelEditBtn.addEventListener('click', () => {
  elements.editModal.style.display = 'none';
});

elements.saveEditBtn.addEventListener('click', () => {
  savePlaylistDetails();
});

elements.editModal.addEventListener('click', (e) => {
  if (e.target === elements.editModal) {
    elements.editModal.style.display = 'none';
  }
});

elements.refreshBtn.addEventListener('click', () => {
  loadPlaylist(state.currentPage);
});

elements.prevPageBtn.addEventListener('click', () => {
  if (state.currentPage > 0) {
    loadPlaylist(state.currentPage - 1);
  }
});

elements.nextPageBtn.addEventListener('click', () => {
  loadPlaylist(state.currentPage + 1);
});

elements.pageSelect.addEventListener('change', (e) => {
  const selectedPage = parseInt(e.target.value);
  loadPlaylist(selectedPage);
});

elements.refreshRecsBtn.addEventListener('click', () => {
  loadAutoRecommendations();
});

elements.filterInput.addEventListener('input', (e) => {
  state.filterText = e.target.value;
  renderPlaylist();
});

const debouncedSearch = debounce((query) => {
  searchTracks(query);
}, 300);

elements.searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});

elements.searchInput.addEventListener('focus', () => {
  renderRecentSearches();
});

// ============== INITIALIZATION ==============

let authCheckInterval = null;
let loginWindow = null;

function openSpotifyLogin() {
  const width = 600;
  const height = 700;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  loginWindow = window.open(
    '/login',
    'spotify-auth',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
  );

  // Start checking auth status (as fallback)
  startAuthCheck();
}

// Listen for messages from the popup window
window.addEventListener('message', (event) => {
  // Check if the message is from our auth popup
  if (event.data && event.data.type === 'spotify-auth-success') {
    console.log('✓ Received auth success message from popup');
    handleAuthSuccess();
  }
});

function handleAuthSuccess() {
  // Stop polling
  stopAuthCheck();

  // Close login window if still open
  if (loginWindow && !loginWindow.closed) {
    loginWindow.close();
  }

  // Update UI
  elements.authStatus.textContent = '✓ Authorized';
  elements.authStatus.className = 'auth-status authorized';
  elements.authModal.style.display = 'none';

  // Load the app
  loadPlaylistDetails();
  loadPlaylist(0);
  loadAutoRecommendations();
  renderRecentSearches();
}

function startAuthCheck() {
  // Check every 2 seconds (as fallback if postMessage doesn't work)
  authCheckInterval = setInterval(async () => {
    const isAuthorized = await checkAuthStatus();

    if (isAuthorized) {
      // Authorization successful!
      console.log('✓ Auth detected via polling');
      handleAuthSuccess();
    }
  }, 2000);
}

function stopAuthCheck() {
  if (authCheckInterval) {
    clearInterval(authCheckInterval);
    authCheckInterval = null;
  }
}

async function init() {
  const isAuthorized = await checkAuthStatus();

  if (isAuthorized) {
    loadPlaylistDetails();
    loadPlaylist(0);
    loadAutoRecommendations();
    renderRecentSearches();
  } else {
    // Not authorized - start checking and wait for user to click authorize
    startAuthCheck();
  }
}

// Start the app
init();
