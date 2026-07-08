// ============================================================================
// RIT CAMPUS 3D - PHONE EXPLORER CORE ENGINE (frontend_phone)
// Designed for ultra-fluid smartphone UI & UX
// ============================================================================

mapboxgl.accessToken = 'pk.eyJ1IjoibGVlbGFrcmlzaG5hOTEiLCJhIjoiY21ubGRyd3Y0MTE0dDJvcXVtcTVtZmpsdSJ9.' + '82mSmhy8H3hZ-x-wCsCtzw';

const RIT_CENTER = [80.0447, 13.0390];
let activeBuildingId = null;
let activeFloorLevel = null;
let currentTheme = localStorage.getItem('phone_theme') || 'light';
let allCampusRooms = [];
let allCampusBuildings = [];
let roomMarkersList = [];
let isPitch3D = true;

const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.protocol === "file:" ||
                /^192\.168\./.test(window.location.hostname) ||
                /^10\./.test(window.location.hostname) ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

const API_URL = isLocal
    ? (window.location.protocol === "file:" ? "http://127.0.0.1:8000" : `${window.location.protocol}//${window.location.hostname}:8000`)
    : "https://waypoint-rit.onrender.com";

// Toast Utility
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'phone-toast';

    let icon = 'fa-circle-info';
    let color = 'var(--primary)';
    if (type === 'success') { icon = 'fa-circle-check'; color = 'var(--success)'; }
    if (type === 'warning') { icon = 'fa-triangle-exclamation'; color = 'var(--warning)'; }
    if (type === 'error') { icon = 'fa-circle-xmark'; color = 'var(--danger)'; }

    toast.innerHTML = `<i class="fa-solid ${icon}" style="color: ${color}; font-size: 15px;"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'scale(0.9) translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// Initialize Map
const map = new mapboxgl.Map({
    container: 'map-container',
    style: currentTheme === 'dark'
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/light-v11',
    center: RIT_CENTER,
    zoom: 17.5,
    pitch: 58,
    bearing: -18,
    antialias: true
});

window.outdoorMap = map;

// Apply Theme class immediately
if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
}

map.on('load', () => {
    // 3D Sky & Atmosphere
    map.setFog({
        'range': [1.0, 8.0],
        'color': currentTheme === 'dark' ? '#090d16' : '#e2e8f0',
        'horizon-blend': 0.15
    });

    // Add GeoJSON Source for buildings, floors, rooms, walls, furniture
    map.addSource('custom-campus', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    // 1. Building Shells Layer
    map.addLayer({
        id: 'building-shells',
        type: 'fill-extrusion',
        source: 'custom-campus',
        filter: ['==', ['get', 'type'], 'building'],
        paint: {
            'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                currentTheme === 'dark' ? '#6366f1' : '#4f46e5',
                ['coalesce', ['get', 'color'], currentTheme === 'dark' ? '#1e293b' : '#f1f5f9']
            ],
            'fill-extrusion-base': 0,
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 12],
            'fill-extrusion-opacity': 0.93
        }
    });

    // 2. Elevated Floor Slabs
    map.addLayer({
        id: 'indoor-floor-plate',
        type: 'fill-extrusion',
        source: 'custom-campus',
        filter: ['all', ['==', ['get', 'type'], 'building'], ['==', ['get', 'id'], -1]],
        paint: {
            'fill-extrusion-color': currentTheme === 'dark' ? '#1e293b' : '#f8fafc',
            'fill-extrusion-base': 0,
            'fill-extrusion-height': 0.05,
            'fill-extrusion-opacity': 0.95
        }
    });

    // 3. Interior Rooms Layer
    map.addLayer({
        id: 'indoor-rooms',
        type: 'fill-extrusion',
        source: 'custom-campus',
        filter: ['all', ['==', ['get', 'type'], 'room'], ['==', ['get', 'level'], -1]],
        paint: {
            'fill-extrusion-color': [
                'coalesce',
                ['get', 'color'],
                currentTheme === 'dark' ? '#334155' : '#e2e8f0'
            ],
            'fill-extrusion-base': ['get', 'base_h'],
            'fill-extrusion-height': ['+', ['get', 'base_h'], 0.18],
            'fill-extrusion-opacity': 0.92
        }
    });

    // 4. Interior Room Walls (0.38m thick, 2.6m tall solid architectural walls)
    map.addLayer({
        id: 'indoor-walls',
        type: 'fill-extrusion',
        source: 'custom-campus',
        filter: ['all', ['==', ['get', 'type'], 'room-wall'], ['==', ['get', 'level'], -1]],
        paint: {
            'fill-extrusion-color': currentTheme === 'dark' ? '#64748b' : '#e2e8f0',
            'fill-extrusion-base': ['get', 'base_h'],
            'fill-extrusion-height': ['+', ['get', 'base_h'], 2.6],
            'fill-extrusion-opacity': 1.0
        }
    });

    // 5. Interior Furniture
    map.addLayer({
        id: 'indoor-furniture',
        type: 'fill-extrusion',
        source: 'custom-campus',
        filter: ['all', ['==', ['get', 'type'], 'furniture'], ['==', ['get', 'level'], -1]],
        paint: {
            'fill-extrusion-color': currentTheme === 'dark' ? '#94a3b8' : '#64748b',
            'fill-extrusion-base': ['get', 'base_h'],
            'fill-extrusion-height': ['get', 'ceil_h'],
            'fill-extrusion-opacity': 0.95
        }
    });

    // Load Live Campus Data
    fetchCampusData();
});

// Fetch Buildings & Rooms from Backend API
async function fetchCampusData() {
    try {
        const features = [];
        const [bRes, rRes] = await Promise.all([
            fetch(`${API_URL}/admin/buildings`).catch(() => ({ ok: false })),
            fetch(`${API_URL}/admin/rooms`).catch(() => ({ ok: false }))
        ]);

        if (bRes && bRes.ok) {
            allCampusBuildings = await bRes.json();
            allCampusBuildings.forEach(b => {
                if (b.footprint_coordinates) {
                    try {
                        let coords = typeof b.footprint_coordinates === 'string'
                            ? JSON.parse(b.footprint_coordinates)
                            : b.footprint_coordinates;

                        features.push({
                            type: 'Feature',
                            properties: {
                                type: 'building',
                                id: b.building_id,
                                name: b.name,
                                height: b.height || 12,
                                color: b.color || null
                            },
                            geometry: { type: 'Polygon', coordinates: coords }
                        });
                    } catch (e) {
                        console.warn("Invalid building footprint:", b.building_id);
                    }
                }
            });
        }

        if (rRes && rRes.ok) {
            allCampusRooms = await rRes.json();
            allCampusRooms.forEach(r => {
                if (r.footprint_coordinates) {
                    try {
                        let coords = typeof r.footprint_coordinates === 'string'
                            ? JSON.parse(r.footprint_coordinates)
                            : r.footprint_coordinates;

                        const base_h = (r.floor_level || 0) * 4;
                        const ceil_h = base_h + 3.2;

                        // Room Floor Slab
                        features.push({
                            type: 'Feature',
                            properties: {
                                type: 'room',
                                id: r.room_id,
                                parent: r.building_id,
                                level: r.floor_level || 0,
                                base_h: base_h,
                                ceil_h: ceil_h,
                                room_type: r.room_type,
                                color: r.color || null
                            },
                            geometry: { type: 'Polygon', coordinates: coords }
                        });

                        // Architectural Room Perimeter Wall Buffer (0.38m thick)
                        const outerRing = coords[0];
                        if (outerRing && outerRing.length >= 3 && window.turf) {
                            const line = turf.lineString(outerRing);
                            const bufferedWall = turf.buffer(line, 0.38, { units: 'meters' });
                            features.push({
                                type: 'Feature',
                                properties: {
                                    type: 'room-wall',
                                    id: r.room_id + '_wall',
                                    parent: r.building_id,
                                    level: r.floor_level || 0,
                                    base_h: base_h,
                                    ceil_h: ceil_h
                                },
                                geometry: bufferedWall.geometry
                            });
                        }
                    } catch (e) {
                        console.warn("Invalid room footprint:", r.room_id);
                    }
                }
            });
        }

        map.getSource('custom-campus').setData({
            type: 'FeatureCollection',
            features: features
        });

    } catch (err) {
        console.error("Failed loading campus data:", err);
    }
}

// ============================================================================
// BUILDING SELECTION & X-RAY FLOOR CUTAWAY
// ============================================================================
map.on('click', 'building-shells', (e) => {
    const props = e.features[0].properties;
    selectBuilding(props.id, props.name, props.height || 12, e.lngLat);
});

function selectBuilding(buildingId, buildingName, height, lngLat) {
    activeBuildingId = parseInt(buildingId);

    // X-Ray Mode: Hide active building shell so floors and rooms are visible
    map.setFilter('building-shells', [
        'all',
        ['==', ['get', 'type'], 'building'],
        ['!=', ['to-number', ['get', 'id']], activeBuildingId]
    ]);

    const totalFloors = Math.max(1, Math.round(height / 4));
    selectFloor(0, totalFloors);

    // Fly camera smoothly to inspect building
    if (lngLat) {
        map.flyTo({
            center: lngLat,
            zoom: 19.3,
            pitch: 62,
            duration: 1400
        });
    }

    // Update UI Bottom Sheet
    const sheetTitle = document.getElementById('sheet-title');
    const sheetStatus = document.getElementById('sheet-status-chip');
    const floorCountSpan = document.getElementById('sheet-floor-count');
    const subtitleText = document.getElementById('sheet-subtitle-text');
    const headerActions = document.getElementById('building-header-actions');
    const campusOverview = document.getElementById('campus-overview-section');
    const buildingRoomsSection = document.getElementById('building-rooms-section');
    const floorScroll = document.getElementById('floor-pill-scroll');

    if (sheetTitle) sheetTitle.innerText = buildingName || `Building #${buildingId}`;
    if (subtitleText) subtitleText.style.display = 'none';
    if (sheetStatus) {
        sheetStatus.style.display = 'inline-flex';
        if (floorCountSpan) floorCountSpan.innerText = `${totalFloors} Floor${totalFloors > 1 ? 's' : ''}`;
    }
    if (headerActions) headerActions.style.display = 'flex';
    if (campusOverview) campusOverview.style.display = 'none';
    if (buildingRoomsSection) buildingRoomsSection.style.display = 'block';

    // Build Floor Pill Selector
    if (floorScroll) {
        floorScroll.style.display = 'flex';
        floorScroll.innerHTML = '';
        for (let i = 0; i < totalFloors; i++) {
            const pill = document.createElement('button');
            pill.className = `floor-pill ${i === 0 ? 'active' : ''}`;
            pill.innerHTML = `<i class="fa-solid fa-layer-group"></i> Floor ${i + 1}`;
            pill.onclick = () => {
                document.querySelectorAll('.floor-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                selectFloor(i, totalFloors);
            };
            floorScroll.appendChild(pill);
        }
    }
}

