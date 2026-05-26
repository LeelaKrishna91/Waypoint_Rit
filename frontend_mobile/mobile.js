const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : "https://waypoint-rit.onrender.com";

document.addEventListener("DOMContentLoaded", async () => {
    // ==========================================
    // 0. TOAST NOTIFICATIONS & UI HELPERS
    // ==========================================
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
    }

    function openSheet(sheetKey) {
        closeAllSheets();
        const target = sheets[sheetKey];
        if (target) target.classList.add('open');
    }

    // Connect close buttons
    document.getElementById('close-sheet-btn').onclick = closeAllSheets;
    document.getElementById('close-updates-btn').onclick = closeAllSheets;
    document.getElementById('close-menu-btn').onclick = closeAllSheets;

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
    // 2. BOTTOM NAVIGATION MANAGEMENT
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
        closeAllSheets();
        setNavActive('explore');
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
    // 3. MAP INITIALIZATION & CAMERA SETTINGS
    // ==========================================
    mapboxgl.accessToken = 'pk.eyJ1IjoibGVlbGFrcmlzaG5hOTEiLCJhIjoiY21ubGRyd3Y0MTE0dDJvcXVtcTVtZmpsdSJ9' + '.' + '82mSmhy8H3hZ-x-wCsCtzw';
    const ritCenter = [80.0447, 13.0390];
    const ritBounds = [
        [80.036, 13.034],
        [80.053, 13.045]
    ];

    let currentTheme = 'dark';
    window.outdoorMap = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/dark-v11',
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
    let buildingsData = [];

    // ==========================================
    // 4. MAP GEOLOCATION ACCURACY (GPS TRACKER)
    // ==========================================
    let userLocationMarker = null;
    let watchId = null;
    let isTrackingLocation = false;

    const locateBtn = document.getElementById('locate-btn');
    locateBtn.onclick = toggleLocationTracking;

    function toggleLocationTracking() {
        if (isTrackingLocation) {
            // Stop tracking
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
            if (userLocationMarker) {
                userLocationMarker.remove();
                userLocationMarker = null;
            }
            isTrackingLocation = false;
            locateBtn.style.color = 'var(--text-secondary)';
            showToast("Location tracking paused.", "info");
        } else {
            // Start tracking
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your device.", "error");
                return;
            }

            locateBtn.style.color = 'var(--accent-blue)';
            showToast("Locating your device...", "info");

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // RIT campus limits rough verification
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
                },
                (error) => {
                    console.error("GPS Error: ", error);
                    showToast("Failed to acquire GPS coordinates.", "error");
                    locateBtn.style.color = 'var(--text-secondary)';
                    isTrackingLocation = false;
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        }
    }

    // ==========================================
    // 5. 3D X-RAY DATA ENGINE
    // ==========================================
    async function renderCustomLayers() {
        markersList.forEach(m => m.remove());
        markersList = [];

        // WORLD MASK
        if (window.outdoorMap.getSource('world-mask')) {
            if (window.outdoorMap.getLayer('world-mask-layer')) window.outdoorMap.removeLayer('world-mask-layer');
            window.outdoorMap.removeSource('world-mask');
        }
        
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

        const maskColor = currentTheme === 'dark' ? '#030712' : '#f8fafc';
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

            const wallColor = currentTheme === 'dark' ? '#1e293b' : '#cbd5e1';
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
        const shellColor = currentTheme === 'dark' ? '#1e293b' : ['get', 'color'];
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

        // Rooms Layer
        window.outdoorMap.addLayer({
            'id': 'indoor-rooms',
            'type': 'fill-extrusion',
            'source': 'custom-campus',
            'filter': ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'level'], -1]],
            'paint': {
                'fill-extrusion-color': currentTheme === 'dark' ? '#0f172a' : '#e0e7ff',
                'fill-extrusion-base': ['get', 'base_h'],
                'fill-extrusion-height': ['get', 'ceil_h'],
                'fill-extrusion-opacity': 1.0
            }
        });

        await refreshCampusData();

        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');
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

                    // Add Custom POI Markers floating with transparent backgrounds
                    if (b.entrance_x && b.entrance_y) {
                        const el = document.createElement('div');
                        el.className = 'poi-marker';
                        
                        const bColor = b.color || '#38bdf8';
                        el.innerHTML = `<i class="fa-solid ${b.icon || 'fa-building'}" style="background: transparent; color: ${bColor}; border-color: ${bColor}; box-shadow: 0 0 10px ${bColor}40; --building-color: ${bColor};"></i><br><span>${b.name}</span>`;

                        // Add click listener directly to the HTML icon on mobile
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
                    const rooms = await rRes.json();
                    rooms.forEach(r => {
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
                                    'ceil_h': ceil_h
                                },
                                'geometry': { 'type': 'Polygon', 'coordinates': coords }
                            });
                        } catch (err) {
                            console.error("Failed loading room coordinates: ", err);
                        }
                    });
                }
            } catch (err) {
                console.log("No rooms loaded dynamically.");
            }

            window.outdoorMap.getSource('custom-campus').setData({ 'type': 'FeatureCollection', 'features': features });
        } catch (e) {
            console.error("Server connections unavailable for map markers.", e);
        }
    }

    // ==========================================
    // 6. BUILDING SELECTION & BOTTOM SHEET POPULATION
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
                    ['==', ['get', 'level'], i],
                    ['==', ['get', 'parent'], activeBuildingId]
                ]);

                // Filter dynamic room list on the bottom sheet
                fetchRoomsForBuildingAndLevel(b.building_id, i);
            };

            floorContainer.appendChild(btn);
        }

        // Click first floor button (usually Ground)
        if (floorContainer.lastChild) {
            floorContainer.lastChild.click();
        }

        // Slide up Building Info Bottom Sheet
        openSheet('building');
        setNavActive('explore');
    }

    async function fetchRoomsForBuildingAndLevel(buildingId, floorLevel) {
        const listDiv = document.getElementById('building-rooms-list');
        listDiv.innerHTML = '<p style="font-size: 0.8rem; color: #94a3b8;">Loading rooms...</p>';

        try {
            const res = await fetch(`${API_URL}/admin/rooms`);
            if (res.ok) {
                const rooms = await res.json();
                const filtered = rooms.filter(r => r.building_id === buildingId && r.floor_level === floorLevel);
                
                listDiv.innerHTML = '';
                if (filtered.length === 0) {
                    listDiv.innerHTML = '<p style="font-size: 0.8rem; color: #64748b; font-style: italic;">No rooms listed on this floor.</p>';
                    return;
                }

                filtered.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'mobile-list-item';
                    item.innerHTML = `<i class="fa-solid fa-door-open" style="color: var(--accent-blue); margin-right: 8px;"></i> <strong>${r.room_id}</strong> - ${r.room_type || 'General Room'}`;
                    item.onclick = () => {
                        closeAllSheets();
                        locateLocation(r.room_id);
                    };
                    listDiv.appendChild(item);
                });
            }
        } catch (e) {
            listDiv.innerHTML = '<p style="font-size: 0.8rem; color: var(--accent-red);">Failed to retrieve room details.</p>';
        }
    }

    // ==========================================
    // 7. DIRECTORY ACCORDIONS IN MOBILE MENU
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

                // Close other accordion panels
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
                    div.innerHTML = `<i class="fa-solid ${b.icon || 'fa-building'}" style="color: var(--accent-blue); margin-right: 8px;"></i> ${b.name}`;
                    div.onclick = () => {
                        closeAllSheets();
                        selectBuilding(b);
                    };
                    blocksList.appendChild(div);
                });
            }

            // 2. Accordion Rooms Directory
            const rRes = await fetch(`${API_URL}/admin/rooms`);
            if (rRes.ok) {
                const rooms = await rRes.json();
                const roomsList = document.getElementById('mobile-rooms-directory');
                roomsList.innerHTML = '';

                // List first 20 rooms for quick access
                rooms.slice(0, 20).forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'mobile-list-item';
                    div.style.style = 'margin-bottom: 6px;';
                    div.innerHTML = `<i class="fa-solid fa-door-open" style="color: var(--accent-blue); margin-right: 8px;"></i> ${r.room_id} (${r.building_name})`;
                    div.onclick = () => {
                        closeAllSheets();
                        locateLocation(r.room_id);
                    };
                    roomsList.appendChild(div);
                });

                if (rooms.length > 20) {
                    const extra = document.createElement('div');
                    extra.className = 'mobile-list-item';
                    extra.style.color = 'var(--text-secondary)';
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
    // 8. LIVE UPDATES DRAWER POPULATION
    // ==========================================
    async function fetchAnnouncements() {
        const list = document.getElementById('mobile-announcements-list');
        try {
            const res = await fetch(`${API_URL}/live-data`);
            const messages = await res.json();
            list.innerHTML = '';

            if (messages.length === 0) {
                list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 20px 0;">No new updates from the administration.</p>';
                return;
            }

            messages.forEach(m => {
                const card = document.createElement('div');
                card.className = `mobile-announcement-card ${m.type}`;
                card.style.marginBottom = '10px';
                card.innerHTML = `<i class="fa-solid fa-circle-info" style="margin-right: 6px;"></i> ${m.message}`;
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = '<p style="text-align: center; color: var(--accent-red); font-size: 0.85rem; padding: 20px 0;">Could not connect to backend announcements.</p>';
        }
    }

    // ==========================================
    // 9. MAP TOOLS & CONTROLS INTERACTIVE LOGIC
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
        e.target.style.color = is3D ? 'var(--text-secondary)' : 'var(--accent-blue)';
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
    // 10. SMART SEARCH ACTION FOR MOBILE
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

            // Set dynamic active room highlight
            if (data.type === 'room') {
                window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-color', [
                    'case',
                    ['==', ['get', 'id'], data.id], '#fbbf24',
                    currentTheme === 'dark' ? '#0f172a' : '#e0e7ff'
                ]);
            }

            const title = data.type === 'room' ? data.id : data.building_name;
            const popupHTML = `
                <div style="padding: 2px;">
                    <strong style="color: var(--accent-blue); font-size: 0.95rem;">${title}</strong><br>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">
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
                        }, 600);
                    }
                }
            }

            searchBar.value = '';
            searchBar.placeholder = "Search rooms, blocks, facilities...";
            showToast(`Found: ${title}`, "info");

            // Show Routing Panel
            const mainSearchBox = document.getElementById('main-search-box');
            if (mainSearchBox) mainSearchBox.style.display = 'none';
            
            const routingPanel = document.getElementById('routing-panel');
            if (routingPanel) routingPanel.style.display = 'flex';
            
            const routeToField = document.getElementById('route-to');
            if (routeToField) routeToField.value = title;

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
    // 11. MOBILE QR CAMERA CODE SCANNER
    // ==========================================
    const scannerOverlay = document.getElementById('mobile-scanner');
    const exitScannerBtn = document.getElementById('exit-scanner-btn');
    const headerScanBtn = document.getElementById('header-scan-btn');
    const video = document.getElementById('scanner-video');
    const canvasElement = document.getElementById('scanner-canvas');
    const canvas = canvasElement.getContext('2d');
    const hudStatus = document.getElementById('scanner-hud-status');
    let scanStream = null;
    let scanning = false;

    headerScanBtn.onclick = startScanner;
    exitScannerBtn.onclick = stopScanner;

    function startScanner() {
        scannerOverlay.style.display = 'flex';
        hudStatus.innerText = "Requesting device camera access...";
        
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
            scanStream = stream;
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            scanning = true;
            requestAnimationFrame(tickScanner);
        }).catch(err => {
            console.error("Camera fail: ", err);
            hudStatus.innerText = "Camera access error: " + err.message;
            showToast("Camera access refused or unavailable.", "error");
            setTimeout(stopScanner, 2000);
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
            hudStatus.innerText = "Scanning for QR Code...";
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code && code.data) {
                stopScanner();
                locateLocation(code.data);
                return;
            }
        }
        requestAnimationFrame(tickScanner);
    }
    // ==========================================
    // 12. ROUTING PANEL LOGIC FOR MOBILE
    // ==========================================
    const closeRouteBtn = document.getElementById('close-route-btn');
    const swapRouteBtn = document.getElementById('swap-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const routeFrom = document.getElementById('route-from');
    const routeTo = document.getElementById('route-to');

    if (closeRouteBtn) {
        closeRouteBtn.addEventListener('click', () => {
            document.getElementById('routing-panel').style.display = 'none';
            document.getElementById('main-search-box').style.display = 'block';
        });
    }

    if (swapRouteBtn) {
        swapRouteBtn.addEventListener('click', () => {
            const temp = routeFrom.value;
            routeFrom.value = routeTo.value;
            routeTo.value = temp;
        });
    }

    if (startNavBtn) {
        startNavBtn.addEventListener('click', () => {
            showToast("Navigation started! (Pathfinding API integration coming soon)", "info");
        });
    }
});
