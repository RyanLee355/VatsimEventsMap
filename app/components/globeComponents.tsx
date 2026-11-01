'use client';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import type { Map as MapLibreMap, GeoJSONSource, PointLike } from 'maplibre-gl';
import { Pilot, Ring, Route } from '@/app/types';

export type GlobeHandle = {
    flyTo: (lat: number, lng: number, altitude?: number) => void;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Vector basemaps (free, no token). Swap for MapTiler / Protomaps / self-hosted if you prefer.
const STYLE_NIGHT = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const STYLE_DAY = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// Ring animation, matching the old react-globe.gl settings:
// maxRadius 0.25deg (~27.75km), speed 0.02deg/s -> 12.5s lifetime, new ring every 5s.
const RING_MAX_RADIUS_M = 0.25 * 111_000;
const RING_LIFETIME_MS = 12_500;
const RING_REPEAT_MS = 5_000;
const RING_COUNT = Math.ceil(RING_LIFETIME_MS / RING_REPEAT_MS);
const RING_FRAME_MS = 40; // ~25fps
// Screen pixels per metre at zoom 0 (512px tiles): radius_px = metres * 2^zoom / 78271.5
const RING_PX_AT_ZOOM0 = RING_MAX_RADIUS_M / 78271.5;

const HIT_PADDING_PX = 6; // click/hover tolerance around thin lines and small dots

const PLANE_FILL = '#3861a4'; // plane colour

const SRC_RANGE = 'range-src';
const LYR_RANGE_FILL = 'range-fill';
const LYR_RANGE_LINE = 'range-line';

const SRC_ROUTES = 'routes-src';
const SRC_RINGS = 'rings-src';
const SRC_PILOTS = 'pilots-src';
const SRC_AIRPORTS = 'airports-src';
const LYR_ROUTES = 'routes-line';
const LYR_RING_DOT = 'rings-dot';
const LYR_HALO = 'pilots-halo';
const LYR_PILOTS = 'pilots-dot';
const LYR_HIT = 'pilots-hit';
const LYR_AIRPORTS = 'airports-label';
const lyrRing = (i: number) => `rings-${i}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FC = { type: 'FeatureCollection'; features: any[] };
const EMPTY_FC: FC = { type: 'FeatureCollection', features: [] };

// Route/ring colors are an array of CSS strings (maplibre parses #rgb, #rrggbb, #rrggbbaa)
const firstColor = (color: any): string =>
    Array.isArray(color) ? color[0] ?? '#ffffff' : typeof color === 'string' ? color : '#ffffff';

// react-globe.gl "altitude" (globe radii above surface) -> MapLibre zoom.
// altitude 1.5 ~ zoom 3, 0.25 ~ zoom 5.6
const altitudeToZoom = (altitude: number) =>
    Math.max(0.5, Math.min(18, 3 + Math.log2(1.5 / Math.max(altitude, 0.001))));

const getDateTag = (startTime: Date) => {
    const now = new Date();
    const start = new Date(startTime);

    const diff =
        new Date(start.setHours(0, 0, 0, 0)).getTime() -
        new Date(now.setHours(0, 0, 0, 0)).getTime();

    const diffDays = Math.round(diff / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) return `In ${diffDays} Days`;
    return `${Math.abs(diffDays)} Days Ago`;
};

// Densified great-circle line (longitudes unwrapped so lines crossing the antimeridian stay continuous)
function greatCircle(lng1: number, lat1: number, lng2: number, lat2: number, stepDeg = 2): number[][] {
    const rad = Math.PI / 180;
    const vec = (lng: number, lat: number) => [
        Math.cos(lat * rad) * Math.cos(lng * rad),
        Math.cos(lat * rad) * Math.sin(lng * rad),
        Math.sin(lat * rad),
    ];
    const a = vec(lng1, lat1);
    const b = vec(lng2, lat2);
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const omega = Math.acos(dot);
    const sinO = Math.sin(omega);
    if (omega < 1e-6 || sinO < 1e-9) return [[lng1, lat1], [lng2, lat2]];

    const n = Math.max(2, Math.ceil(omega / rad / stepDeg));
    const coords: number[][] = [];
    let prevLng = lng1;
    for (let k = 0; k <= n; k++) {
        const t = k / n;
        const A = Math.sin((1 - t) * omega) / sinO;
        const B = Math.sin(t * omega) / sinO;
        const x = A * a[0] + B * b[0];
        const y = A * a[1] + B * b[1];
        const z = A * a[2] + B * b[2];
        let lng = Math.atan2(y, x) / rad;
        while (lng - prevLng > 180) lng -= 360;
        while (lng - prevLng < -180) lng += 360;
        prevLng = lng;
        coords.push([lng, Math.atan2(z, Math.hypot(x, y)) / rad]);
    }
    return coords;
}

const EARTH_NM = 3440.065;

// Geodesic circle as a polygon. Circles that contain a pole are closed through the pole,
// so the fill covers the right side instead of inverting.
function rangeToFC(c: { lat: number; lng: number; radiusNm: number } | null): FC {
    if (!c || !(c.radiusNm > 0)) return EMPTY_FC;
    const rad = Math.PI / 180;
    // cap at a quarter of the globe (~5,400 nm): beyond that a circle can enclose both poles
    const d = Math.min(c.radiusNm, 5_400) / EARTH_NM;
    const lat1 = c.lat * rad;
    const lng1 = c.lng * rad;
    const north = lat1 + d > Math.PI / 2;
    const south = lat1 - d < -Math.PI / 2;
    const steps = 360;

    // point on the circle at bearing b, as [lng (unwrapped later), lat] in degrees
    const at = (b: number): [number, number] => {
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
        const lng = (lng1 + Math.atan2(
            Math.sin(b) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        )) / rad;
        return [lng, lat2 / rad];
    };

    let ring: number[][];

    if (north || south) {
        // Edge as a function of longitude: normalise to [-180, 180] and sort, then close via the pole
        const pts: [number, number][] = [];
        for (let k = 0; k < steps; k++) {
            const [lng, lat] = at((k / steps) * 2 * Math.PI);
            pts.push([((((lng + 180) % 360) + 360) % 360) - 180, lat]);
        }
        pts.sort((a, b) => a[0] - b[0]);
        const poleLat = north ? 90 : -90;
        ring = [
            [-180, pts[0][1]],
            ...pts,
            [180, pts[pts.length - 1][1]],
            [180, poleLat],
            [-180, poleLat],
            [-180, pts[0][1]],
        ];
    } else {
        // No pole inside: unwrap longitudes so the ring stays continuous across the antimeridian
        ring = [];
        let prevLng = c.lng;
        for (let k = 0; k <= steps; k++) {
            let [lng, lat] = at((k / steps) * 2 * Math.PI);
            while (lng - prevLng > 180) lng -= 360;
            while (lng - prevLng < -180) lng += 360;
            prevLng = lng;
            ring.push([lng, lat]);
        }
    }

    return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }],
    };
}

const routesToFC = (routes: Route[]): FC => ({
    type: 'FeatureCollection',
    features: routes.map((r: any, i) => ({
        type: 'Feature',
        properties: { i, color: firstColor(r.color) },
        geometry: { type: 'LineString', coordinates: greatCircle(r.startLng, r.startLat, r.endLng, r.endLat) },
    })),
});

const ringsToFC = (rings: Ring[]): FC => ({
    type: 'FeatureCollection',
    features: rings.map((r: any, i) => ({
        type: 'Feature',
        properties: { i, color: firstColor(r.color) },
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    })),
});

const pilotsToFC = (pilots: Pilot[]): FC => ({
    type: 'FeatureCollection',
    features: pilots.map((p, i) => ({
        type: 'Feature',
        properties: { i, callsign: p.callsign, heading: Number(p.heading) || 0 },
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
    })),
});

// Matches the pilots that should get a circle (hovered and/or pinned)
const haloFilter = (callsigns: string[]): any => [
    'any',
    ...callsigns.map((c) => ['==', ['get', 'callsign'], c]),
];

const airportsToFC = (airports: any[]): FC => ({
    type: 'FeatureCollection',
    features: airports.map((a) => ({
        type: 'Feature',
        properties: { label: a.label },
        geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
    })),
});

// Ring radius in pixels at a given animation phase (0..1), scaling with zoom
const ringRadiusExpr = (phase: number): any => [
    'interpolate', ['exponential', 2], ['zoom'],
    0, phase * RING_PX_AT_ZOOM0,
    22, phase * RING_PX_AT_ZOOM0 * 2 ** 22,
];

// Plane icon (nose pointing north), drawn on a canvas so no image asset is needed.
// Images are wiped by setStyle, so this runs on every style load too.
const PLANE_ICON = 'plane-icon';
const PLANE_PATH =
    'M32 3 L36 21 L60 38 L60 45 L36 39 L35 52 L43 58 L43 62 L32 59 L21 62 L21 58 L29 52 L28 39 L4 45 L4 38 L28 21 Z';

function addPlaneIcon(map: MapLibreMap) {
    if (map.hasImage(PLANE_ICON)) return;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const path = new Path2D(PLANE_PATH);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.stroke(path);
    ctx.fillStyle = PLANE_FILL;
    ctx.fill(path);
    // pixelRatio 4 -> 16px on screen at icon-size 1
    map.addImage(PLANE_ICON, ctx.getImageData(0, 0, size, size), { pixelRatio: 4 });
}

// (Re)create all sources and layers. Must run after every style load, because setStyle wipes them.
function addDataLayers(
    map: MapLibreMap,
    fc: { routes: FC; rings: FC; pilots: FC; airports: FC; range: FC },
    halo: string[],
) {
    if (!map.getSource(SRC_RINGS)) map.addSource(SRC_RINGS, { type: 'geojson', data: fc.rings });
    if (!map.getSource(SRC_ROUTES)) map.addSource(SRC_ROUTES, { type: 'geojson', data: fc.routes });
    if (!map.getSource(SRC_PILOTS)) map.addSource(SRC_PILOTS, { type: 'geojson', data: fc.pilots });
    if (!map.getSource(SRC_AIRPORTS)) map.addSource(SRC_AIRPORTS, { type: 'geojson', data: fc.airports });
    if (!map.getSource(SRC_RANGE)) map.addSource(SRC_RANGE, { type: 'geojson', data: fc.range });
    
    // Pulsing rings: circle outlines that stay flat on the globe surface
    for (let i = 0; i < RING_COUNT; i++) {
        if (map.getLayer(lyrRing(i))) continue;
        map.addLayer({
            id: lyrRing(i),
            type: 'circle',
            source: SRC_RINGS,
            paint: {
                'circle-radius': 0,
                'circle-opacity': 0,
                'circle-stroke-color': ['get', 'color'],
                'circle-stroke-width': 2,
                'circle-stroke-opacity': 0,
                'circle-pitch-alignment': 'map',
                'circle-pitch-scale': 'map',
            },
        });
    }

    if (!map.getLayer(LYR_RANGE_FILL)) {
        map.addLayer({
            id: LYR_RANGE_FILL,
            type: 'fill',
            source: SRC_RANGE,
            paint: { 'fill-color': '#5eea5e', 'fill-opacity': 0.06 },
        });
    }
    if (!map.getLayer(LYR_RANGE_LINE)) {
        map.addLayer({
            id: LYR_RANGE_LINE,
            type: 'line',
            source: SRC_RANGE,
            paint: {
                'line-color': '#5eea5e',
                'line-width': 1.5,
                'line-opacity': 0.8,
                'line-dasharray': [3, 2],
            },
        });
    }

    if (!map.getLayer(LYR_ROUTES)) {
        map.addLayer({
            id: LYR_ROUTES,
            type: 'line',
            source: SRC_ROUTES,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 },
        });
    }

    // Solid, hoverable dot at the centre of each ring (event airport)
    if (!map.getLayer(LYR_RING_DOT)) {
        map.addLayer({
            id: LYR_RING_DOT,
            type: 'circle',
            source: SRC_RINGS,
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 6, 6, 10, 8],
                'circle-color': ['get', 'color'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
                'circle-pitch-alignment': 'viewport',
            },
        });
    }

    if (!map.getLayer(LYR_HALO)) {
        map.addLayer({
            id: LYR_HALO,
            type: 'circle',
            source: SRC_PILOTS,
            filter: haloFilter(halo),
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 9, 6, 13, 10, 18],
                'circle-color': 'rgba(94,234,94,0.22)',
                'circle-stroke-color': '#5eea5e',
                'circle-stroke-width': 1.5,
            },
        });
    }

    if (!map.getLayer(LYR_PILOTS)) {
        addPlaneIcon(map);
        map.addLayer({
            id: LYR_PILOTS,
            type: 'symbol',
            source: SRC_PILOTS,
            layout: {
                'icon-image': PLANE_ICON,
                'icon-rotate': ['get', 'heading'],
                'icon-rotation-alignment': 'map',
                'icon-pitch-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 0.9, 10, 1.3],
            },
        });
    }

    // Invisible circle layer used for hit-testing planes (symbol layers can throw in queryRenderedFeatures mid-refresh)
    if (!map.getLayer(LYR_HIT)) {
        map.addLayer({
            id: LYR_HIT,
            type: 'circle',
            source: SRC_PILOTS,
            paint: {
                'circle-radius': 9,
                'circle-opacity': 0,
                'circle-stroke-width': 0,
            },
        });
    }

    if (!map.getLayer(LYR_AIRPORTS)) {
        // Reuse a font the basemap already serves glyphs for
        const font =
            (map.getStyle().layers.find((l: any) => l.type === 'symbol' && l.layout?.['text-font']) as any)
                ?.layout['text-font'] ?? ['Open Sans Regular'];
        map.addLayer({
            id: LYR_AIRPORTS,
            type: 'symbol',
            source: SRC_AIRPORTS,
            layout: {
                'text-field': ['get', 'label'],
                'text-font': font,
                'text-size': 12,
                'text-anchor': 'bottom',
                'text-offset': [0, -0.4],
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': 'rgba(0,0,0,0.8)',
                'text-halo-width': 1.5,
            },
        });
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const formatAlt = (ft: number) =>
    ft >= 18000
        ? `FL${String(Math.round(ft / 100)).padStart(3, '0')}`
        : `${Math.round(ft).toLocaleString()} ft`;

function PilotStat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: '#8a94a6' }}>{label}</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        </div>
    );
}

// Shared by the desktop hover card and the mobile bottom sheet
function PilotCard({ pilot, padRight = 0 }: { pilot: Pilot; padRight?: number }) {
    const fp = pilot.flight_plan;
    const aircraft = fp?.aircraft_faa || fp?.aircraft;

    return (
        <div style={{ paddingRight: padRight }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.04em' }}>
                    {pilot.callsign}
                </span>
                {aircraft && (
                    <span
                        style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(25,210,25,0.15)',
                            color: '#5eea5e',
                            fontWeight: 600,
                        }}
                    >
                        {aircraft}
                    </span>
                )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#9aa4b5', marginTop: '1px' }}>{pilot.name}</div>

            {/* Route */}
            {fp && (fp.departure || fp.arrival) && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        margin: '10px 0',
                        fontWeight: 700,
                        fontSize: '1.05rem',
                        letterSpacing: '0.05em',
                    }}
                >
                    <span>{fp.departure || '----'}</span>
                    <span
                        style={{
                            flex: 1,
                            height: 0,
                            borderTop: '2px dotted rgba(255,255,255,0.3)',
                            position: 'relative',
                        }}
                    >
                        <span
                            style={{
                                position: 'absolute',
                                left: '50%',
                                top: '-9px',
                                transform: 'translateX(-50%)',
                                fontSize: '0.8rem',
                                color: '#19d219',
                                backgroundColor: 'rgba(12,16,24,0.95)',
                                padding: '0 4px',
                            }}
                        >
                            ✈
                        </span>
                    </span>
                    <span>{fp.arrival || '----'}</span>
                </div>
            )}

            {/* Stats */}
            <div
                style={{
                    display: 'flex',
                    gap: '12px',
                    marginTop: fp ? 0 : '10px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                <PilotStat label="ALT" value={formatAlt(pilot.altitude)} />
                <PilotStat label="GS" value={`${pilot.groundspeed} kt`} />
                <PilotStat label="HDG" value={`${String(Math.round(pilot.heading) % 360).padStart(3, '0')}°`} />
            </div>
        </div>
    );
}

const GlobeComponent = forwardRef<GlobeHandle, {
    routes: Route[];
    rings: Ring[];
    airportPoints: any[];
    pilotData: Pilot[];
    dayNightMode: boolean;
    rangeCircle?: { lat: number; lng: number; radiusNm: number } | null;
}>(({ routes, rings, airportPoints, pilotData, dayNightMode, rangeCircle }, ref) => {

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const mousePos = useRef({ x: 0, y: 0 });
    const initialDayNight = useRef(dayNightMode);

    // Latest data, readable from map event handlers and from style.load
    const fcRef = useRef({ routes: EMPTY_FC, rings: EMPTY_FC, pilots: EMPTY_FC, airports: EMPTY_FC, range: EMPTY_FC });
    const routesRef = useRef<Route[]>([]);
    const ringsRef = useRef<Ring[]>([]);
    const pilotsRef = useRef<Pilot[]>([]);
    const ringCountRef = useRef(0);
    const isMobileRef = useRef(false);

    const [ready, setReady] = useState(false);
    const [hoveredArc, setHoveredArc] = useState<any | null>(null);
    const [hoveredPilot, setHoveredPilot] = useState<any | null>(null);
    const [viewport, setViewport] = useState({ w: 0, h: 0 });
    const [isMobile, setIsMobile] = useState(false);

    const [pinnedCallsign, setPinnedCallsign] = useState<string | null>(null);
    const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(null);
    const pinnedRef = useRef<string | null>(null);
    const haloRef = useRef<string[]>([]);
    const syncPinnedRef = useRef<(() => void) | null>(null);

    const pin = useCallback((callsign: string | null) => {
        pinnedRef.current = callsign;
        setPinnedCallsign(callsign);
        if (callsign) syncPinnedRef.current?.();
        else setPinnedPos(null);
    }, []);

    const pinnedPilot = pinnedCallsign
        ? pilotData.find((p) => p.callsign === pinnedCallsign) ?? null
        : null;

    // Pilot disconnected / pilots hidden: drop the pin
    useEffect(() => {
        if (pinnedCallsign && !pinnedPilot) pin(null);
    }, [pinnedCallsign, pinnedPilot, pin]);

    // Esc unpins
    useEffect(() => {
        if (!pinnedCallsign) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && pin(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pinnedCallsign, pin]);

    // Circle under hovered and pinned planes
    useEffect(() => {
        const names = [hoveredPilot?.callsign, pinnedCallsign].filter(Boolean) as string[];
        haloRef.current = names; // style.load reads this when it rebuilds the layers
        const map = mapRef.current;
        if (ready && map?.getLayer(LYR_HALO)) map.setFilter(LYR_HALO, haloFilter(names));
    }, [hoveredPilot, pinnedCallsign, ready]);

    useImperativeHandle(ref, () => ({
        flyTo(lat: number, lng: number, altitude = 1.5) {
            mapRef.current?.flyTo({
                center: [lng, lat],
                zoom: altitudeToZoom(altitude),
                duration: 1200,
                essential: true,
            });
        }
    }));

    // ---- viewport / mobile detection ----
    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setIsMobile(w <= 768);
            isMobileRef.current = w <= 768;
            setViewport({ w, h });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getTooltipStyle = useCallback(
        (mouseX: number, mouseY: number, tooltipWidth = 280, tooltipHeight = 200) => {
            const offset = 12;
            const placeLeft = mouseX > viewport.w / 2;
            const placeTop = mouseY > viewport.h / 2;
            return {
                left: placeLeft ? mouseX - tooltipWidth - offset : mouseX + offset,
                top: placeTop ? mouseY - tooltipHeight - offset : mouseY + offset,
            };
        },
        [viewport]
    );

    // ---- map init (client only) ----
    useEffect(() => {
        let cancelled = false;
        let map: MapLibreMap | null = null;
        let raf = 0;

        const pick = (m: MapLibreMap, point: { x: number; y: number }) => {
            try {
                const box: [PointLike, PointLike] = [
                    [point.x - HIT_PADDING_PX, point.y - HIT_PADDING_PX],
                    [point.x + HIT_PADDING_PX, point.y + HIT_PADDING_PX],
                ];

                // Planes (invisible circle layer, looked up by callsign)
                if (m.getLayer(LYR_HIT)) {
                    const f = m.queryRenderedFeatures(box, { layers: [LYR_HIT] })[0];
                    if (f) {
                        const cs = f.properties?.callsign;
                        const item = pilotsRef.current.find((p) => p.callsign === cs);
                        if (item) return { kind: 'pilot' as const, item };
                    }
                }

                // Airport dots (event rings)
                if (m.getLayer(LYR_RING_DOT)) {
                    const f = m.queryRenderedFeatures(box, { layers: [LYR_RING_DOT] })[0];
                    if (f) {
                        const ring: any = ringsRef.current[f.properties?.i];
                        if (ring) {
                            const route = routesRef.current.find((r) => r.eventName === ring.eventName);
                            const item = route ?? { ...ring, airportsInvolved: ring.airportsInvolved ?? [ring.icao] };
                            return { kind: 'arc' as const, item };
                        }
                    }
                }

                // Route lines
                if (m.getLayer(LYR_ROUTES)) {
                    const f = m.queryRenderedFeatures(box, { layers: [LYR_ROUTES] })[0];
                    if (f) return { kind: 'arc' as const, item: routesRef.current[f.properties.i] };
                }
            } catch {
                /* style or tiles mid-reload: treat as no hit */
            }
            return null;
        };

        (async () => {
            const maplibre = await import('maplibre-gl');
            if (cancelled || !containerRef.current) return;

            map = new maplibre.Map({
                container: containerRef.current,
                style: initialDayNight.current ? STYLE_NIGHT : STYLE_DAY,
                center: [10, 25],
                zoom: 1.8,
                maxPitch: 60,
                attributionControl: { compact: true },
            });
            const m = map;

            const syncPinned = () => {
                const cs = pinnedRef.current;
                if (!cs) return;
                const p = pilotsRef.current.find((x) => x.callsign === cs);
                if (!p) return;
                const pt = m.project([p.longitude, p.latitude]);
                setPinnedPos((prev) => (prev && prev.x === pt.x && prev.y === pt.y ? prev : { x: pt.x, y: pt.y }));
            };
            syncPinnedRef.current = syncPinned;
            m.on('move', syncPinned);

            // Re-applied after every style load (setStyle resets projection, sky and custom layers)
            m.on('style.load', () => {
                m.setProjection({ type: 'globe' });
                try {
                    m.setSky({
                        'sky-color': '#000000',
                        'horizon-color': '#1a3a6e',
                        'fog-color': '#0b1a33',
                        'sky-horizon-blend': 0.6,
                        'horizon-fog-blend': 0.5,
                        'fog-ground-blend': 0.2,
                        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
                    });
                } catch { /* sky not supported by this maplibre version */ }
                addDataLayers(m, fcRef.current, haloRef.current);
            });

            // Desktop hover
            m.on('mousemove', (e) => {
                if (isMobileRef.current) return;
                const hit = pick(m, e.point);
                mousePos.current = { x: e.point.x, y: e.point.y };
                m.getCanvas().style.cursor = hit ? 'pointer' : '';
                if (hit?.kind === 'pilot') {
                    setHoveredPilot(hit.item ?? null);
                    setHoveredArc(null);
                } else if (hit?.kind === 'arc') {
                    setHoveredPilot(null);
                    setHoveredArc((prev: any) => (prev === hit.item ? prev : hit.item ?? null));
                } else {
                    setHoveredPilot(null);
                    setHoveredArc(null);
                }
            });

            // Desktop: click pins a plane popup. Mobile: tap opens the sheet (no hover on touch screens)
            m.on('click', (e) => {
                const hit = pick(m, e.point);

                if (!isMobileRef.current) {
                    pin(hit?.kind === 'pilot' ? hit.item?.callsign ?? null : null);
                    return;
                }

                if (hit?.kind === 'pilot') {
                    setHoveredPilot(hit.item ?? null);
                    setHoveredArc(null);
                } else if (hit?.kind === 'arc') {
                    setHoveredPilot(null);
                    setHoveredArc(hit.item ?? null);
                } else {
                    setHoveredPilot(null);
                    setHoveredArc(null);
                }
            });

            // Ring animation: only paint properties change per frame, no data re-tiling
            let last = 0;
            const tick = (now: number) => {
                raf = requestAnimationFrame(tick);
                if (now - last < RING_FRAME_MS) return;
                last = now;
                if (!ringCountRef.current) return;
                for (let i = 0; i < RING_COUNT; i++) {
                    if (!m.getLayer(lyrRing(i))) continue;
                    const age = (((now - i * RING_REPEAT_MS) % RING_LIFETIME_MS) + RING_LIFETIME_MS) % RING_LIFETIME_MS;
                    const phase = Math.max(age / RING_LIFETIME_MS, 0.001);
                    m.setPaintProperty(lyrRing(i), 'circle-radius', ringRadiusExpr(phase));
                    m.setPaintProperty(lyrRing(i), 'circle-stroke-opacity', 1 - phase);
                }
            };
            raf = requestAnimationFrame(tick);

            mapRef.current = m;
            setReady(true);
        })();

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            setReady(false);
            map?.remove();
            mapRef.current = null;
        };
    }, [pin]);

// ---- push data into the map ----
useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const validPilots = pilotData.filter(
        (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    );

    routesRef.current = routes;
    ringsRef.current = rings;
    pilotsRef.current = validPilots;
    ringCountRef.current = rings.length;
    fcRef.current = {
        routes: routesToFC(routes),
        rings: ringsToFC(rings),
        pilots: pilotsToFC(validPilots),
        airports: airportsToFC(airportPoints),
        range: fcRef.current.range,
    };

    // If the style hasn't loaded yet, style.load will pick the data up from fcRef
    const set = (id: string, data: FC) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as any);
    set(SRC_ROUTES, fcRef.current.routes);
    set(SRC_RINGS, fcRef.current.rings);
    set(SRC_PILOTS, fcRef.current.pilots);
    set(SRC_AIRPORTS, fcRef.current.airports);

    syncPinnedRef.current?.();
}, [ready, routes, rings, airportPoints, pilotData]);

// ---- planner range circle ----
useEffect(() => {
    const fc = rangeToFC(rangeCircle ?? null);
    fcRef.current = { ...fcRef.current, range: fc }; // style.load reads this after a day/night switch
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource(SRC_RANGE) as GeoJSONSource | undefined)?.setData(fc as any);
}, [rangeCircle, ready]);

    // ---- day / night basemap ----
    const firstStyleRun = useRef(true);
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        if (firstStyleRun.current) {
            firstStyleRun.current = false;
            return; // initial style already set in the constructor
        }
        mapRef.current.setStyle(dayNightMode ? STYLE_NIGHT : STYLE_DAY);
    }, [dayNightMode, ready]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {/* Map container: starry background shows through behind the globe */}
            <div
                ref={containerRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#000',
                    backgroundImage: 'url(/textures/night-sky.png)',
                    backgroundSize: 'cover',
                }}
            />

            {/* Event Tooltip Card */}
            {hoveredArc && !isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        ...getTooltipStyle(mousePos.current.x, mousePos.current.y, 280),
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '8px',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        maxWidth: '280px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {hoveredArc.banner && (
                        <img
                            src={hoveredArc.banner}
                            alt={hoveredArc.eventName}
                            style={{
                                width: '100%',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                objectFit: 'cover'
                            }}
                        />
                    )}

                    <div
                        style={{
                            display: 'inline-block',
                            backgroundColor: hoveredArc.color[0],
                            color: 'lightgray',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginBottom: '4px'
                        }}
                    >
                        {getDateTag(hoveredArc.startTime)}
                    </div>

                    <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>
                        {hoveredArc.eventName}
                    </div>

                    {hoveredArc.startTime && hoveredArc.endTime && (
                        <div style={{ fontSize: '0.85rem', marginBottom: '6px', color: '#ccc' }}>
                            {hoveredArc.startTime.toLocaleString()} -{' '}
                            {hoveredArc.endTime.toLocaleString()}
                        </div>
                    )}

                    <div style={{ fontSize: '0.9rem' }}>
                        <strong>Airports:</strong>{' '}
                        {hoveredArc.airportsInvolved.join(', ')}
                    </div>
                </div>
            )}

            {/* Pilot Tooltip */}
            {hoveredPilot && !isMobile && hoveredPilot.callsign !== pinnedCallsign && (
                <div
                    style={{
                        position: 'fixed',
                        ...getTooltipStyle(mousePos.current.x, mousePos.current.y, 260),
                        backgroundColor: 'rgba(12,16,24,0.92)',
                        backdropFilter: 'blur(6px)',
                        color: '#fff',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderTop: '2px solid #19d219',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        width: '240px',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <PilotCard pilot={hoveredPilot} />
                </div>
            )}

            {/* Pinned pilot popup (desktop) */}
            {pinnedPilot && pinnedPos && !isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        ...getTooltipStyle(pinnedPos.x, pinnedPos.y, 260, 190),
                        backgroundColor: 'rgba(12,16,24,0.95)',
                        backdropFilter: 'blur(6px)',
                        color: '#fff',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderTop: '2px solid #19d219',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                        zIndex: 9998,
                        width: '240px',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <button
                        type="button"
                        aria-label="Close pilot popup"
                        onClick={() => pin(null)}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '24px',
                            height: '24px',
                            border: 'none',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#ddd',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                        }}
                    >
                        ✕
                    </button>
                    <PilotCard pilot={pinnedPilot} padRight={24} />
                </div>
            )}

            {/* Mobile event sheet */}
            {hoveredArc && isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 15,
                        right: 15,
                        background: 'rgba(0,0,0,0.95)',
                        color: '#fff',
                        padding: '14px',
                        zIndex: 10000,
                        borderTopLeftRadius: '14px',
                        borderTopRightRadius: '14px',
                        boxShadow: '0 -4px 14px rgba(0,0,0,0.45)',
                        maxHeight: '50vh',
                        overflowY: 'auto',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {hoveredArc.banner && (
                        <img
                            src={hoveredArc.banner}
                            alt={hoveredArc.eventName}
                            style={{
                                width: '100%',
                                height: '140px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                marginBottom: '10px',
                            }}
                        />
                    )}

                    <div
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            fontSize: '1.25rem',
                            cursor: 'pointer',
                            color: '#ddd',
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: '50%',
                            width: '28px',
                            textAlign: 'center',
                        }}
                        onClick={() => setHoveredArc(null)}
                    >
                        ✕
                    </div>

                    {hoveredArc.startTime && (
                        <div
                            style={{
                                display: 'inline-block',
                                backgroundColor: hoveredArc.color[0],
                                color: 'lightgray',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginBottom: '6px',
                            }}
                        >
                            {getDateTag(hoveredArc.startTime)}
                        </div>
                    )}

                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '6px' }}>
                        {hoveredArc.eventName}
                    </div>

                    {hoveredArc.startTime && hoveredArc.endTime && (
                        <div style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#ccc' }}>
                            {hoveredArc.startTime.toLocaleString()} –{' '}
                            {hoveredArc.endTime.toLocaleString()}
                        </div>
                    )}

                    <div style={{ fontSize: '0.9rem' }}>
                        <strong>Airports:</strong>{' '}
                        {hoveredArc.airportsInvolved.join(', ')}
                    </div>
                </div>
            )}

            {/* Mobile pilot sheet */}
            {hoveredPilot && isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: 15,
                        right: 15,
                        background: 'rgba(0,0,0,0.95)',
                        color: '#fff',
                        padding: '14px',
                        zIndex: 10000,
                        borderTopLeftRadius: '12px',
                        borderTopRightRadius: '12px',
                        boxShadow: '0 -4px 12px rgba(0,0,0,0.4)',
                        fontFamily: 'sans-serif',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            fontSize: '1.25rem',
                            cursor: 'pointer',
                            color: '#ddd',
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: '50%',
                            width: '28px',
                            textAlign: 'center',
                        }}
                        onClick={() => setHoveredPilot(null)}
                    >
                        ✕
                    </div>

                    <PilotCard pilot={hoveredPilot} padRight={36} />
                </div>
            )}
        </div>
    );
});

GlobeComponent.displayName = 'GlobeComponent';

export default GlobeComponent;