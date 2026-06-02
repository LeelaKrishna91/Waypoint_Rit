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

        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('show'));

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // Wait for transition
        }, 3000);
    }

    // ==========================================
    // 1. LIVE ANNOUNCEMENTS PANEL
    // ==========================================
    async function fetchAnnouncements() {
        try {
            const msgRes = await fetch(`${API_URL}/live-data`);
            const messages = await msgRes.json();
            const listEl = document.getElementById('announcement-list');
            listEl.innerHTML = ''; // Clear existing

            if (messages.length === 0) {
                listEl.innerHTML = '<div style="padding: 10px; font-size: 0.8rem; color: #94a3b8; text-align: center;">No active updates.</div>';
                return;
            }

            messages.forEach(m => {
                const item = document.createElement('div');
                item.className = `announcement-item ${m.type}`;
                item.innerText = m.message;
                listEl.appendChild(item);
            });
        } catch (e) {
            console.log("No messages loaded.");
            document.getElementById('announcement-list').innerHTML = '<div style="padding: 10px; font-size: 0.8rem; color: #ef4444; text-align: center;">Failed to connect to server.</div>';
        }
    }

    // Initial fetch
    fetchAnnouncements();
    // Poll every 15 seconds for new admin updates
    setInterval(fetchAnnouncements, 15000);

    // ==========================================
    // 2. MAP INITIALIZATION & CAMERA SETTINGS
    // ==========================================
    mapboxgl.accessToken = 'pk.eyJ1IjoibGVlbGFrcmlzaG5hOTEiLCJhIjoiY21ubGRyd3Y0MTE0dDJvcXVtcTVtZmpsdSJ9' + '.' + '82mSmhy8H3hZ-x-wCsCtzw';
    const ritCenter = [80.0447, 13.0390];

    // Define a tight bounding box locking the camera exactly to the RIT Campus hole
    const ritBounds = [
        [80.036, 13.034], // Southwest coordinates
        [80.053, 13.045]  // Northeast coordinates
    ];

    let currentTheme = 'dark'; // Dark theme is default

    window.outdoorMap = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/dark-v11', // default dark map
        center: ritCenter,
        zoom: 17.5,
        minZoom: 16.5,    // Tighter zoom barrier
        maxBounds: ritBounds, // Lock the map to these coordinates
        pitch: 60,
        maxPitch: 75,
        minPitch: 0,
        bearing: -20,
        antialias: true
    });

    let activeBuildingId = null;
    let is3D = true;
    let markersList = []; // Track all markers for cleanup
    let userLocationMarker = null;
    let watchId = null;
    let isTrackingLocation = false;

    // ==========================================
    // 3. 3D X-RAY DATA ENGINE & POI MARKERS
    // ==========================================

    // Abstract layer building out so it can run again if style changes (dark mode)
    async function renderCustomLayers() {
        // Clear markers
        markersList.forEach(m => m.remove());
        markersList = [];

        // Clear if updating
        if (window.outdoorMap.getSource('world-mask')) {
            if (window.outdoorMap.getLayer('world-mask-layer')) window.outdoorMap.removeLayer('world-mask-layer');
            window.outdoorMap.removeSource('world-mask');
        }
        if (window.outdoorMap.getSource('custom-campus')) {
            if (window.outdoorMap.getLayer('building-shells')) window.outdoorMap.removeLayer('building-shells');
            if (window.outdoorMap.getLayer('indoor-rooms')) window.outdoorMap.removeLayer('indoor-rooms');
            window.outdoorMap.removeSource('custom-campus');
        }

        // MASK LAYER: Hides the rest of the world outside the campus
        window.outdoorMap.addSource('world-mask', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        // Outer Ring: The whole planet
                        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
                        // Inner Ring (Hole): RIT Campus boundaries
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

        // 3D PERIMETER WALL LAYER
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

            // Turf JS geometric calculations to forge the 3D wall footprints
            const borderLine = turf.lineString(perimeterCoords);
            // Convert line to a 0.5m thick solid wall polygon
            const wallPolygon = turf.buffer(borderLine, 0.5, { units: 'meters' });

            // Construct entrance gap
            const entrance = turf.point([80.04520562488239, 13.037528246529249]);
            // 20 meter wide gap for the entrance to allow visual passing
            const gapPolygon = turf.buffer(entrance, 20, { units: 'meters' });

            // Slice the hole into the wall!
            const finishedWall = turf.difference(wallPolygon, gapPolygon);

            window.outdoorMap.addSource('campus-wall', {
                'type': 'geojson',
                'data': finishedWall
            });

            // Make it incredibly prominent!
            const wallColor = currentTheme === 'dark' ? '#1e293b' : '#cbd5e1';
            const wallToggle = document.getElementById('wall-toggle-switch');
            const isVisible = wallToggle && wallToggle.checked ? 'visible' : 'none';

            window.outdoorMap.addLayer({
                'id': 'campus-wall-layer',
                'type': 'fill-extrusion',
                'source': 'campus-wall',
                'layout': {
                    'visibility': isVisible
                },
                'paint': {
                    'fill-extrusion-color': wallColor,
                    'fill-extrusion-height': 1.5, // Reduced to 1.5m tall for a subtle barrier
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.9
                }
            });
        } catch (e) {
            console.warn("Failed to generate perimeter wall.", e);
        }

        window.outdoorMap.addSource('custom-campus', {
            'type': 'geojson',
            'data': { 'type': 'FeatureCollection', 'features': [] }
        });

        // LAYER 1: Building Shells
        const buildingColor = currentTheme === 'dark' ? '#1e293b' : ['get', 'color'];
        window.outdoorMap.addLayer({
            'id': 'building-shells',
            'type': 'fill-extrusion',
            'source': 'custom-campus',
            'filter': ['==', ['get', 'type'], 'building'],
            'paint': {
                'fill-extrusion-color': buildingColor,
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    17.5, 0.95,
                    19.5, 0.05
                ]
            }
        });

        // LAYER 2: Interior Rooms (Hidden by default)
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

        // Hide Splash Screen once everything is ready
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');
    }

    // Call render once map style finishes loading
    window.outdoorMap.on('style.load', renderCustomLayers);

    // Dark Mode Toggle Logic
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    if (darkModeSwitch) {
        darkModeSwitch.addEventListener('change', (e) => {
            currentTheme = e.target.checked ? 'dark' : 'light';
            document.body.classList.toggle('dark-theme', e.target.checked);

            // This triggers 'style.load' which re-renders the custom layers
            const styleURL = currentTheme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
            window.outdoorMap.setStyle(styleURL);
        });
    }

    // Campus Perimeter Wall Toggle Logic
    const wallToggleSwitch = document.getElementById('wall-toggle-switch');
    if (wallToggleSwitch) {
        wallToggleSwitch.addEventListener('change', (e) => {
            if (window.outdoorMap.getLayer('campus-wall-layer')) {
                window.outdoorMap.setLayoutProperty(
                    'campus-wall-layer',
                    'visibility',
                    e.target.checked ? 'visible' : 'none'
                );
            }
        });
    }

    async function refreshCampusData() {
        try {
            const bRes = await fetch(`${API_URL}/admin/buildings`);
            const buildings = await bRes.json();
            let features = [];

            buildings.forEach(b => {
                if (!b.footprint_coordinates) return;

                try {
                    let coords = JSON.parse(b.footprint_coordinates);
                    // GeoJSON Polygon requires an array of linear rings: [[[lng, lat], ...]]]
                    // If the data is only [[lng, lat], ...], wrap it in an outer array.
                    if (coords.length > 0 && typeof coords[0][0] === 'number') {
                        coords = [coords];
                    }

                    // Add the 3D Shape
                    features.push({
                        'type': 'Feature',
                        'properties': {
                            'type': 'building', 'id': b.building_id, 'name': b.name,
                            'height': b.total_floors * 4, 'color': b.color || '#f8f9fa'
                        },
                        'geometry': { 'type': 'Polygon', 'coordinates': coords }
                    });

                    // Add the HTML POI Marker floating above the building
                    if (b.entrance_x && b.entrance_y) {
                        const el = document.createElement('div');
                        el.className = 'poi-marker';
                        
                                                const bColor = b.color || '#38bdf8';
                        
                        el.innerHTML = `<i class="fa-solid ${b.icon || 'fa-building'}" style="background: transparent; color: ${bColor}; border-color: ${bColor}; box-shadow: 0 0 12px ${bColor}40; --building-color: ${bColor};"></i><br><span>${b.name}</span>`;

                        const m = new mapboxgl.Marker(el)
                            .setLngLat([b.entrance_y, b.entrance_x]) // Longitude, Latitude
                            .addTo(window.outdoorMap);
                        markersList.push(m);
                    }
                } catch (err) {
                    console.error(`Failed to parse footprint for building: ${b.name}`, err);
                }
            });

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

                            // Pre-calculate heights to bypass Mapbox expression bugs
                            const base_h = r.floor_level * 4;
                            const z_thick = (r.z_coordinate !== undefined && r.z_coordinate !== null) ? parseFloat(r.z_coordinate) : 3.5;
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
                            console.error(`Failed to parse footprint for room: ${r.room_id}`, err);
                        }
                    });
                }
            } catch (err) { console.log("Room data not yet available."); }

            window.outdoorMap.getSource('custom-campus').setData({ 'type': 'FeatureCollection', 'features': features });
        } catch (e) { console.error("Database connection failed", e); }
    }

    // ==========================================
    // 4. INTERACTION: CLICK TO ENTER BUILDING
    // ==========================================
    window.outdoorMap.on('click', 'building-shells', (e) => {
        const building = e.features[0].properties;
        activeBuildingId = building.id;

        window.outdoorMap.flyTo({ center: e.lngLat, zoom: 19.5, pitch: 60, duration: 1500 });

        const totalFloors = Math.max(1, building.height / 4);
        buildFloorSelector(totalFloors);

        // Show UI Elements
        document.getElementById('floor-widget-container').style.display = 'flex';
        document.getElementById('exit-building-btn').style.display = 'block';

        // Populate and slide in the Info Panel
        document.getElementById('info-title').innerText = building.name;
        document.getElementById('info-floors').innerText = totalFloors;
        document.getElementById('building-info-panel').classList.add('visible');
    });

    window.outdoorMap.on('mouseenter', 'building-shells', () => window.outdoorMap.getCanvas().style.cursor = 'pointer');
    window.outdoorMap.on('mouseleave', 'building-shells', () => window.outdoorMap.getCanvas().style.cursor = '');

    // ==========================================
    // 5. UI LOGIC: FLOOR SELECTOR
    // ==========================================
    function buildFloorSelector(totalFloors) {
        const group = document.getElementById('floor-btn-group');
        group.innerHTML = '';

        for (let i = totalFloors - 1; i >= 0; i--) {
            const btn = document.createElement('button');
            btn.className = 'floor-btn';
            btn.innerText = i === 0 ? 'G' : i;
            if (i === 0) btn.classList.add('active');

            btn.onclick = () => {
                document.querySelectorAll('.floor-btn-group .floor-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                window.outdoorMap.setFilter('indoor-rooms', [
                    'all',
                    ['==', ['get', 'type'], 'room'],
                    ['==', ['get', 'level'], i],
                    ['==', ['get', 'parent'], activeBuildingId]
                ]);
            };
            group.appendChild(btn);
        }
        group.lastChild.click();
    }

    // ==========================================
    // 6. BUTTON CONTROLS
    // ==========================================
    const compassBtn = document.getElementById('compass-btn');
    const compassIcon = compassBtn.querySelector('i');
    window.outdoorMap.on('rotate', () => {
        compassIcon.style.transform = `rotate(${-window.outdoorMap.getBearing()}deg)`;
    });
    compassBtn.addEventListener('click', () => {
        window.outdoorMap.easeTo({ bearing: 0, pitch: is3D ? 60 : 0, duration: 1000 });
    });

    document.getElementById('toggle-3d-btn').addEventListener('click', (e) => {
        is3D = !is3D;
        window.outdoorMap.easeTo({ pitch: is3D ? 60 : 0 });
        e.target.style.color = is3D ? '#64748b' : '#38bdf8';
    });

    const recenterBtn = document.getElementById('recenter-btn');
    recenterBtn.addEventListener('click', () => {
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
            recenterBtn.style.color = '';
            showToast("Location tracking paused.", "info");
        } else {
            // Start tracking
            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your device.", "error");
                return;
            }

            recenterBtn.style.color = '#38bdf8';
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
                    recenterBtn.style.color = '';
                    isTrackingLocation = false;
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        }
    });

    document.getElementById('exit-building-btn').addEventListener('click', () => {
        window.outdoorMap.flyTo({ center: ritCenter, zoom: 17.5, pitch: 60, duration: 1500 });
        window.outdoorMap.setFilter('indoor-rooms', ['==', 'level', -1]);

        // Hide UI Elements
        document.getElementById('floor-widget-container').style.display = 'none';
        document.getElementById('exit-building-btn').style.display = 'none';
        document.getElementById('building-info-panel').classList.remove('visible');
        activeBuildingId = null;
    });

    // ==========================================
    // 7. SMART SEARCH ENGINE
    // ==========================================
    const searchBar = document.getElementById('search-bar');
    let currentSearchMarker = null;
    let activeSearchRoomId = "";

    async function locateLocation(query) {
        query = query.trim();
        if (!query) return;

        try {
            searchBar.placeholder = "Calculating coordinates...";
            searchBar.value = query;

            const response = await fetch(`${API_URL}/search/${query}`);
            if (!response.ok) throw new Error("Location not found.");

            const locationData = await response.json();

            if (currentSearchMarker) currentSearchMarker.remove();

            if (locationData.type === 'room') {
                activeSearchRoomId = locationData.id;
            } else {
                activeSearchRoomId = "";
            }

            // Push active room id to map style
            window.outdoorMap.setFeatureState({ source: 'custom-campus', id: activeSearchRoomId }, { active: true });
            window.outdoorMap.setPaintProperty('indoor-rooms', 'fill-extrusion-color', [
                'case',
                ['==', ['get', 'id'], activeSearchRoomId], '#fbbf24',
                currentTheme === 'dark' ? '#0f172a' : '#e0e7ff'
            ]);

            window.outdoorMap.flyTo({
                center: [locationData.global_y, locationData.global_x],
                zoom: 19.5,
                pitch: 60,
                duration: 2000
            });

            // Make sure the title shows the Building Name, not the ID
            const title = locationData.type === 'room' ? locationData.id : locationData.building_name;
            const popupHTML = `
                <div style="padding: 5px;">
                    <strong style="color: #38bdf8; font-size: 1.1rem;">${title}</strong><br>
                    <span style="font-size: 0.85rem; color: #94a3b8;">
                        ${locationData.type === 'room' ? 'Inside: ' + locationData.building_name : 'Campus Facility'}
                    </span>
                </div>
            `;
            const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupHTML);

            const pulseEl = document.createElement('div');
            pulseEl.className = 'glowing-pin';

            currentSearchMarker = new mapboxgl.Marker(pulseEl)
                .setLngLat([locationData.global_y, locationData.global_x])
                .setPopup(popup)
                .addTo(window.outdoorMap);

            currentSearchMarker.togglePopup();

            // Automatically open building and select the correct floor
            if (locationData.building_id) {
                activeBuildingId = locationData.building_id;
                document.getElementById('floor-widget-container').style.display = 'flex';
                document.getElementById('exit-building-btn').style.display = 'block';
                document.getElementById('info-title').innerText = locationData.building_name;
                document.getElementById('info-floors').innerText = locationData.total_floors;
                document.getElementById('building-info-panel').classList.add('visible');

                buildFloorSelector(locationData.total_floors);

                if (locationData.type === 'room' && locationData.floor_level !== undefined) {
                    const targetText = locationData.floor_level === 0 ? 'G' : locationData.floor_level.toString();
                    document.querySelectorAll('.floor-btn-group .floor-btn').forEach(btn => {
                        if (btn.innerText === targetText) {
                            btn.click();
                        }
                    });
                }
            }

            searchBar.value = '';
            showToast(`Target Acquired: ${title}`, 'info');

            // Show Confirmation Dialog instead of routing panel directly
            const confirmDialog = document.getElementById('nav-confirm-dialog');
            const targetNameSpan = document.getElementById('confirm-target-name');
            if (confirmDialog && targetNameSpan) {
                targetNameSpan.innerText = title;
                confirmDialog.style.display = 'flex';
            }

        } catch (error) {
            console.error("Search error:", error);
            searchBar.value = '';
            showToast("Location not found. Please try another query.", 'error');
        }
    }

    searchBar.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            locateLocation(searchBar.value);
        }
    });

    // ==========================================
    // 8. SIDE MENU LOGIC
    // ==========================================
    const menuIcon = document.querySelector('.menu-icon');
    const sideMenu = document.getElementById('side-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const closeMenuBtn = document.getElementById('close-menu-btn');

    function toggleMenu() {
        sideMenu.classList.toggle('open');
        menuOverlay.classList.toggle('active');
    }

    menuIcon.addEventListener('click', toggleMenu);
    closeMenuBtn.addEventListener('click', toggleMenu);
    menuOverlay.addEventListener('click', toggleMenu);

    // Accordion Logic & Coming Soon Alert
    document.querySelectorAll('.menu-item-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const parent = header.parentElement;

            if (parent.classList.contains('no-child')) {
                // Check if switch toggle clicked instead of normal header click
                if (e.target.tagName === 'INPUT' || e.target.classList.contains('slider')) {
                    return; 
                }
                const title = header.querySelector('span:first-child').innerText.trim();
                searchBar.value = '';
                showToast(`${title} is coming soon!`, 'warning');
                toggleMenu();
                return;
            }

            // Toggle active class
            parent.classList.toggle('active');

            // Close other items
            document.querySelectorAll('.menu-item').forEach(item => {
                if (item !== parent && !item.classList.contains('no-child')) {
                    item.classList.remove('active');
                }
            });
        });
    });

    // Fetch and populate Blocks and Rooms
    async function populateMenu() {
        try {
            // Populate Blocks
            const bRes = await fetch(`${API_URL}/admin/buildings`);
            if (bRes.ok) {
                const buildings = await bRes.json();
                const blocksList = document.getElementById('blocks-list');
                blocksList.innerHTML = '';

                buildings.forEach(b => {
                    const div = document.createElement('div');
                    div.className = 'sub-item';
                    div.innerText = b.name;
                    div.onclick = () => {
                        toggleMenu();
                        locateLocation(b.name);
                    };
                    blocksList.appendChild(div);
                });
            }

            // Populate Rooms
            const rRes = await fetch(`${API_URL}/admin/rooms`);
            if (rRes.ok) {
                const rooms = await rRes.json();
                const roomsList = document.getElementById('rooms-list');
                roomsList.innerHTML = '';

                // Group rooms by building or just list them (listing first 30 for brevity)
                rooms.slice(0, 30).forEach(r => {
                    const div = document.createElement('div');
                    div.className = 'sub-item';
                    div.innerText = `${r.room_id} (${r.building_name})`;
                    div.onclick = () => {
                        toggleMenu();
                        locateLocation(r.room_id);
                    };
                    roomsList.appendChild(div);
                });

                if (rooms.length > 30) {
                    const md = document.createElement('div');
                    md.className = 'sub-item';
                    md.style.color = '#94a3b8';
                    md.style.fontStyle = 'italic';
                    md.innerText = `...and ${rooms.length - 30} more. Use search.`;
                    roomsList.appendChild(md);
                }
            }
        } catch (e) {
            console.error("Failed to populate side menu: ", e);
        }
    }

    // Call populateMenu after delay to not block initial load
    setTimeout(populateMenu, 1000);

    // ==========================================
    // 9. CUSTOM QR SCANNER LOGIC
    // ==========================================
    const scanBtn = document.getElementById('scan-btn');
    const qrModal = document.getElementById('qr-scanner-modal');
    const closeScannerBtn = document.getElementById('close-scanner-btn');
    const video = document.getElementById('qr-video');
    const canvasElement = document.getElementById('qr-canvas');
    const canvas = canvasElement.getContext('2d');
    const scannerStatus = document.getElementById('scanner-status');
    let scanStream = null;
    let scanning = false;

    function startScanner() {
        qrModal.style.display = 'flex';
        scannerStatus.innerText = "Requesting camera access...";
        
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function(stream) {
            scanStream = stream;
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            scanning = true;
            requestAnimationFrame(tick);
        }).catch(err => {
            scannerStatus.innerText = "Error accessing camera: " + err.message;
        });
    }

    function stopScanner() {
        scanning = false;
        if (scanStream) {
            scanStream.getTracks().forEach(track => track.stop());
            scanStream = null;
        }
        qrModal.style.display = 'none';
    }

    function tick() {
        if (!scanning) return;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            scannerStatus.innerText = "Scanning for QR Codes...";
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            
            // Try to find a QR code
            var code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code && code.data) {
                stopScanner();
                locateLocation(code.data);
                return; // Stop the loop once a code is found
            }
        }
        requestAnimationFrame(tick);
    }

    scanBtn.addEventListener('click', startScanner);
    closeScannerBtn.addEventListener('click', stopScanner);

    // ==========================================
    // 10. ROUTING PANEL LOGIC
    // ==========================================
    const closeRouteBtn = document.getElementById('close-route-btn');
    const swapRouteBtn = document.getElementById('swap-route-btn');
    const startNavBtn = document.getElementById('start-nav-btn');
    const routeFrom = document.getElementById('route-from');
    const routeTo = document.getElementById('route-to');

    function drawRouteOnMap(coordinates) {
        const routeSourceId = 'nav-route-source';
        const routeLayerId = 'nav-route-layer';
        const routeGlowLayerId = 'nav-route-glow-layer';

        const geojson = {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': coordinates
            }
        };

        if (window.outdoorMap.getSource(routeSourceId)) {
            window.outdoorMap.getSource(routeSourceId).setData(geojson);
        } else {
            window.outdoorMap.addSource(routeSourceId, {
                'type': 'geojson',
                'data': geojson
            });

            window.outdoorMap.addLayer({
                'id': routeGlowLayerId,
                'type': 'line',
                'source': routeSourceId,
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#06b6d4',
                    'line-width': 8,
                    'line-opacity': 0.4
                }
            });

            window.outdoorMap.addLayer({
                'id': routeLayerId,
                'type': 'line',
                'source': routeSourceId,
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#22d3ee',
                    'line-width': 4
                }
            });
        }

        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        window.outdoorMap.fitBounds(bounds, {
            padding: 50,
            maxZoom: 19,
            duration: 1500
        });
    }

    function clearRouteFromMap() {
        const routeSourceId = 'nav-route-source';
        const routeLayerId = 'nav-route-layer';
        const routeGlowLayerId = 'nav-route-glow-layer';

        if (window.outdoorMap.getLayer(routeLayerId)) window.outdoorMap.removeLayer(routeLayerId);
        if (window.outdoorMap.getLayer(routeGlowLayerId)) window.outdoorMap.removeLayer(routeGlowLayerId);
        if (window.outdoorMap.getSource(routeSourceId)) window.outdoorMap.removeSource(routeSourceId);
    }

    async function calculateAndDisplayRoute() {
        const fromVal = routeFrom.value.trim();
        const toVal = routeTo.value.trim();

        if (!fromVal || !toVal) {
            showToast("Please enter both start and destination locations.", "warning");
            return;
        }

        let startQuery = fromVal;
        let endQuery = toVal;

        if (fromVal.toLowerCase() === "my location") {
            if (navigator.geolocation) {
                showToast("Fetching your current location...", "info");
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        startQuery = `${latitude},${longitude}`;
                        await fetchAndDraw(startQuery, endQuery);
                    },
                    (error) => {
                        console.error("GPS retrieval failed", error);
                        showToast("Could not retrieve GPS location. Using default gate.", "warning");
                        startQuery = "13.037528246529249,80.04520562488239";
                        fetchAndDraw(startQuery, endQuery);
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            } else {
                showToast("GPS is not supported. Using default gate.", "warning");
                startQuery = "13.037528246529249,80.04520562488239";
                await fetchAndDraw(startQuery, endQuery);
            }
        } else {
            await fetchAndDraw(startQuery, endQuery);
        }
    }

    async function fetchAndDraw(start, end) {
        try {
            const response = await fetch(`${API_URL}/route?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Route not found");
            }

            const routeData = await response.json();
            if (routeData.path && routeData.path.length > 0) {
                drawRouteOnMap(routeData.path);
                showToast("Route loaded successfully!", "success");
                
                if (routeData.instructions && routeData.instructions.length > 0) {
                    setTimeout(() => {
                        showToast(routeData.instructions[0], "info");
                    }, 1000);
                    if (routeData.instructions.length > 1) {
                        setTimeout(() => {
                            showToast(routeData.instructions[routeData.instructions.length - 1], "info");
                        }, 2500);
                    }
                }
            } else {
                showToast("Could not calculate a path. Locations might be disconnected.", "error");
            }
        } catch (e) {
            console.error("Pathfinding error", e);
            showToast(e.message || "Failed to fetch routing details.", "error");
        }
    }

    if (closeRouteBtn) {
        closeRouteBtn.addEventListener('click', () => {
            document.getElementById('routing-panel').style.display = 'none';
            document.getElementById('main-search-box').style.display = 'flex';
            clearRouteFromMap();
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
        startNavBtn.addEventListener('click', calculateAndDisplayRoute);
    }

    // Confirmation Dialog Button Listeners
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');
    const navConfirmDialog = document.getElementById('nav-confirm-dialog');
    const mainSearchBox = document.getElementById('main-search-box');
    const routingPanel = document.getElementById('routing-panel');

    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            if (navConfirmDialog) navConfirmDialog.style.display = 'none';
            if (mainSearchBox) mainSearchBox.style.display = 'none';
            if (routingPanel) {
                routingPanel.style.display = 'flex';
                const targetNameSpan = document.getElementById('confirm-target-name');
                if (routeTo && targetNameSpan) {
                    routeTo.value = targetNameSpan.innerText;
                }
            }
        });
    }

    if (confirmNoBtn) {
        confirmNoBtn.addEventListener('click', () => {
            if (navConfirmDialog) navConfirmDialog.style.display = 'none';
        });
    }
});