function selectFloor(level, totalFloors) {
    activeFloorLevel = level;
    const floatElevation = level * 4;

    map.setFilter('indoor-floor-plate', [
        'all',
        ['==', ['get', 'type'], 'building'],
        ['==', ['to-number', ['get', 'id']], activeBuildingId]
    ]);
    map.setPaintProperty('indoor-floor-plate', 'fill-extrusion-base', floatElevation);
    map.setPaintProperty('indoor-floor-plate', 'fill-extrusion-height', floatElevation + 0.05);

    map.setFilter('indoor-rooms', [
        'all',
        ['==', ['get', 'type'], 'room'],
        ['==', ['to-number', ['get', 'level']], level],
        ['==', ['to-number', ['get', 'parent']], activeBuildingId]
    ]);
    map.setPaintProperty('indoor-rooms', 'fill-extrusion-base', floatElevation + 0.05);
    map.setPaintProperty('indoor-rooms', 'fill-extrusion-height', floatElevation + 0.18);

    map.setFilter('indoor-walls', [
        'all',
        ['==', ['get', 'type'], 'room-wall'],
        ['==', ['to-number', ['get', 'level']], level],
        ['==', ['to-number', ['get', 'parent']], activeBuildingId]
    ]);
    map.setPaintProperty('indoor-walls', 'fill-extrusion-base', floatElevation + 0.05);
    map.setPaintProperty('indoor-walls', 'fill-extrusion-height', floatElevation + 2.6);

    map.setFilter('indoor-furniture', [
        'all',
        ['==', ['get', 'type'], 'furniture'],
        ['==', ['to-number', ['get', 'level']], level],
        ['==', ['to-number', ['get', 'parent']], activeBuildingId]
    ]);
    map.setPaintProperty('indoor-furniture', 'fill-extrusion-base', floatElevation + 0.18);
    map.setPaintProperty('indoor-furniture', 'fill-extrusion-height', floatElevation + 0.85);

    renderRoomCards(activeBuildingId, level);
    render3DRoomLabels(activeBuildingId, level);
}

