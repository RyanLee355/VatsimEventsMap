'use client';
import { useEffect, useState, useRef, forwardRef, useImperativeHandle, memo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Pilot, Ring, Route } from '@/app/types';

// Only load react-globe.gl on the client
const GlobeBase = dynamic(() => import('react-globe.gl'), { ssr: false });

export type GlobeHandle = {
    flyTo: (lat: number, lng: number, altitude?: number) => void;
};

const GlobeComponent = forwardRef<GlobeHandle, {
    routes: Route[];
    rings: Ring[];
    airportPoints: any[];
    pilotData: Pilot[];
    dayNightMode: boolean;
}>(({ routes, rings, airportPoints, pilotData, dayNightMode }, ref) => {

    const mousePos = useRef({ x: 0, y: 0 });
    const [hoveredArc, setHoveredArc] = useState<any | null>(null);
    const [hoveredPilot, setHoveredPilot] = useState<any | null>(null);
    const [viewport, setViewport] = useState({ w: 0, h: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const globeRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        flyTo(lat: number, lng: number, altitude = 1.5) {
            if (!globeRef.current) return;

            globeRef.current.pointOfView(
                { lat, lng, altitude },
                1200 // animation duration (ms)
            );
        }
    }));

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            setIsMobile(w <= 768);
            setViewport({ w, h });
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
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

    useEffect(() => {
        if (isMobile) return;

        let raf = 0;

        const handleMouseMove = (e: MouseEvent) => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
            mousePos.current.x = e.clientX;
            mousePos.current.y = e.clientY;
            raf = 0;
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [isMobile]);

    const arcColor = useCallback((d: any) => d.color, []);
    const ringColor = useCallback((d: any) => d.color, []);
    const pointColor = useCallback(() => "#007900", []);

    const handleArcHover = useCallback(
        (arc: any) => {
            setHoveredPilot(null);

            setHoveredArc((prev: any) => {
            if (prev === arc) return prev;
                return arc;
            });
        },
        []
    );


    const handlePointHover = useCallback(
        (pilot: any) => {
            if (pilot) {
                setHoveredPilot(pilot);
                setHoveredArc(null);
            } else if (!isMobile) {
                setHoveredPilot(null);
            }
        },
        [isMobile]
    );

    const getDateTag = useCallback((startTime: Date) => {
        const now = new Date();
        const start = new Date(startTime);

        const diff =
            new Date(start.setHours(0,0,0,0)).getTime() -
            new Date(now.setHours(0,0,0,0)).getTime();

        const diffDays = Math.round(diff / 86400000);

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays > 1) return `In ${diffDays} Days`;
        return `${Math.abs(diffDays)} Days Ago`;
    }, []);

    return (
        <div
            style={{width: "100vw", height: "100vh"}}
        >
            <GlobeBase
                ref={globeRef}
                globeImageUrl={dayNightMode ?
                    "/textures/earth-night.jpg"
                    :
                    // "/textures/2k_earth_daymap.jpg"
                    "/textures/flat_earth_Largest_still_nasa.jpg"
                }
                
                bumpImageUrl="/textures/earth-topology.png"
                backgroundImageUrl="/textures/night-sky.png"
                showGlobe={true}
                showGraticules={true}

                arcsData={routes}
                arcColor={arcColor}
                onArcHover={handleArcHover}

                ringsData={rings}
                ringPropagationSpeed={0.02}
                ringResolution={32}
                ringMaxRadius={.25}
                ringColor={ringColor}
                ringRepeatPeriod={5000}

                labelsData={airportPoints}
                labelText={(d: any) => d.label}
                labelSize={0.15}
                labelAltitude={0.0}

                // New layer: pilots as points
                pointsData={pilotData}
                pointLabel={(d: any) => ``}
                pointLat={(d: any) => d.latitude}
                pointLng={(d: any) => d.longitude}
                pointAltitude={(d: any) => 0} // normalize to globe radius
                pointColor={pointColor} // or color by type/rating
                pointRadius={0.04}
                onPointHover={handlePointHover}
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
                    {/* Banner Image */}
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

                    {/* Tags */}
                    {/* 1. Date Tag */}
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

                    {/* Event Name */}
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>
                        {hoveredArc.eventName}
                    </div>

                    {/* Date & Time */}
                    {hoveredArc.startTime && hoveredArc.endTime && (
                        <div style={{ fontSize: '0.85rem', marginBottom: '6px', color: '#ccc' }}>
                            {hoveredArc.startTime.toLocaleString()} -{' '}
                            {hoveredArc.endTime.toLocaleString()}
                        </div>
                    )}

                    {/* Airports Involved */}
                    <div style={{ fontSize: '0.9rem' }}>
                        <strong>Airports:</strong>{' '}
                        {hoveredArc.airportsInvolved.join(', ')}
                    </div>

                </div>
            )}

            {/* Pilot Tooltip */}
            {hoveredPilot && !isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        ...getTooltipStyle(mousePos.current.x, mousePos.current.y, 280),
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        color: '#fff',
                        padding: '8px',
                        borderRadius: '6px',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        maxWidth: '220px',
                        fontFamily: 'sans-serif',
                        fontSize: '0.85rem',
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {hoveredPilot.callsign} — {hoveredPilot.name}
                    </div>
                    {/* <div>Latitude: {hoveredPilot.latitude.toFixed(4)}</div>
                    <div>Longitude: {hoveredPilot.longitude.toFixed(4)}</div> */}
                    <div>ALT: {hoveredPilot.altitude} ft</div>
                    <div>GS: {hoveredPilot.groundspeed} kt</div>
                    {hoveredPilot.flight_plan && (
                        <div>Route: {hoveredPilot.flight_plan.departure} → {hoveredPilot.flight_plan.arrival}</div>
                    )}
                </div>
            )}

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

                    {/* Banner image */}
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

                    {/* Close button */}
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

                    {/* Date tag */}
                    {hoveredArc.startTime && (() => {
                        const now = new Date();
                        const startDate = new Date(hoveredArc.startTime);
                        const diffTime =
                            startDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
                        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                        let dateTag = '';
                        if (diffDays === 0) dateTag = 'Today';
                        else if (diffDays === 1) dateTag = 'Tomorrow';
                        else if (diffDays > 1) dateTag = `In ${diffDays} Days`;
                        else dateTag = `${Math.abs(diffDays)} Days Ago`;

                        return (
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
                                {dateTag}
                            </div>
                        );
                    })()}

                    {/* Event name */}
                    <div
                        style={{
                            fontWeight: 'bold',
                            fontSize: '1.05rem',
                            marginBottom: '6px',
                        }}
                    >
                        {hoveredArc.eventName}
                    </div>

                    {/* Date & time */}
                    {hoveredArc.startTime && hoveredArc.endTime && (
                        <div
                            style={{
                                fontSize: '0.85rem',
                                marginBottom: '8px',
                                color: '#ccc',
                            }}
                        >
                            {hoveredArc.startTime.toLocaleString()} –{' '}
                            {hoveredArc.endTime.toLocaleString()}
                        </div>
                    )}

                    {/* Airports */}
                    <div style={{ fontSize: '0.9rem' }}>
                        <strong>Airports:</strong>{' '}
                        {hoveredArc.airportsInvolved.join(', ')}
                    </div>
                </div>
            )}


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
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {hoveredPilot.callsign} — {hoveredPilot.name}
                    </div>

                    {/* Close button */}
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

                    <div>ALT: {hoveredPilot.altitude} ft</div>
                    <div>GS: {hoveredPilot.groundspeed} kt</div>
                    {hoveredPilot.flight_plan && (
                        <div>
                            Route: {hoveredPilot.flight_plan.departure} → {hoveredPilot.flight_plan.arrival}
                        </div>
                    )}
                </div>
            )}


        </div>
    );
});

export default GlobeComponent;