document.addEventListener('DOMContentLoaded', () => {
    // --- App Globals ---
    const galleryGrid = document.querySelector('.masonry-grid');
    const bentoTagsContainer = document.querySelector('.bento-tags');
    const loadingSentinel = document.getElementById('loading-sentinel');
    const heroCard = document.querySelector('.bento-featured');
    const heroTitle = document.getElementById('hero-title');
    const appBg = document.getElementById('app-background');
    const scrollContainer = document.getElementById('scroll-container');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-lightbox');

    // --- State & Config ---
    let currentTag = 'waifu';
    let isLoading = false;
    const BATCH_SIZE = 15;

    // Masonry State
    let masonryCols = [];
    let allLoadedImages = [];

    const imageTags = ['maid', 'uniform', 'marin-kitagawa', 'mori-calliope', 'ganyu', 'hutao', 'neko', 'kitsune', 'oppai', 'selfies', 'raiden-shogun', 'waifu'];

    // --- App Init ---
    async function init() {
        // Theme Init
        initTheme();

        // Content Init
        renderTags(imageTags);
        fetchHero();
        fetchImages(currentTag);

        // Listeners
        setupTagListeners();
        updateClock();
        setInterval(updateClock, 1000);

        // Scroll Button
        document.querySelector('.action-btn').addEventListener('click', () => {
            document.querySelector('.gallery-section').scrollIntoView({ behavior: 'smooth' });
        });
    }

    // --- Theme Logic ---
    function initTheme() {
        const themeBtn = document.getElementById('theme-toggle');
        const themeIcon = themeBtn.querySelector('ion-icon');

        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            themeIcon.setAttribute('name', 'sunny-outline');
        }

        themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            themeIcon.setAttribute('name', isDark ? 'sunny-outline' : 'moon-outline');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // --- Hero Logic ---
    async function fetchHero() {
        try {
            // Priority: Landscape Waifu
            let res = await fetch('https://api.waifu.im/search?included_tags=waifu&height=>=1080&orientation=landscape');
            let data = await res.json();

            // Fallback: Generic if explicit landscape fails
            if (!data.images || data.images.length === 0) {
                res = await fetch('https://api.waifu.im/search?included_tags=waifu');
                data = await res.json();
            }

            if (data.images && data.images.length > 0) {
                const imgData = data.images[0];
                if (heroCard) heroCard.style.backgroundImage = `url(${imgData.url})`;
                if (appBg) appBg.style.backgroundImage = `url(${imgData.url})`;

                // Dynamic Color (Simulated)
                if (imgData.dominant_color) {
                    document.documentElement.style.setProperty('--accent', imgData.dominant_color);
                    document.getElementById('cursor').style.background = imgData.dominant_color;
                    if (heroTitle) heroTitle.style.textShadow = `0 0 20px ${imgData.dominant_color}`;
                }
            }
        } catch (e) {
            console.warn("Hero fetch error, using backup", e);
            // Ultimate Backup
            if (heroCard) heroCard.style.backgroundImage = `url('https://cdn.waifu.im/7349.jpg')`;
            if (appBg) appBg.style.backgroundImage = `url('https://cdn.waifu.im/7349.jpg')`;
        }
    }

    // --- Tag & Gallery Logic ---
    function renderTags(tags) {
        if (!bentoTagsContainer) return;
        bentoTagsContainer.innerHTML = tags.map(t =>
            `<button class="bento-tag ${t === currentTag ? 'active' : ''}" data-tag="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`
        ).join('');
    }

    function setupTagListeners() {
        // Use delegation for robustness
        const container = document.querySelector('.bento-tags');
        const chipsContainer = document.querySelector('.filter-chips');

        function handleTagClick(e) {
            const btn = e.target.closest('.bento-tag, .chip');
            if (!btn) return;

            let tag = btn.dataset.tag || btn.innerText.toLowerCase();
            if (tag === 'all') tag = 'waifu'; // Handle 'All' button

            if (tag === currentTag && btn.classList.contains('active')) return;

            clearGallery(); // Use helper
            currentTag = tag;

            document.querySelectorAll('.bento-tag, .chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            fetchImages(currentTag);
            document.querySelector('.gallery-section').scrollIntoView({ behavior: 'smooth' });
        }

        if (container) container.addEventListener('click', handleTagClick);
        if (chipsContainer) chipsContainer.addEventListener('click', handleTagClick);
    }

    // --- Search Modal Logic ---
    const searchModal = document.getElementById('search-modal');
    const searchBtn = document.getElementById('nav-search');
    const searchInput = document.getElementById('modal-search-input');

    function clearGallery() {
        allLoadedImages = []; // Clear buffer
        const grid = document.getElementById('gallery-grid');
        if (grid) grid.innerHTML = '';
        masonryCols = []; // Force rebuild
        setupMasonry(); // Re-scaffold
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset active state
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            searchBtn.classList.add('active');

            if (searchModal) {
                searchModal.classList.remove('hidden');
                if (searchInput) setTimeout(() => searchInput.focus(), 100);
            }
        });
    }

    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal || e.target.classList.contains('search-backdrop') || e.target.closest('.close-search')) {
                searchModal.classList.add('hidden');
                // Revert to home
                document.getElementById('nav-home').classList.add('active');
                searchBtn.classList.remove('active');
            }
        });
    }



    // if (searchInput) {
    //     searchInput.addEventListener('keypress', (e) => {
    //         if (e.key === 'Enter') {
    //             const query = searchInput.value.trim();
    //             if (query) {
    //                 clearGallery(); // CLEAN RESET
    //                 currentTag = query;
    //                 fetchImages(query);
    //                 searchModal.classList.add('hidden');
    //                 // Keep Search Tab active as we are viewing results
    //             }
    //         }
    //     });
    // }

    async function fetchImages(query = currentTag) {
        if (isLoading) return;
        isLoading = true;

        const sentinel = document.getElementById('loading-sentinel');
        if (sentinel) sentinel.classList.add('active');

        // Normalize query
        query = query.toLowerCase();
        console.log(`Fetching images for: ${query}`);

        try {
            let images = [];
            let found = false;

            // Layer 1: NekosAPI V4 (Tag Search)
            try {
                let endpoint = `https://api.nekosapi.com/v4/images/random?limit=${BATCH_SIZE}&rating=safe`;

                // If specifically searching a tag (not default view)
                if (query !== 'waifu' && query !== 'all') {
                    endpoint += `&tags=${encodeURIComponent(query)}`;
                }

                console.log(`Calling V4: ${endpoint}`);
                const res = await fetch(endpoint);

                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json) && json.length > 0) {
                        images = json.map(item => ({
                            url: item.url,
                            artist: item.artist_name || 'Unknown',
                            source: item.source_url || '#',
                            tags: item.tags || [],
                            width: 0,
                            height: 0,
                            color: item.color_dominant ? `rgb(${item.color_dominant.join(',')})` : '#ffffff'
                        }));
                        found = true;
                        console.log(`V4 Success: ${images.length} images`);
                    } else {
                        console.warn("V4 returned empty array");
                    }
                } else {
                    console.warn(`V4 Error Status: ${res.status}`);
                }
            } catch (e) {
                console.warn("V4 Failed:", e.message);
            }

            // Layer 2: Waifu.im Fallback
            if (!found) {
                console.log("Attempting Layer 2: Waifu.im");
                try {
                    let wTag = query;
                    if (query === 'all') wTag = 'waifu';

                    const res = await fetch(`https://api.waifu.im/search?included_tags=${wTag}&limit=${BATCH_SIZE}`);
                    const json = await res.json();

                    if (json.images && json.images.length > 0) {
                        images = json.images.map(item => ({
                            url: item.url,
                            artist: item.artist ? item.artist.name : 'Unknown',
                            source: item.source || '#',
                            tags: item.tags ? item.tags.map(t => t.name) : [],
                            width: item.width,
                            height: item.height,
                            color: item.dominant_color || '#ffffff'
                        }));
                        found = true;
                        console.log(`Waifu.im Success: ${images.length} images`);
                    } else {
                        throw new Error("No results on Waifu.im");
                    }

                } catch (e2) {
                    console.warn("Waifu.im Failed:", e2.message);
                }
            }

            // Layer 3: Ultimate Fallback (Random Waifu)
            if (!found && images.length === 0) {
                console.log("Triggering Ultimate Fallback");
                const res = await fetch(`https://api.waifu.im/search?included_tags=waifu&limit=${BATCH_SIZE}`);
                const json = await res.json();
                images = json.images.map(item => ({
                    url: item.url,
                    artist: item.artist ? item.artist.name : 'Unknown',
                    source: item.source || '#',
                    tags: ['waifu'],
                    width: item.width,
                    height: item.height,
                    color: item.dominant_color || '#ffffff'
                }));
            }

            await renderImagesSequential(images);

        } catch (error) {
            console.error("Critical Fetch Error:", error);
        } finally {
            isLoading = false;
            const sentinel = document.getElementById('loading-sentinel');
            if (sentinel) sentinel.classList.remove('active');
        }
    }

    // --- Masonry Logic ---
    function setupMasonry() {
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;

        // Determine columns
        const width = window.innerWidth;
        let colCount = 4;
        if (width < 900) colCount = 2;

        // Check if we need to rebuild
        if (masonryCols.length === colCount) return;

        console.log(`Setting up Masonry: ${colCount} columns`);

        grid.innerHTML = '';
        masonryCols = [];

        for (let i = 0; i < colCount; i++) {
            const col = document.createElement('div');
            col.className = 'masonry-col';
            grid.appendChild(col);
            masonryCols.push(col);
        }

        // If we have existing images, re-distribute them
        if (allLoadedImages.length > 0) {
            renderImagesToCols(allLoadedImages);
        }
    }

    // Helper to render existing buffer without fetching
    function renderImagesToCols(images) {
        // Initialize virtual heights if needed
        if (typeof masonryCols[0].virtualHeight === 'undefined') {
            masonryCols.forEach(c => c.virtualHeight = 0);
        }

        images.forEach(imgData => {
            // Calculate Aspect Ratio (Height / Width)
            // Default to 1.4 (typical anime portrait) if missing
            let aspectRatio = 1.4;
            if (imgData.width && imgData.height) {
                aspectRatio = imgData.height / imgData.width;
            }

            // Find column with lowest VIRTUAL height
            let shortestCol = masonryCols[0];
            let minH = shortestCol.virtualHeight;

            for (let i = 1; i < masonryCols.length; i++) {
                if (masonryCols[i].virtualHeight < minH) {
                    minH = masonryCols[i].virtualHeight;
                    shortestCol = masonryCols[i];
                }
            }

            // Update virtual height immediately
            shortestCol.virtualHeight += aspectRatio;

            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.onclick = () => openLightbox(imgData); // Move click to container
            item.style.backgroundColor = 'rgba(255,255,255,0.05)';

            const img = document.createElement('img');
            img.src = imgData.url;
            img.alt = `Art by ${imgData.artist}`;
            img.loading = 'lazy';

            // Card Download Button
            const dBtn = document.createElement('button');
            dBtn.className = 'card-download-btn';
            dBtn.innerHTML = '<ion-icon name="download-outline"></ion-icon>';
            dBtn.title = "Download";
            dBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent Lightbox open
                forceDownload(imgData.url);
            };

            item.appendChild(img);
            item.appendChild(dBtn);
            if (shortestCol) shortestCol.appendChild(item);
        });
    }

    // Helper: Force Download
    async function forceDownload(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `waifu_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            // Show simple toast or feedback? (Optional)
        } catch (err) {
            console.error("Download failed", err);
            window.open(url, '_blank');
        }
    }



    async function renderImagesSequential(images) {
        if (!images || !galleryGrid) return;
        if (images.length === 0) return;

        // Ensure Masonry is setup
        if (masonryCols.length === 0) setupMasonry();

        // Use the pure renderer
        renderImagesToCols(images);

        // Update buffer for resizing
        allLoadedImages = [...allLoadedImages, ...images];
    }

    // Debounced Resize Handler
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Force rebuild if column count changes
            const grid = document.getElementById('gallery-grid');
            const width = window.innerWidth;
            let targetCols = 4;
            if (width < 900) targetCols = 2;

            if (masonryCols.length !== targetCols) {
                // Reset cols to force rebuild in setupMasonry
                masonryCols = [];
                setupMasonry(); // will re-render allLoadedImages
            }
        }, 100); // 100ms debounce
    });

    // Initialize Masonry on Load
    setupMasonry();

    // --- Infinite Scroll ---
    const observerScroll = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            fetchImages(currentTag);
        }
    }, { root: null, rootMargin: '600px' });

    if (loadingSentinel) observerScroll.observe(loadingSentinel);

    // --- Clock Logic ---
    function updateClock() {
        const now = new Date();
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');

        if (timeEl) timeEl.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (dateEl) dateEl.innerText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // --- Lightbox Logic ---
    function openLightbox(imgData) {
        if (!lightbox) return;

        lightbox.classList.remove('hidden');
        if (lightboxImg) lightboxImg.src = imgData.url;

        // Apply Dynamic Color Scheme
        const accentColor = imgData.color || '#ffffff';
        lightbox.style.setProperty('--dynamic-accent', accentColor);

        // Populate Sidebar
        const artistEl = document.getElementById('lb-artist');
        const sourceEl = document.getElementById('lb-source');
        const tagsContainer = document.getElementById('lb-tags');

        if (artistEl) artistEl.innerText = imgData.artist || 'Unknown Artist';
        if (sourceEl) {
            sourceEl.href = imgData.source || '#';
            sourceEl.innerText = imgData.source ? 'Open Source' : 'No Source';
        }

        // Tags
        // Tags
        if (tagsContainer) {
            tagsContainer.innerHTML = '';
            if (imgData.tags && imgData.tags.length > 0) {
                imgData.tags.forEach(tag => {
                    const sp = document.createElement('span');
                    sp.className = 'lb-tag';
                    sp.innerText = tag;
                    tagsContainer.appendChild(sp);
                });
            } else {
                tagsContainer.innerHTML = '<span class="lb-tag">No tags</span>';
            }
        }

        // Download Button Logic
        const downloadBtn = document.getElementById('lb-download');
        if (downloadBtn) {
            // Remove old listeners (cloning is a quick hack, or just overwriting onclick)
            const newBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

            newBtn.href = imgData.url; // Fallback
            newBtn.onclick = async (e) => {
                e.preventDefault();
                // Add Loading Spinner / Text
                newBtn.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon> Downloading...';
                newBtn.style.opacity = '0.8';
                newBtn.style.pointerEvents = 'none';

                await forceDownload(imgData.url);

                // Restore Button
                newBtn.innerHTML = '<ion-icon name="download-outline"></ion-icon> Download';
                newBtn.style.opacity = '1';
                newBtn.style.pointerEvents = 'auto';
            };
        }
    }

    if (lightbox) {
        lightbox.onclick = (e) => {
            if (e.target === lightbox || e.target.classList.contains('lightbox-backdrop') || e.target.closest('.close-lightbox')) {
                lightbox.classList.add('hidden');
            }
        };
    }

    // --- About Modal Logic ---
    const aboutModal = document.getElementById('about-modal');
    const aboutBtn = document.getElementById('nav-about');
    const closeAboutBtn = document.querySelector('.close-about');

    if (aboutBtn) {
        aboutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset active state on nav
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            aboutBtn.classList.add('active');

            if (aboutModal) aboutModal.classList.remove('hidden');
        });
    }

    if (aboutModal) {
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal || e.target.classList.contains('about-backdrop') || e.target.closest('.close-about')) {
                aboutModal.classList.add('hidden');
                // Revert active state to home
                document.getElementById('nav-home').classList.add('active');
                aboutBtn.classList.remove('active');
            }
        });
    }

    // --- Cursor Logic ---
    const cursor = document.getElementById('cursor');
    const cursorBlur = document.getElementById('cursor-blur');
    document.addEventListener('mousemove', (e) => {
        if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
        if (cursorBlur) { cursorBlur.style.left = e.clientX + 'px'; cursorBlur.style.top = e.clientY + 'px'; }
    });

    // START
    init();
});