// Render Room Cards in Bottom Sheet
function renderRoomCards(buildingId, level) {
    const grid = document.getElementById('room-cards-grid');
    const counter = document.getElementById('floor-room-counter');
    if (!grid) return;

    grid.innerHTML = '';
    const rooms = allCampusRooms.filter(r =>
        parseInt(r.building_id) === parseInt(buildingId) &&
        parseInt(r.floor_level || 0) === parseInt(level)
    );

    if (counter) counter.innerText = `${rooms.length} Room${rooms.length !== 1 ? 's' : ''}`;

    if (rooms.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">No mapped rooms on Floor ${level + 1}</div>`;
        return;
    }

    rooms.forEach(r => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="room-card-number">${r.room_id}</div>
            <div class="room-card-type"><i class="fa-solid fa-door-closed"></i> ${r.room_type || 'Classroom'}</div>
        `;
        card.onclick = () => {
            // Fly to Room
            if (r.footprint_coordinates) {
                try {
                    let coords = typeof r.footprint_coordinates === 'string'
                        ? JSON.parse(r.footprint_coordinates)
                        : r.footprint_coordinates;
                    if (coords[0] && coords[0][0]) {
                        map.flyTo({
                            center: coords[0][0],
                            zoom: 20.2,
                            pitch: 66,
                            duration: 1200
                        });
                        showToast(`Inspecting Room ${r.room_id}`, 'info');
                    }
                } catch (e) {}
            }
        };
        grid.appendChild(card);
    });
}

// Render 3D Projected Room Labels
function render3DRoomLabels(buildingId, level) {
    roomMarkersList.forEach(m => {
        const marker = m.marker || m;
        if (marker && marker.remove) marker.remove();
    });
    roomMarkersList = [];

    const rooms = allCampusRooms.filter(r =>
        parseInt(r.building_id) === parseInt(buildingId) &&
        parseInt(r.floor_level || 0) === parseInt(level)
    );

    const floatElevation = level * 4 + 1.8;

    rooms.forEach(r => {
        if (!r.footprint_coordinates) return;
        try {
            let coords = typeof r.footprint_coordinates === 'string'
                ? JSON.parse(r.footprint_coordinates)
                : r.footprint_coordinates;
            const poly = turf.polygon(coords);
            const center = turf.centerOfMass(poly);
            const [lng, lat] = center.geometry.coordinates;

            const el = document.createElement('div');
            el.className = 'phone-room-tag';
            el.innerText = r.room_id;

            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([lng, lat])
                .addTo(map);

            roomMarkersList.push({ marker, lng, lat, elevation: floatElevation });
        } catch (e) {}
    });

    updateRoomLabelProjections();
}

function updateRoomLabelProjections() {
    if (!roomMarkersList.length) return;
    const transform = map.transform;
    roomMarkersList.forEach(item => {
        const merc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: item.lng, lat: item.lat }, item.elevation);
        const pos = [merc.x, merc.y, merc.z, 1.0];
        const m = transform.projMatrix;

        const clipX = pos[0]*m[0] + pos[1]*m[4] + pos[2]*m[8] + pos[3]*m[12];
        const clipY = pos[0]*m[1] + pos[1]*m[5] + pos[2]*m[9] + pos[3]*m[13];
        const clipW = pos[0]*m[3] + pos[1]*m[7] + pos[2]*m[11] + pos[3]*m[15];

        if (clipW > 0) {
            const ndcX = clipX / clipW;
            const ndcY = clipY / clipW;
            const screenX = ((ndcX + 1) / 2) * transform.width;
            const screenY = ((1 - ndcY) / 2) * transform.height;
            const el = item.marker.getElement();
            if (el) {
                el.style.display = 'block';
                el.style.transform = `translate(-50%, -50%) translate(${screenX}px, ${screenY}px)`;
            }
        } else {
            const el = item.marker.getElement();
            if (el) el.style.display = 'none';
        }
    });
}

map.on('move', updateRoomLabelProjections);
map.on('render', updateRoomLabelProjections);

// ============================================================================
// STANDALONE DESELECT BUILDING (DISMISS FUNCTIONALITY)
// ============================================================================
function deselectBuilding() {
    activeBuildingId = null;

    map.flyTo({
        center: RIT_CENTER,
        zoom: 17.5,
        pitch: 58,
        bearing: -18,
        duration: 1300
    });

    map.setFilter('building-shells', ['==', ['get', 'type'], 'building']);
    map.setFilter('indoor-floor-plate', ['==', ['get', 'id'], -1]);
    map.setFilter('indoor-rooms', ['==', ['get', 'level'], -1]);
    map.setFilter('indoor-walls', ['==', ['get', 'level'], -1]);
    map.setFilter('indoor-furniture', ['==', ['get', 'level'], -1]);

    roomMarkersList.forEach(m => {
        const marker = m.marker || m;
        if (marker && marker.remove) marker.remove();
    });
    roomMarkersList = [];

    // Reset UI Bottom Sheet to Campus Overview
    const sheetTitle = document.getElementById('sheet-title');
    const sheetStatus = document.getElementById('sheet-status-chip');
    const subtitleText = document.getElementById('sheet-subtitle-text');
    const headerActions = document.getElementById('building-header-actions');
    const campusOverview = document.getElementById('campus-overview-section');
    const buildingRoomsSection = document.getElementById('building-rooms-section');
    const floorScroll = document.getElementById('floor-pill-scroll');

    if (sheetTitle) sheetTitle.innerText = 'RIT Campus Explorer';
    if (subtitleText) subtitleText.style.display = 'inline';
    if (sheetStatus) sheetStatus.style.display = 'none';
    if (headerActions) headerActions.style.display = 'none';
    if (campusOverview) campusOverview.style.display = 'block';
    if (buildingRoomsSection) buildingRoomsSection.style.display = 'none';
    if (floorScroll) floorScroll.style.display = 'none';

    showToast('Returned to campus overview', 'info');
}

window.deselectBuilding = deselectBuilding;

// ============================================================================
// RIGHT THUMB ACTION CONTROLS
// ============================================================================

// Theme Switcher
document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('phone_theme', currentTheme);

    const icon = document.getElementById('theme-icon');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        map.setStyle('mapbox://styles/mapbox/dark-v11');
        if (icon) icon.className = 'fa-solid fa-sun';
    } else {
        document.body.classList.remove('dark-theme');
        map.setStyle('mapbox://styles/mapbox/light-v11');
        if (icon) icon.className = 'fa-solid fa-moon';
    }
    showToast(`Switched to ${currentTheme} theme`, 'info');
});

// Pitch Toggle (3D vs 2D)
document.getElementById('btn-pitch-toggle')?.addEventListener('click', (e) => {
    isPitch3D = !isPitch3D;
    const btn = e.currentTarget;
    if (isPitch3D) {
        map.easeTo({ pitch: 58, bearing: -18, duration: 800 });
        btn.classList.add('active');
        showToast('3D Perspective View', 'info');
    } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
        btn.classList.remove('active');
        showToast('2D Top-Down View', 'info');
    }
});

// Locate Me
document.getElementById('btn-locate-me')?.addEventListener('click', () => {
    if (navigator.geolocation) {
        showToast("Locating GPS coordinates...", "info");
        navigator.geolocation.getCurrentPosition(pos => {
            const coords = [pos.coords.longitude, pos.coords.latitude];
            map.flyTo({ center: coords, zoom: 18.5, pitch: 60, duration: 1500 });
        }, () => {
            showToast("Centered on RIT Campus", "info");
            map.flyTo({ center: RIT_CENTER, zoom: 18, duration: 1200 });
        });
    }
});

// Campus Center Home
document.getElementById('btn-campus-home')?.addEventListener('click', () => {
    deselectBuilding();
});

// Category Chips Filtering
document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        showToast(`Filtered: ${chip.innerText}`, 'info');
    });
});
