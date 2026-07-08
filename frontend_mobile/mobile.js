document.addEventListener("DOMContentLoaded", async () => {
    // Dismiss splash screen quickly so app feels instant
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');
    }, 500);

    // ==========================================
    // 0. API URL DETERMINATION & TOAST SYSTEM
    // ==========================================
    const isLocal = window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1" || 
                    window.location.protocol === "file:" ||
                    /^192\.168\./.test(window.location.hostname) ||
                    /^10\./.test(window.location.hostname) ||
                    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

    const API_URL = isLocal 
        ? (window.location.protocol === "file:" ? "http://127.0.0.1:8000" : `${window.location.protocol}//${window.location.hostname}:8000`)
        : "https://waypoint-rit.onrender.com";

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-info-circle';
        if (type === 'warning') icon = 'fa-triangle-exclamation';
        if (type === 'error') icon = 'fa-circle-xmark';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ==========================================
    // 1. MOBILE BOTTOM SHEETS SYSTEM
    // ==========================================
    const sheets = {
        building: document.getElementById('building-bottom-sheet'),
        updates: document.getElementById('updates-bottom-sheet'),
        menu: document.getElementById('menu-bottom-sheet')
    };

    function closeAllSheets() {
        Object.values(sheets).forEach(sheet => {
            if (sheet) sheet.classList.remove('open');
        });
        const slideBtn = document.getElementById('slide-info-btn');
        if (slideBtn && activeBuildingId) {
            slideBtn.innerHTML = '<i class="fa-solid fa-building"></i> Show Info';
        }
    }

    function openSheet(sheetKey) {
        closeAllSheets();
        const target = sheets[sheetKey];
        if (target) target.classList.add('open');
        hideDashboard(); // Hide landing overlay when sheet opens
        if (sheetKey === 'building') {
            const slideBtn = document.getElementById('slide-info-btn');
            if (slideBtn && activeBuildingId) {
                slideBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Hide Info';
            }
        }
    }

    // Connect close buttons
    document.getElementById('close-sheet-btn').onclick = closeAllSheets;
    document.getElementById('close-updates-btn').onclick = closeAllSheets;
    document.getElementById('close-menu-btn').onclick = closeAllSheets;

    function deselectBuilding() {
        if (!window.outdoorMap) return;
        window.outdoorMap.flyTo({
            center: ritCenter,
            zoom: 17.2,
            pitch: 55,
            bearing: -20,
            duration: 1500
        });
        window.outdoorMap.setFilter('indoor-rooms', ['==', ['get', 'level'], -1]);
        window.outdoorMap.setFilter('indoor-walls', ['==', ['get', 'level'], -1]);
        window.outdoorMap.setFilter('indoor-furniture', ['==', ['get', 'level'], -1]);
        window.outdoorMap.setFilter('indoor-floor-plate', ['==', ['get', 'id'], -1]);
        window.outdoorMap.setFilter('building-shells', ['==', ['get', 'type'], 'building']);

        roomMarkersList.forEach(m => m.remove());
        roomMarkersList = [];

        const floorWidget = document.getElementById('floor-widget-container');
        if (floorWidget) floorWidget.style.display = 'none';

        const exitBtn = document.getElementById('exit-building-btn');
        if (exitBtn) exitBtn.style.display = 'none';
        const slideBtn = document.getElementById('slide-info-btn');
        if (slideBtn) slideBtn.style.display = 'none';

        closeAllSheets();
        activeBuildingId = null;
    }

    const exitBtnElem = document.getElementById('exit-building-btn');
    if (exitBtnElem) exitBtnElem.onclick = deselectBuilding;
    const sheetDismissElem = document.getElementById('sheet-dismiss-btn');
    if (sheetDismissElem) sheetDismissElem.onclick = deselectBuilding;

    const slideInfoBtn = document.getElementById('slide-info-btn');
    if (slideInfoBtn) {
        slideInfoBtn.addEventListener('click', () => {
            const sheet = document.getElementById('building-bottom-sheet');
            if (sheet && sheet.classList.contains('open')) {
                sheet.classList.remove('open');
                slideInfoBtn.innerHTML = '<i class="fa-solid fa-building"></i> Show Info';
            } else if (sheet) {
                sheet.classList.add('open');
                slideInfoBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Hide Info';
            }
        });
    }

    // Handle touch swipe-down on handles to close sheets
    document.querySelectorAll('.bottom-sheet-handle').forEach(handle => {
        let startY = 0;
        handle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        });
        handle.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            if (currentY - startY > 40) { // Dragged down
                closeAllSheets();
            }
        });
    });

    // ==========================================
    // 2. DASHBOARD / MAP STATE TOGGLE
    // ==========================================
    const dashboard = document.getElementById('home-dashboard');
    const mapSearch = document.getElementById('map-search-wrapper');
    const mapControls = document.getElementById('map-floating-controls');

    function showDashboard() {
        dashboard.classList.remove('hidden');
        mapSearch.classList.add('hidden');
        mapControls.classList.add('hidden');
        closeAllSheets();
        setNavActive('explore');
    }

    function hideDashboard() {
        dashboard.classList.add('hidden');
        mapSearch.classList.remove('hidden');
        mapControls.classList.remove('hidden');
    }

    // Hook grid card events
    document.getElementById('card-map').onclick = () => {
        hideDashboard();
        showToast("Entering 3D Map View", "info");
    };

    document.getElementById('card-scan').onclick = () => {
        startScanner();
    };

    document.getElementById('card-staff').onclick = () => {
        showToast("Staff Directory: Coming Soon!", "warning");
    };

    document.getElementById('card-events').onclick = () => {
        showToast("Campus Events: Coming Soon!", "warning");
    };

    // Dashboard search input enter key triggers main map search
    const dashboardSearch = document.getElementById('dashboard-search-bar');
    dashboardSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = dashboardSearch.value;
            if (val.trim()) {
                hideDashboard();
                locateLocation(val);
                dashboardSearch.value = '';
            }
        }
    });

    // ==========================================
    // 3. BOTTOM NAVIGATION MANAGEMENT
    // ==========================================
    const navButtons = {
        explore: document.getElementById('nav-btn-explore'),
        scan: document.getElementById('nav-btn-scan'),
        updates: document.getElementById('nav-btn-updates'),
        menu: document.getElementById('nav-btn-menu')
    };

    function setNavActive(activeKey) {
        Object.keys(navButtons).forEach(key => {
            const btn = navButtons[key];
            if (btn) {
                if (key === activeKey) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    navButtons.explore.onclick = () => {
        showDashboard();
    };

    navButtons.updates.onclick = () => {
        openSheet('updates');
        setNavActive('updates');
        fetchAnnouncements();
    };

    navButtons.menu.onclick = () => {
        openSheet('menu');
        setNavActive('menu');
        populateMenuDirectories();
    };

    navButtons.scan.onclick = () => {
        closeAllSheets();
        startScanner();
    };

    // ==========================================
    // 4. MAP INITIALIZATION & CAMERA SETTINGS
    // ==========================================
    mapboxgl.accessToken = 'pk.eyJ1IjoibGVlbGFrcmlzaG5hOTEiLCJhIjoiY21ubGRyd3Y0MTE0dDJvcXVtcTVtZmpsdSJ9.' + '82mSmhy8H3hZ-x-wCsCtzw';
    const ritCenter = [80.0447, 13.0390];
    const ritBounds = [
        [80.036, 13.034],
        [80.053, 13.045]
    ];

    let currentTheme = 'light'; // Light theme is default from mockup
    window.outdoorMap = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/light-v11', // default light map matching mockup
        center: ritCenter,
        zoom: 17.2,
        minZoom: 16.0,
        maxBounds: ritBounds,
        pitch: 55,
        maxPitch: 75,
        minPitch: 0,
        bearing: -20,
        antialias: true
    });

    let activeBuildingId = null;
    let is3D = true;
    let markersList = [];
    let roomMarkersList = [];
    let activeSearchRoomId = "";
    let buildingsData = [];
    let roomsData = [];

    // ==========================================
    // 5. MAP GEOLOCATION ACCURACY (GPS TRACKER)
    // ==========================================
    let userLocationMarker = null;
    let watchId = null;
    let isTrackingLocation = false;

    const locateBtn = document.getElementById('locate-btn');
    locateBtn.onclick = toggleLocationTracking;

    function toggleLocationTracking() {
        if (isTrackingLocation) {
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
            if (userLocationMarker) {
                userLocationMarker.remove();
                userLocationMarker = null;
            }
            isTrackingLocation = false;
            locateBtn.style.backgroundColor = '';
            locateBtn.style.color = '';
            showToast("Location tracking paused.", "info");
        } else {
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your device.", "error");
                return;
            }

            locateBtn.style.backgroundColor = 'var(--color-navy)';
            locateBtn.style.color = 'var(--color-white)';
            showToast("Locating your device...", "info");

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    const inLatitude = latitude > 13.033 && latitude < 13.047;
                    const inLongitude = longitude > 80.035 && longitude < 80.055;

                    if (!userLocationMarker) {
                        const pulseDot = document.createElement('div');
                        pulseDot.className = 'glowing-pin';
                        
                        userLocationMarker = new mapboxgl.Marker(pulseDot)
                            .setLngLat([longitude, latitude])
                            .addTo(window.outdoorMap);
                    } else {
                        userLocationMarker.setLngLat([longitude, latitude]);
                    }

                    if (inLatitude && inLongitude) {
                        window.outdoorMap.easeTo({
                            center: [longitude, latitude],
                            zoom: 18,
                            duration: 1000
                        });
                    } else {
                        showToast("Located! (Outside RIT campus range)", "warning");
                    }

                    isTrackingLocation = true;
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(err => console.warn("Kiosk fullscreen restore failed:", err));
                    }
                },
                (error) => {
                    console.error("GPS Error: ", error);
                    showToast("Failed to acquire GPS coordinates.", "error");
                    locateBtn.style.backgroundColor = '';
                    locateBtn.style.color = '';
                    isTrackingLocation = false;
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(err => console.warn("Kiosk fullscreen restore failed:", err));
                    }
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        }
    }

    // ==========================================
    // 6. 3D X-RAY DATA ENGINE
    // ==========================================
    async function renderCustomLayers() {
        markersList.forEach(m => m.remove());
        markersList = [];

        // Clear if updating
        const layersToRemove = [
            'world-mask-layer',
            'campus-wall-layer',
            'indoor-furniture',
            'indoor-walls',
            'indoor-rooms',
            'indoor-floor-plate',
            'building-shells'
        ];
        layersToRemove.forEach(layerId => {
            if (window.outdoorMap.getLayer(layerId)) {
                window.outdoorMap.removeLayer(layerId);
            }
        });

        const sourcesToRemove = ['world-mask', 'campus-wall', 'custom-campus'];
        sourcesToRemove.forEach(sourceId => {
            if (window.outdoorMap.getSource(sourceId)) {
                window.outdoorMap.removeSource(sourceId);
            }
        });

        window.outdoorMap.addSource('world-mask', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
                        [
                            [80.036, 13.034],
                            [80.053, 13.034],
                            [80.053, 13.045],
                            [80.036, 13.045],
                            [80.036, 13.034]
                        ]
                    ]
                }
            }
        });

        const maskColor = currentTheme === 'dark' ? '#111318' : '#F4F7FA';
        window.outdoorMap.addLayer({
            'id': 'world-mask-layer',
            'type': 'fill',
            'source': 'world-mask',
            'paint': {
                'fill-color': maskColor,
                'fill-opacity': 0.95
            }
        });

        // PERIMETER WALL
        if (window.outdoorMap.getSource('campus-wall')) {
            if (window.outdoorMap.getLayer('campus-wall-layer')) window.outdoorMap.removeLayer('campus-wall-layer');
            window.outdoorMap.removeSource('campus-wall');
        }

        try {
            const perimeterCoords = [
                [80.04517942787868, 13.03747050944169], [80.04543346131385, 13.037396519025336],
                [80.04543869911623, 13.037427135752111], [80.04557130278579, 13.03752731734356],
                [80.04568235446357, 13.037657482254133], [80.04578646541194, 13.03787893149142],
                [80.04587541220235, 13.038261871883037], [80.04597611642913, 13.038524661118132],
                [80.0459617301101, 13.038745403859934], [80.04621529361657, 13.039232203222852],
                [80.04617403819765, 13.03994359494736], [80.0462400468682, 13.040232974047413],
                [80.0461462501471, 13.040932560732585], [80.04554107095794, 13.04136698114526],
                [80.04426700950825, 13.041273891121037], [80.0436936818553, 13.041273891121037],
                [80.04329553765149, 13.041118741002833], [80.04343886956559, 13.04048262449976],
                [80.04372763100929, 13.040403555114011], [80.04366460218915, 13.039886011785597],
                [80.04433090685399, 13.039675485376378], [80.04428588626797, 13.039140396612567],
                [80.04436692332229, 13.038964957421925], [80.04422285744909, 13.03854390285548],
                [80.04406332760226, 13.038202280046647], [80.04413175948304, 13.038062277844304],
                [80.0442275641156, 13.037935609116772], [80.04517942787868, 13.03747050944169]
            ];

            const borderLine = turf.lineString(perimeterCoords);
            const wallPolygon = turf.buffer(borderLine, 0.5, { units: 'meters' });
            const entrance = turf.point([80.04520562488239, 13.037528246529249]);
            const gapPolygon = turf.buffer(entrance, 20, { units: 'meters' });
            const finishedWall = turf.difference(wallPolygon, gapPolygon);

            window.outdoorMap.addSource('campus-wall', {
                'type': 'geojson',
                'data': finishedWall
            });

            const wallColor = currentTheme === 'dark' ? '#1E293B' : '#E2E8F0';
            const showWall = document.getElementById('boundary-toggle').checked;
            const isVisible = showWall ? 'visible' : 'none';

            window.outdoorMap.addLayer({
                'id': 'campus-wall-layer',
                'type': 'fill-extrusion',
                'source': 'campus-wall',
                'layout': {
                    'visibility': isVisible
                },
                'paint': {
                    'fill-extrusion-color': wallColor,
                    'fill-extrusion-height': 1.5,
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.9
                }
            });
        } catch (e) {
            console.warn("Failed to generate perimeter wall.", e);
        }

        // CAMPUS SOURCE DATA
        window.outdoorMap.addSource('custom-campus', {
            'type': 'geojson',
            'data': { 'type': 'FeatureCollection', 'features': [] }
        });

        // Shell Layer
        const shellColor = currentTheme === 'dark' ? '#1E293B' : ['get', 'color'];
        window.outdoorMap.addLayer({
            'id': 'building-shells',
            'type': 'fill-extrusion',
            'source': 'custom-campus',
            'filter': ['==', ['get', 'type'], 'building'],
            'paint': {
                'fill-extrusion-color': shellColor,
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    17.5, 0.95,
                    19.5, 0.05
                ]
            }
        });

        // LAYER 1.5: Indoor Floor Plate (to support indoor rooms)
        window.outdoorMap.addLayer({
            'id': 'indoor-floor-plate',
            'type': 'fill-extrusion',
            'source': 'custom-campus',
            'filter': ['all', ['==', ['get', 'type'], 'building'], ['==', ['get', 'id'], -1]],
            'paint': {
                'fill-extrusion-color': currentTheme === 'dark' ? '#1e293b' : '#f1f5f9',
                'fill-extrusion-base': 0,
                'fill-extrusion-height': 0.1,
                'fill-extrusion-opacity': 0.95
            }
        });

        // Rooms Layer
        window.outdoorMap.addLayer({
            'id': 'indoor-rooms',
            'type': 'fill-extrusion',
            'source': 'custom-campus',
            'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'level'], -1]],
            'paint': {
                'fill-extrusion-color': [
                    'coalesce',
                    ['get', 'color'],
                    [
                        'match',
                        ['get', 'room_type'],
                        'Classroom', '#f97316',
                        'Meeting', '#22c55e',
                        'Office', '#3b82f6',
                        'Facility', '#64748b',
                        'Restroom', '#64748b',
                        currentTheme === 'dark' ? '#0f172a' : '#e0e7ff'
                    ]
                ],
                'fill-extrusion-base': ['get', 'base_h'],
                'fill-extrusion-height': ['+', ['get', 'base_h'], 0.12],
                'fill-extrusion-opacity': 0.88
            }
        });

        // LAYER 2.5: Interior Room Walls
        window.outdoorMap.addLayer({
            'id': 'indoor-walls',
            'type': 'fill-extrusion',
            'source': 'custom-campus',
            'filter': ['all', ['==', ['get', 'type'], 'room-wall'], ['==', ['get', 'level'], -1]],
            'paint': {
                'fill-extrusion-color': currentTheme === 'dark' ? '#64748b' : '#e2e8f0',
                'fill-extrusion-base': ['get', 'base_h'],
                'fill-extrusion-height': ['+', ['get', 'base_h'], 2.6],
                'fill-extrusion-opacity': 1.0
            }
        });
        refreshCampusData().catch(err => console.error("Background data load failed:", err));
    }

    window.outdoorMap.on('style.load', renderCustomLayers);

    // Dynamic Database Fetching
    async function refreshCampusData() {
        try {
            const bRes = await fetch(`${API_URL}/admin/buildings`);
            buildingsData = await bRes.json();
            let features = [];

            buildingsData.forEach(b => {
                if (!b.footprint_coordinates) return;

                try {
                    let coords = JSON.parse(b.footprint_coordinates);
                    if (coords.length > 0 && typeof coords[0][0] === 'number') {
                        coords = [coords];
                    }

                    features.push({
                        'type': 'Feature',
                        'properties': {
                            'type': 'building', 'id': b.building_id, 'name': b.name,
                            'height': b.total_floors * 4, 'color': b.color || '#f8f9fa'
                        },
                        'geometry': { 'type': 'Polygon', 'coordinates': coords }
                    });

                    // Add Custom POI Markers matching mockup look
                    if (b.entrance_x && b.entrance_y) {
                        const el = document.createElement('div');
                        el.className = 'poi-marker';
                        
                        const bColor = b.color || '#0B2545';
                        el.innerHTML = `<i class="fa-solid ${b.icon || 'fa-building'}" style="background: var(--color-white); color: ${bColor}; border-color: ${bColor}; box-shadow: 0 4px 12px rgba(11, 37, 69, 0.1);"></i><br><span style="font-weight: 700;">${b.name}</span>`;

                        el.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            selectBuilding(b);
                        });

                        const m = new mapboxgl.Marker(el)
                            .setLngLat([b.entrance_y, b.entrance_x])
                            .addTo(window.outdoorMap);
                        markersList.push(m);
                    }
                } catch (err) {
                    console.error("Failed loading building features: ", err);
                }
            });

            // Rooms fetching
            try {
                const rRes = await fetch(`${API_URL}/admin/rooms`);
                if (rRes.ok) {
                    roomsData = await rRes.json();
                    roomsData.forEach(r => {
                        if (!r.footprint_coordinates) return;

                        try {
                            let coords = JSON.parse(r.footprint_coordinates);
                            if (coords.length > 0 && typeof coords[0][0] === 'number') {
                                coords = [coords];
                            }

                            const base_h = r.floor_level * 4;
                            const z_thick = r.z_coordinate !== null ? parseFloat(r.z_coordinate) : 3.5;
                            const ceil_h = base_h + z_thick;

                            features.push({
                                'type': 'Feature',
                                'properties': {
                                    'type': 'room',
                                    'id': r.room_id,
                                    'parent': r.building_id,
                                    'level': r.floor_level,
                                    'base_h': base_h,
                                    'ceil_h': ceil_h,
                                    'room_type': r.room_type,
                                    'color': r.color || null
                                },
                                'geometry': { 'type': 'Polygon', 'coordinates': coords }
                            });

                            // Generate 3D Walls for the room
                            try {
                                const outerRing = coords[0];
                                if (outerRing && outerRing.length >= 3) {
                                    const line = turf.lineString(outerRing);
                                    const bufferedWall = turf.buffer(line, 0.38, { units: 'meters' });
                                    features.push({
                                        'type': 'Feature',
                                        'properties': {
                                            'type': 'room-wall',
                                            'id': r.room_id + '_wall',
                                            'parent': r.building_id,
                                            'level': r.floor_level,
                                            'base_h': base_h,
                                            'ceil_h': ceil_h
                                        },
                                        'geometry': bufferedWall.geometry
                                    });
                                }
                            } catch (wallErr) {
                                console.error("Failed to generate wall for room: ", wallErr);
                            }
                        } catch (err) {
                            console.error("Failed loading room coordinates: ", err);
                        }
                    });
                }
            } catch (err) {
                console.log("No rooms loaded dynamically.");
            }

            window.outdoorMap.getSource('custom-campus').setData({ 'type': 'FeatureCollection', 'features': features });
            if (activeBuildingId !== null && window.outdoorMap.getLayer('building-shells')) {
                window.outdoorMap.setFilter('building-shells', ['!=', ['to-number', ['get', 'id']], parseInt(activeBuildingId)]);
            }
        } catch (e) {
            console.error("Server connections unavailable for map markers.", e);
        }
    }

    // ==========================================
    // 7. BUILDING SELECTION & BOTTOM SHEET POPULATION
    // ==========================================
    window.outdoorMap.on('click', 'building-shells', (e) => {
        const props = e.features[0].properties;
        const b = buildingsData.find(item => item.building_id === props.id);
        if (b) {
            selectBuilding(b);
        }
    });

    window.outdoorMap.on('mouseenter', 'building-shells', () => window.outdoorMap.getCanvas().style.cursor = 'pointer');
    window.outdoorMap.on('mouseleave', 'building-shells', () => window.outdoorMap.getCanvas().style.cursor = '');

    function selectBuilding(b) {
        activeBuildingId = b.building_id;
        
        // Hide active building shell to see inside (X-ray mode)
        window.outdoorMap.setFilter('building-shells', [
            'all',
            ['==', ['get', 'type'], 'building'],
            ['!=', ['to-number', ['get', 'id']], parseInt(activeBuildingId)]
        ]);
        
        window.outdoorMap.flyTo({
            center: [b.entrance_y, b.entrance_x],
            zoom: 19.2,
            pitch: 62,
            duration: 1500
        });

        // Set Details in Bottom Sheet
        document.getElementById('sheet-building-title').innerText = b.name;
        document.getElementById('sheet-building-subtitle').innerText = `Campus Block - ${b.total_floors} Stories`;
        document.getElementById('sheet-floors-count').innerText = b.total_floors;

        // Build Horizontal Floor buttons
        const floorContainer = document.getElementById('floor-list-mobile');
        floorContainer.innerHTML = '';

        for (let i = b.total_floors - 1; i >= 0; i--) {
            const btn = document.createElement('button');
            btn.className = 'floor-pill-btn';
            btn.innerText = i === 0 ? 'G' : i;
            if (i === 0) btn.classList.add('active');

            btn.onclick = () => {
                document.querySelectorAll('.floor-pill-btn').forEach(x => x.classList.remove('active'));
                btn.classList.add('active');

                 window.outdoorMap.setFilter('indoor-rooms', [
                    'all',
                    ['==', ['get', 'type'], 'room'],
                    ['==', ['to-number', ['get', 'level']], parseInt(i)],
                    ['==', ['to-number', ['get', 'parent']], parseInt(activeBuildingId)]
                ]);

                window.outdoorMap.setFilter('indoor-walls', [
                    'all',
                    ['==', ['get', 'type'], 'room-wall'],
                    ['==', ['to-number', ['get', 'level']], parseInt(i)],
                    ['==', ['to-number', ['get', 'parent']], parseInt(activeBuildingId)]
                ]);

                window.outdoorMap.setFilter('indoor-floor-plate', [
                    'all',
                    ['==', ['get', 'type'], 'building'],
                    ['==', ['to-number', ['get', 'id']], parseInt(activeBuildingId)]
                ]);
                const floatElevation = i * 4;
                window.outdoorMap.setPaintProperty('indoor-floor-plate', 'fill-extrusion-base', floatElevation);
                window.outdoorMap.setPaintProperty('indoor-floor-plate', 'fill-extrusion-height', floatElevation + 0.05);

                window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-base', floatElevation + 0.05);
                window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-height', floatElevation + 0.18);

                window.outdoorMap.setPaintProperty('indoor-walls', 'fill-extrusion-base', floatElevation + 0.05);
                window.outdoorMap.setPaintProperty('indoor-walls', 'fill-extrusion-height', floatElevation + 2.6);

                // Filter dynamic room list on the bottom sheet
                fetchRoomsForBuildingAndLevel(b.building_id, i);

                // Render room label markers
                renderRoomLabels(activeBuildingId, i);
            };

            floorContainer.appendChild(btn);
        }

        // Build vertical floating floor buttons widget matching mockup
        const verticalWidgetGroup = document.getElementById('floor-btn-group');
        verticalWidgetGroup.innerHTML = '';
        
        for (let i = 0; i < b.total_floors; i++) {
            const btn = document.createElement('button');
            btn.className = 'floor-btn';
            btn.innerText = i === 0 ? 'G' : i;
            if (i === 0) btn.classList.add('active');
            
            btn.onclick = () => {
                document.querySelectorAll('.floor-btn-group .floor-btn').forEach(x => x.classList.remove('active'));
                btn.classList.add('active');
                
                 window.outdoorMap.setFilter('indoor-rooms', [
                    'all',
                    ['==', ['get', 'type'], 'room'],
                    ['==', ['to-number', ['get', 'level']], parseInt(i)],
                    ['==', ['to-number', ['get', 'parent']], parseInt(activeBuildingId)]
                ]);

                window.outdoorMap.setFilter('indoor-walls', [
                    'all',
                    ['==', ['get', 'type'], 'room-wall'],
                    ['==', ['to-number', ['get', 'level']], parseInt(i)],
                    ['==', ['to-number', ['get', 'parent']], parseInt(activeBuildingId)]
                ]);

                window.outdoorMap.setFilter('indoor-floor-plate', [
                    'all',
                    ['==', ['get', 'type'], 'building'],
                    ['==', ['to-number', ['get', 'id']], parseInt(activeBuildingId)]
                ]);
                const floatElevation = i * 4;
                window.outdoorMap.setPaintProperty('indoor-floor-plate', 'fill-extrusion-base', floatElevation);
                window.outdoorMap.setPaintProperty('indoor-floor-plate', 'fill-extrusion-height', floatElevation + 0.05);

                window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-base', floatElevation + 0.05);
                window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-height', floatElevation + 0.18);

                window.outdoorMap.setPaintProperty('indoor-walls', 'fill-extrusion-base', floatElevation + 0.05);
                window.outdoorMap.setPaintProperty('indoor-walls', 'fill-extrusion-height', floatElevation + 2.6);
                
                // Keep bottom sheet horizontal slider in sync
                document.querySelectorAll('.floor-pill-btn').forEach(pill => {
                    if (pill.innerText === btn.innerText) {
                        pill.classList.add('active');
                    } else {
                        pill.classList.remove('active');
                    }
                });
                
                fetchRoomsForBuildingAndLevel(b.building_id, i);

                // Render room label markers
                renderRoomLabels(activeBuildingId, i);
            };
            verticalWidgetGroup.prepend(btn); // Stack G at the bottom
        }

        // Click first floor button (usually Ground)
        if (floorContainer.lastChild) {
            floorContainer.lastChild.click();
        }
        if (verticalWidgetGroup.lastChild) {
            verticalWidgetGroup.lastChild.classList.add('active');
        }

        // Show vertical floor widget on map and show dismiss button
        document.getElementById('floor-widget-container').style.display = 'flex';
        const exitBtn = document.getElementById('exit-building-btn');
        if (exitBtn) exitBtn.style.display = 'flex';
        const slideBtn = document.getElementById('slide-info-btn');
        if (slideBtn) {
            slideBtn.style.display = 'flex';
            slideBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Hide Info';
        }

        // Slide up Building Info Bottom Sheet
        openSheet('building');
        setNavActive('explore');
    }
    function updateRoomMarkerOffsets() {
        if (!window.outdoorMap || !window.outdoorMap.transform || !window.outdoorMap.transform.projMatrix || roomMarkersList.length === 0) return;
        const tr = window.outdoorMap.transform;
        const m = tr.projMatrix;

        roomMarkersList.forEach(item => {
            const marker = item.marker || item;
            const lng = item.lng;
            const lat = item.lat;
            const elevation = item.elevation || 0;

            if (marker && marker.setOffset && lng !== undefined && lat !== undefined && !isNaN(lng) && !isNaN(lat)) {
                const cAlt = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], elevation);
                const cGround = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);

                const clipXAlt = cAlt.x * m[0] + cAlt.y * m[4] + cAlt.z * m[8] + m[12];
                const clipYAlt = cAlt.x * m[1] + cAlt.y * m[5] + cAlt.z * m[9] + m[13];
                const clipWAlt = cAlt.x * m[3] + cAlt.y * m[7] + cAlt.z * m[11] + m[15];

                const clipXGrd = cGround.x * m[0] + cGround.y * m[4] + cGround.z * m[8] + m[12];
                const clipYGrd = cGround.x * m[1] + cGround.y * m[5] + cGround.z * m[9] + m[13];
                const clipWGrd = cGround.x * m[3] + cGround.y * m[7] + cGround.z * m[11] + m[15];

                if (clipWAlt !== 0 && clipWGrd !== 0) {
                    const ndcXAlt = clipXAlt / clipWAlt;
                    const ndcYAlt = clipYAlt / clipWAlt;
                    const ndcXGrd = clipXGrd / clipWGrd;
                    const ndcYGrd = clipYGrd / clipWGrd;

                    const pXAlt = ((ndcXAlt + 1) / 2) * tr.width;
                    const pYAlt = ((1 - ndcYAlt) / 2) * tr.height;
                    const pXGrd = ((ndcXGrd + 1) / 2) * tr.width;
                    const pYGrd = ((1 - ndcYGrd) / 2) * tr.height;

                    marker.setOffset([pXAlt - pXGrd, pYAlt - pYGrd]);
                }
            }
        });
    }
    async function renderRoomLabels(buildingId, floorLevel) {
        roomMarkersList.forEach(item => {
            const marker = item.marker || item;
            if (marker && marker.remove) marker.remove();
        });
        roomMarkersList = [];

        try {
            let rooms = roomsData;
            if (!rooms || rooms.length === 0) {
                const rRes = await fetch(`${API_URL}/admin/rooms`);
                if (rRes.ok) {
                    roomsData = await rRes.json();
                    rooms = roomsData;
                }
            }
            if (rooms && rooms.length > 0) {
                const filteredRooms = rooms.filter(r => parseInt(r.building_id) === parseInt(buildingId) && parseInt(r.floor_level) === parseInt(floorLevel));

                filteredRooms.forEach(r => {
                    if (r.coordinate_x && r.coordinate_y) {
                        const el = document.createElement('div');
                        el.className = `room-map-label ${r.room_type ? r.room_type.toLowerCase() : 'general'}`;
                        
                        let icon = 'fa-door-open';
                        if (r.room_type === 'Classroom') icon = 'fa-chalkboard-user';
                        else if (r.room_type === 'Meeting') icon = 'fa-users';
                        else if (r.room_type === 'Office') icon = 'fa-briefcase';
                        else if (r.room_type === 'Facility') icon = 'fa-gears';
                        else if (r.room_id.toLowerCase().includes('restroom')) icon = 'fa-restroom';

                        el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${r.room_id}</span>`;
                        
                        el.onclick = (ev) => {
                            ev.stopPropagation();
                            locateLocation(r.room_id);
                        };

                        const base_h = r.floor_level * 4;
                        const elevation = base_h + 2;
                        const lng = parseFloat(r.coordinate_y);
                        const lat = parseFloat(r.coordinate_x);
                        const m = new mapboxgl.Marker({
                            element: el,
                            pitchAlignment: 'viewport',
                            rotationAlignment: 'viewport'
                        })
                        .setLngLat([lng, lat])
                        .addTo(window.outdoorMap);

                        roomMarkersList.push({ marker: m, lng: lng, lat: lat, elevation: elevation });
                    }
                });

                updateRoomMarkerOffsets();
                window.outdoorMap.off('move', updateRoomMarkerOffsets);
                window.outdoorMap.off('render', updateRoomMarkerOffsets);
                window.outdoorMap.on('move', updateRoomMarkerOffsets);
                window.outdoorMap.on('render', updateRoomMarkerOffsets);
            }
        } catch (e) {
            console.error("Failed to render room labels", e);
        }
    }
    async function fetchRoomsForBuildingAndLevel(buildingId, floorLevel) {
        const listDiv = document.getElementById('building-rooms-list');
        listDiv.innerHTML = '<p style="font-size: 0.8rem; color: var(--color-text-muted);">Loading rooms...</p>';

        try {
            let rooms = roomsData;
            if (!rooms || rooms.length === 0) {
                const res = await fetch(`${API_URL}/admin/rooms`);
                if (res.ok) {
                    roomsData = await res.json();
                    rooms = roomsData;
                } else {
                    throw new Error("Failed to fetch rooms from backend");
                }
            }
            const filtered = rooms.filter(r => parseInt(r.building_id) === parseInt(buildingId) && parseInt(r.floor_level) === parseInt(floorLevel));
                
                listDiv.innerHTML = '';
                if (filtered.length === 0) {
                    listDiv.innerHTML = '<p style="font-size: 0.8rem; color: var(--color-text-muted); font-style: italic;">No rooms listed on this floor.</p>';
                    return;
                }

                filtered.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'mobile-list-item';
                    item.innerHTML = `<i class="fa-solid fa-door-open" style="color: var(--color-mint); margin-right: 8px;"></i> <strong>${r.room_id}</strong> - ${r.room_type || 'General Room'}`;
                    item.onclick = () => {
                        closeAllSheets();
                        locateLocation(r.room_id);
                    };
                    listDiv.appendChild(item);
                });
        } catch (e) {
            listDiv.innerHTML = '<p style="font-size: 0.8rem; color: var(--color-text-dark);">Failed to retrieve room details.</p>';
        }
    }

    // ==========================================
    // 8. DIRECTORY ACCORDIONS IN MOBILE MENU
    // ==========================================
    const accHeaders = {
        blocks: document.getElementById('acc-blocks'),
        rooms: document.getElementById('acc-rooms')
    };

    Object.keys(accHeaders).forEach(key => {
        const header = accHeaders[key];
        if (header) {
            header.onclick = () => {
                const parent = header.parentElement;
                parent.classList.toggle('active');

                // Close other panels
                Object.keys(accHeaders).forEach(otherKey => {
                    if (otherKey !== key) {
                        accHeaders[otherKey].parentElement.classList.remove('active');
                    }
                });
            };
        }
    });

    async function populateMenuDirectories() {
        try {
            // 1. Accordion Blocks Directory
            const bRes = await fetch(`${API_URL}/admin/buildings`);
            if (bRes.ok) {
                const buildings = await bRes.json();
                const blocksList = document.getElementById('mobile-blocks-list');
                blocksList.innerHTML = '';

                buildings.forEach(b => {
                    const div = document.createElement('div');
                    div.className = 'mobile-list-item';
                    div.style.marginBottom = '6px';
                    div.innerHTML = `<i class="fa-solid ${b.icon || 'fa-building'}" style="color: var(--color-navy); margin-right: 8px;"></i> ${b.name}`;
                    div.onclick = () => {
                        closeAllSheets();
                        selectBuilding(b);
                    };
                    blocksList.appendChild(div);
                });
            }

            // 2. Accordion Rooms Directory
            let rooms = roomsData;
            if (!rooms || rooms.length === 0) {
                const rRes = await fetch(`${API_URL}/admin/rooms`);
                if (rRes.ok) {
                    roomsData = await rRes.json();
                    rooms = roomsData;
                }
            }
            if (rooms && rooms.length > 0) {
                const roomsList = document.getElementById('mobile-rooms-directory');
                roomsList.innerHTML = '';

                rooms.slice(0, 20).forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'mobile-list-item';
                    div.style.marginBottom = '6px';
                    div.innerHTML = `<i class="fa-solid fa-door-open" style="color: var(--color-navy); margin-right: 8px;"></i> ${r.room_id} (${r.building_name})`;
                    div.onclick = () => {
                        closeAllSheets();
                        locateLocation(r.room_id);
                    };
                    roomsList.appendChild(div);
                });

                if (rooms.length > 20) {
                     const extra = document.createElement('div');
                     extra.className = 'mobile-list-item';
                     extra.style.color = 'var(--color-text-muted)';
                     extra.style.fontStyle = 'italic';
                     extra.innerText = `...and ${rooms.length - 20} more. Use search.`;
                     roomsList.appendChild(extra);
                }
            }
        } catch (e) {
            console.error("Accordion list population error: ", e);
        }
    }

    // ==========================================
    // 9. LIVE UPDATES DRAWER POPULATION
    // ==========================================
    async function fetchAnnouncements() {
        const list = document.getElementById('mobile-announcements-list');
        try {
            const res = await fetch(`${API_URL}/live-data`);
            const messages = await res.json();
            list.innerHTML = '';

            if (messages.length === 0) {
                list.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); font-size: 0.85rem; padding: 20px 0;">No new updates from the administration.</p>';
                return;
            }

            messages.forEach(m => {
                const card = document.createElement('div');
                card.className = `mobile-announcement-card ${m.type}`;
                card.innerHTML = `<i class="fa-solid fa-circle-info" style="margin-right: 8px; color: var(--color-mint);"></i> ${m.message}`;
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); font-size: 0.85rem; padding: 20px 0;">Could not connect to backend announcements.</p>';
        }
    }

    // ==========================================
    // 10. MAP TOOLS & CONTROLS INTERACTIVE LOGIC
    // ==========================================
    const compassBtn = document.getElementById('compass-btn');
    const compassIcon = compassBtn.querySelector('i');
    
    window.outdoorMap.on('rotate', () => {
        compassIcon.style.transform = `rotate(${-window.outdoorMap.getBearing()}deg)`;
    });

    compassBtn.onclick = () => {
        window.outdoorMap.easeTo({ bearing: 0, pitch: is3D ? 55 : 0, duration: 1000 });
    };

    document.getElementById('toggle-3d-btn').onclick = (e) => {
        is3D = !is3D;
        window.outdoorMap.easeTo({ pitch: is3D ? 55 : 0 });
        e.target.style.backgroundColor = is3D ? '' : 'var(--color-navy)';
        e.target.style.color = is3D ? '' : 'var(--color-white)';
    };

    // Toggle Toggles logic
    document.getElementById('boundary-toggle').addEventListener('change', (e) => {
        if (window.outdoorMap.getLayer('campus-wall-layer')) {
            window.outdoorMap.setLayoutProperty(
                'campus-wall-layer',
                'visibility',
                e.target.checked ? 'visible' : 'none'
            );
        }
    });

    document.getElementById('theme-toggle').addEventListener('change', (e) => {
        currentTheme = e.target.checked ? 'dark' : 'light';
        document.body.className = currentTheme === 'dark' ? 'dark-theme' : 'light-theme';

        const styleURL = currentTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
        window.outdoorMap.setStyle(styleURL);
    });

    // ==========================================
    // 11. SMART SEARCH ACTION FOR MOBILE
    // ==========================================
    const searchBar = document.getElementById('search-bar');
    let currentSearchMarker = null;

    async function locateLocation(query) {
        query = query.trim();
        if (!query) return;

        try {
            searchBar.placeholder = "Calculating map path...";
            searchBar.value = query;

            const res = await fetch(`${API_URL}/search/${query}`);
            if (!res.ok) throw new Error("Location not found.");

            const data = await res.json();
            if (currentSearchMarker) currentSearchMarker.remove();

            window.outdoorMap.flyTo({
                center: [data.global_y, data.global_x],
                zoom: 19.2,
                pitch: 60,
                duration: 2000
            });

            // Set active highlighted color to mockup mint green
             if (data.type === 'room') {
                 activeSearchRoomId = data.id;
                 window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-color', [
                     'case',
                     ['==', ['get', 'id'], data.id], '#00C896', // Mint highlighted matching mockup
                     [
                         'coalesce',
                         ['get', 'color'],
                         [
                             'match',
                             ['get', 'room_type'],
                             'Classroom', '#f97316',
                             'Meeting', '#22c55e',
                             'Office', '#3b82f6',
                             'Facility', '#64748b',
                             'Restroom', '#64748b',
                             currentTheme === 'dark' ? '#0f172a' : '#e0e7ff'
                         ]
                     ]
                 ]);
             } else {
                 activeSearchRoomId = "";
             }

            const title = data.type === 'room' ? data.id : data.building_name;
            const popupHTML = `
                <div style="padding: 2px;">
                    <strong style="color: var(--color-navy); font-size: 0.95rem;">${title}</strong><br>
                    <span style="font-size: 0.75rem; color: var(--color-text-muted);">
                        ${data.type === 'room' ? 'Inside: ' + data.building_name : 'Campus Block'}
                    </span>
                </div>
            `;
            const popup = new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(popupHTML);

            const searchDot = document.createElement('div');
            searchDot.className = 'glowing-pin';

            currentSearchMarker = new mapboxgl.Marker(searchDot)
                .setLngLat([data.global_y, data.global_x])
                .setPopup(popup)
                .addTo(window.outdoorMap);

            currentSearchMarker.togglePopup();

            // Automatically select building & floor if a room was searched
            if (data.building_id) {
                const b = buildingsData.find(item => item.building_id === data.building_id);
                if (b) {
                    selectBuilding(b);
                    if (data.type === 'room' && data.floor_level !== undefined) {
                        setTimeout(() => {
                            const targetText = data.floor_level === 0 ? 'G' : data.floor_level.toString();
                            document.querySelectorAll('.floor-pill-btn').forEach(btn => {
                                if (btn.innerText === targetText) {
                                    btn.click();
                                }
                            });
                            // Keep vertical widget synchronized
                            document.querySelectorAll('.floor-btn-group .floor-btn').forEach(btn => {
                                if (btn.innerText === targetText) {
                                    btn.click();
                                }
                            });
                        }, 600);
                    }
                }
            }

            searchBar.value = '';
            searchBar.placeholder = "Search rooms, blocks, facilities...";
            showToast(`Found: ${title}`, "info");

        } catch (e) {
            console.error("Search locating error: ", e);
            searchBar.value = '';
            searchBar.placeholder = "Search rooms, blocks, facilities...";
            showToast("Target location not resolved.", "error");
        }
    }

    searchBar.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            locateLocation(searchBar.value);
        }
    });

    // ==========================================
    // 12. MOBILE QR CAMERA CODE SCANNER
    // ==========================================
    const scannerOverlay = document.getElementById('mobile-scanner');
    const exitScannerBtn = document.getElementById('exit-scanner-btn');
    const headerScanBtn = document.getElementById('header-scan-btn');
    const video = document.getElementById('scanner-video');
    const canvasElement = document.getElementById('scanner-canvas');
    const canvas = canvasElement.getContext('2d');
    let scanStream = null;
    let scanning = false;

    headerScanBtn.onclick = startScanner;
    exitScannerBtn.onclick = stopScanner;

    function startScanner() {
        scannerOverlay.style.display = 'flex';
        
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
            scanStream = stream;
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            scanning = true;
            requestAnimationFrame(tickScanner);
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.warn("Kiosk fullscreen restore failed:", err));
            }
        }).catch(err => {
            console.error("Camera fail: ", err);
            showToast("Camera access refused or unavailable.", "error");
            setTimeout(stopScanner, 2000);
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.warn("Kiosk fullscreen restore failed:", err));
            }
        });
    }

    function stopScanner() {
        scanning = false;
        if (scanStream) {
            scanStream.getTracks().forEach(track => track.stop());
            scanStream = null;
        }
        scannerOverlay.style.display = 'none';
        setNavActive('explore');
    }

    function tickScanner() {
        if (!scanning) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code && code.data) {
                stopScanner();
                hideDashboard(); // Hide dashboard when scanned location is found
                locateLocation(code.data);
                return;
            }
        }
        requestAnimationFrame(tickScanner);
    }

    // ==========================================
    // 13. KIOSK MODE CONTROLLER
    // ==========================================
    
    // 13.1. Automatic Fullscreen on First User Interaction (bypasses browser gesture blocks)
    function enterFullscreenOnGesture() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn("Automatic fullscreen failed or blocked:", err);
            });
        }
        // Remove the one-time listeners
        document.removeEventListener('click', enterFullscreenOnGesture);
        document.removeEventListener('touchstart', enterFullscreenOnGesture);
    }
    document.addEventListener('click', enterFullscreenOnGesture);
    document.addEventListener('touchstart', enterFullscreenOnGesture);


    // 13.2. Disable context menu / right click to escape
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // 13.3. Idle Inactivity Reset Timer (60 Seconds)
    let idleTimer = null;
    const idleTimeoutMs = 60000; // 60 seconds

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(triggerIdleReset, idleTimeoutMs);
    }

    function triggerIdleReset() {
        showToast("Session idle. Resetting to home screen.", "info");

        // 1. Close scanner if running
        stopScanner();

        // 2. Hide map elements and return to home landing overlay
        showDashboard();

        // 3. Clear Mapbox search markers and popups
        if (currentSearchMarker) {
            currentSearchMarker.remove();
            currentSearchMarker = null;
        }

        // 4. Reset Mapbox Camera to starting position
        window.outdoorMap.flyTo({
            center: ritCenter,
            zoom: 17.2,
            pitch: 55,
            bearing: -20,
            duration: 1500
        });

        // 5. Clear all active building filter layers
        window.outdoorMap.setFilter('indoor-rooms', ['==', ['get', 'level'], -1]);
        window.outdoorMap.setFilter('indoor-walls', ['==', ['get', 'level'], -1]);
        window.outdoorMap.setFilter('indoor-floor-plate', ['==', ['get', 'id'], -1]);
        window.outdoorMap.setFilter('building-shells', ['==', ['get', 'type'], 'building']);
        
        // Clear room tags
        roomMarkersList.forEach(item => {
            const marker = item.marker || item;
            if (marker && marker.remove) marker.remove();
        });
        roomMarkersList = [];
        
        // Hide floor controls
        document.getElementById('floor-widget-container').style.display = 'none';

        // 6. Stop GPS Geolocation Tracking if active
        if (isTrackingLocation) {
            toggleLocationTracking();
        }
    }

    // Monitor all user interaction events to keep active state
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(evt => {
        window.addEventListener(evt, resetIdleTimer, true);
    });

    // Initialize idle timer
    resetIdleTimer();
});
