// Configuration
const CARD_SIZE = 250;
const GAP = 12;
const INITIAL_COLS = 12;
const INITIAL_ROWS = 10;
const LOAD_THRESHOLD = 400;    // Pixels from edge to trigger load
const EXPAND_AMOUNT = 4;       // Rows/cols to add when expanding

// State
let gridContainer = null;
let lightbox = null;
let isDragging = false;
let hasDragged = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// Grid state - track what's loaded where
let allAlbums = [];
let albumIndex = 0;            // Next album to use from shuffled pool
let gridCells = new Map();     // Map of "col,row" -> album card element
let minCol = 0, maxCol = 0;
let minRow = 0, maxRow = 0;

// Fetch all album covers from static JSON
async function fetchAlbums() {
    try {
        const response = await fetch('albums_data.json');
        if (!response.ok) return [];
        const data = await response.json();
        return data.albums || [];
    } catch (error) {
        console.error('Error fetching albums:', error);
        return [];
    }
}

// Shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get next album from pool (cycles through all, then reshuffles)
function getNextAlbum() {
    if (albumIndex >= allAlbums.length) {
        // Reshuffle when we've used all
        allAlbums = shuffleArray(allAlbums);
        albumIndex = 0;
    }
    return allAlbums[albumIndex++];
}

// Upgrade image URL to higher resolution
function getHighResImage(url) {
    // iTunes URLs can be upgraded by changing the size
    return url.replace('600x600', '1200x1200');
}

// Create a single album card element
function createAlbumCard(album) {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.title = `${album.title} - ${album.artist}`;

    const highResUrl = getHighResImage(album.image);

    const img = document.createElement('img');
    img.src = highResUrl;
    img.alt = `${album.title} by ${album.artist}`;
    img.loading = 'lazy';
    img.draggable = false;

    img.onerror = function() {
        this.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = 'fallback';
        fallback.textContent = '♪';
        card.appendChild(fallback);
    };

    card.addEventListener('click', () => {
        if (!hasDragged) {
            openLightbox(highResUrl, album.title, album.artist);
        }
    });

    card.appendChild(img);
    return card;
}

// Position a card at grid coordinates
function positionCard(card, col, row) {
    const x = col * (CARD_SIZE + GAP);
    const y = row * (CARD_SIZE + GAP);
    card.style.position = 'absolute';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.width = `${CARD_SIZE}px`;
    card.style.height = `${CARD_SIZE}px`;
}

// Add a card at specific grid position
function addCardAt(col, row) {
    const key = `${col},${row}`;
    if (gridCells.has(key)) return; // Already exists

    const album = getNextAlbum();
    const card = createAlbumCard(album);
    positionCard(card, col, row);
    gridContainer.appendChild(card);
    gridCells.set(key, card);
}

// Expand grid in a direction
function expandLeft() {
    minCol -= EXPAND_AMOUNT;
    for (let col = minCol; col < minCol + EXPAND_AMOUNT; col++) {
        for (let row = minRow; row <= maxRow; row++) {
            addCardAt(col, row);
        }
    }
}

function expandRight() {
    const oldMax = maxCol;
    maxCol += EXPAND_AMOUNT;
    for (let col = oldMax + 1; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
            addCardAt(col, row);
        }
    }
}

function expandUp() {
    minRow -= EXPAND_AMOUNT;
    for (let row = minRow; row < minRow + EXPAND_AMOUNT; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            addCardAt(col, row);
        }
    }
}

function expandDown() {
    const oldMax = maxRow;
    maxRow += EXPAND_AMOUNT;
    for (let row = oldMax + 1; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            addCardAt(col, row);
        }
    }
}

// Check if we need to expand and do so
function checkAndExpand() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate visible area in grid coordinates
    const leftEdge = -currentX;
    const rightEdge = -currentX + viewportWidth;
    const topEdge = -currentY;
    const bottomEdge = -currentY + viewportHeight;

    // Grid boundaries in pixels
    const gridLeft = minCol * (CARD_SIZE + GAP);
    const gridRight = (maxCol + 1) * (CARD_SIZE + GAP);
    const gridTop = minRow * (CARD_SIZE + GAP);
    const gridBottom = (maxRow + 1) * (CARD_SIZE + GAP);

    // Expand if near edges
    if (leftEdge < gridLeft + LOAD_THRESHOLD) expandLeft();
    if (rightEdge > gridRight - LOAD_THRESHOLD) expandRight();
    if (topEdge < gridTop + LOAD_THRESHOLD) expandUp();
    if (bottomEdge > gridBottom - LOAD_THRESHOLD) expandDown();
}

