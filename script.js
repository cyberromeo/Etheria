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
            // Priority: Safebooru landscape
            let res = await fetch('https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=1girl+landscape&limit=1');
            let data = await res.json();

            // Fallback: Any safe image
            if (!data || data.length === 0) {
                res = await fetch('https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=1girl&limit=1');
                data = await res.json();
            }

            if (data && data.length > 0) {
                const imgData = data[0];
                const imgUrl = imgData.file_url || imgData.sample_url;
                if (heroCard) heroCard.style.backgroundImage = `url(${imgUrl})`;
                if (appBg) appBg.style.backgroundImage = `url(${imgUrl})`;

                // Set accent color based on tags
                const tags = imgData.tags || '';
                let accentColor = '#e74c3c'; // default red
                if (tags.includes('blue')) accentColor = '#3498db';
                else if (tags.includes('green')) accentColor = '#2ecc71';
                else if (tags.includes('pink')) accentColor = '#e91e63';
                else if (tags.includes('purple')) accentColor = '#9b59b6';

                document.documentElement.style.setProperty('--accent', accentColor);
                document.getElementById('cursor').style.background = accentColor;
                if (heroTitle) heroTitle.style.textShadow = `0 0 20px ${accentColor}`;
            }
        } catch (e) {
            console.warn("Hero fetch error, using backup", e);
            // Ultimate Backup
            if (heroCard) heroCard.style.backgroundImage = `url('https://cdn.nekos.life/waifu/5df7f640-7912-48f3-94fb-041de83cc74f.jpg')`;
            if (appBg) appBg.style.backgroundImage = `url('https://cdn.nekos.life/waifu/5df7f640-7912-48f3-94fb-041de83cc74f.jpg')`;
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

            console.log('Tag clicked:', tag); // Debugging
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

    async function fetchImages(query = currentTag) {
        if (isLoading) return;
        isLoading = true;

        const sentinel = document.getElementById('loading-sentinel');
        if (sentinel) sentinel.classList.add('active');

        // Normalize query
        query = query.toLowerCase();
        console.log(`Fetching images for: ${query}`);

        // Map user tags to booru tags
        const tagMap = {
            'waifu': '1girl',
            'maid': 'maid',
            'uniform': 'uniform',
            'marin-kitagawa': '1girl',
            'mori-calliope': '1girl',
            'ganyu': '1girl',
            'hutao': '1girl',
            'neko': 'cat_ears',
            'kitsune': 'fox_ears',
            'oppai': '1girl',
            'selfies': 'selfie',
            'raiden-shogun': '1girl'
        };
        const booruTag = tagMap[query] || '1girl';

        try {
            let images = [];
            let found = false;

            // Layer 1: Safebooru (High quality, safe content)
            try {
                const endpoint = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${booruTag}+sort:score&limit=${BATCH_SIZE}`;
                console.log(`Calling Safebooru: ${endpoint}`);
                const res = await fetch(endpoint);

                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json) && json.length > 0) {
                        images = json.map(item => ({
                            url: item.file_url || item.sample_url,
                            artist: item.owner || 'Unknown',
                            source: item.source || '#',
                            tags: item.tags ? item.tags.split(' ') : [],
                            width: item.width || 0,
                            height: item.height || 0,
                            color: '#ffffff'
                        }));
                        found = true;
                        console.log(`Safebooru Success: ${images.length} images`);
                    } else {
                        console.warn("Safebooru returned empty array");
                    }
                } else {
                    console.warn(`Safebooru Error Status: ${res.status}`);
                }
            } catch (e) {
                console.warn("Safebooru Failed:", e.message);
            }

            // Layer 2: Danbooru (High quality fallback)
            if (!found) {
                console.log("Attempting Layer 2: Danbooru");
                try {
                    const endpoint = `https://danbooru.donmai.us/posts.json?tags=${booruTag}+rating:general&limit=${BATCH_SIZE}`;
                    const res = await fetch(endpoint);

                    if (res.ok) {
                        const json = await res.json();
                        if (Array.isArray(json) && json.length > 0) {
                            images = json.filter(item => item.file_url).map(item => ({
                                url: item.file_url,
                                artist: item.uploader_name || 'Unknown',
                                source: item.source || '#',
                                tags: item.tag_string ? item.tag_string.split(' ') : [],
                                width: item.image_width || 0,
                                height: item.image_height || 0,
                                color: '#ffffff'
                            }));
                            found = true;
                            console.log(`Danbooru Success: ${images.length} images`);
                        } else {
                            throw new Error("No results on Danbooru");
                        }
                    }
                } catch (e2) {
                    console.warn("Danbooru Failed:", e2.message);
                }
            }

            // Layer 3: nekos.life fallback (single images)
            if (!found && images.length === 0) {
                console.log("Triggering Ultimate Fallback: nekos.life");
                try {
                    const categories = ['waifu', 'neko', 'megumin'];
                    for (const cat of categories) {
                        const res = await fetch(`https://nekos.life/api/v2/img/${cat}`);
                        const json = await res.json();
                        if (json.url) {
                            images.push({
                                url: json.url,
                                artist: 'Unknown',
                                source: '#',
                                tags: [cat],
                                width: 0,
                                height: 0,
                                color: '#ffffff'
                            });
                        }
                        if (images.length >= BATCH_SIZE) break;
                    }
                } catch (e3) {
                    console.warn("Layer 3 Failed:", e3.message);
                }
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
            item.onclick = () => openLightbox(imgData);
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
                e.stopPropagation();
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
                masonryCols = [];
                setupMasonry();
            }
        }, 100);
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
            const newBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

            newBtn.href = imgData.url;
            newBtn.onclick = async (e) => {
                e.preventDefault();
                newBtn.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon> Downloading...';
                newBtn.style.opacity = '0.8';
                newBtn.style.pointerEvents = 'none';

                await forceDownload(imgData.url);

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
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            aboutBtn.classList.add('active');

            if (aboutModal) aboutModal.classList.remove('hidden');
        });
    }

    if (aboutModal) {
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal || e.target.classList.contains('about-backdrop') || e.target.closest('.close-about')) {
                aboutModal.classList.add('hidden');
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