// Lightbox functions
function createLightbox() {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `
        <span class="lightbox-close">&times;</span>
        <div class="lightbox-content">
            <img src="" alt="">
            <div class="lightbox-info">
                <div class="lightbox-title"></div>
                <div class="lightbox-artist"></div>
            </div>
        </div>
    `;

    lb.addEventListener('click', (e) => {
        if (e.target === lb || e.target.classList.contains('lightbox-close')) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    document.body.appendChild(lb);
    return lb;
}

function openLightbox(imageSrc, title, artist) {
    if (!lightbox) lightbox = createLightbox();
    lightbox.querySelector('.lightbox-content img').src = imageSrc;
    lightbox.querySelector('.lightbox-title').textContent = title;
    lightbox.querySelector('.lightbox-artist').textContent = artist;
    lightbox.classList.add('active');
}

function closeLightbox() {
    if (lightbox) lightbox.classList.remove('active');
}

// Update grid position
function updatePosition() {
    if (!gridContainer) return;
    gridContainer.style.transform = `translate(${currentX}px, ${currentY}px)`;
    checkAndExpand();
}

// Mouse/touch event handlers
function handleDragStart(e) {
    if (lightbox && lightbox.classList.contains('active')) return;

    isDragging = true;
    hasDragged = false;

    if (e.type === 'mousedown') {
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
    } else if (e.type === 'touchstart') {
        startX = e.touches[0].clientX - currentX;
        startY = e.touches[0].clientY - currentY;
    }
}

function handleDragMove(e) {
    if (!isDragging) return;

    e.preventDefault();
    hasDragged = true;

    let clientX, clientY;
    if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
    } else if (e.type === 'touchmove') {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    currentX = clientX - startX;
    currentY = clientY - startY;

    updatePosition();
}

function handleDragEnd() {
    isDragging = false;
}

// Build initial grid
function buildInitialGrid() {
    gridContainer = document.createElement('div');
    gridContainer.className = 'grid-container';
    gridContainer.style.position = 'fixed';
    gridContainer.style.top = '0';
    gridContainer.style.left = '0';

    // Start centered around 0,0
    minCol = -Math.floor(INITIAL_COLS / 2);
    maxCol = Math.ceil(INITIAL_COLS / 2) - 1;
    minRow = -Math.floor(INITIAL_ROWS / 2);
    maxRow = Math.ceil(INITIAL_ROWS / 2) - 1;

    // Fill initial grid
    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            addCardAt(col, row);
        }
    }

    return gridContainer;
}

// Initialize
async function init() {
    const scrollContainer = document.getElementById('scrollContainer');
    const loadingMessage = document.getElementById('loadingMessage');

    try {
        const albums = await fetchAlbums();

        if (albums.length === 0) {
            loadingMessage.textContent = 'Unable to load album covers. Please refresh.';
            return;
        }

        // Shuffle all albums
        allAlbums = shuffleArray(albums);

        // Remove loading UI
        loadingMessage.remove();
        scrollContainer.remove();

        // Build initial grid
        buildInitialGrid();
        document.body.appendChild(gridContainer);

        // Center view on origin
        currentX = window.innerWidth / 2;
        currentY = window.innerHeight / 2;
        updatePosition();

        // Add vignette overlay
        const vignette = document.createElement('div');
        vignette.className = 'vignette';
        document.body.appendChild(vignette);

        // Event listeners
        document.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('mouseleave', handleDragEnd);

        document.addEventListener('touchstart', handleDragStart, { passive: false });
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);

        window.addEventListener('resize', updatePosition);

        console.log(`Initialized with ${gridCells.size} cells, ${allAlbums.length} albums available`);

    } catch (error) {
        console.error('Failed to initialize:', error);
        loadingMessage.textContent = 'Something went wrong. Please refresh.';
    }
}

document.addEventListener('DOMContentLoaded', init);
