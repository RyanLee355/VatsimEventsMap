'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Pilot, Ring, Route } from '../page';
// Only load react-globe.gl on the client
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function GlobeComponent({
    routes,
    rings,
    airportPoints,
    pilotData,
}: {
    routes: Route[];
    rings: Ring[];
    airportPoints: any[];
    pilotData: Pilot[];
}) {
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [hoveredArc, setHoveredArc] = useState<any | null>(null);
    const [hoveredPilot, setHoveredPilot] = useState<any | null>(null);

    return (
        <div
            className="relative"
            onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
            style={{width: "100vw", height: "100vh"}}
        >
            <Globe
                globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
                // globeImageUrl="/textures/8k_earth_nightmap.jpg"
                // globeImageUrl="/textures/2k_earth_daymap.jpg"
                
                bumpImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
                backgroundImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png"
                showGlobe={true}
                showGraticules={true}

                arcsData={routes}
                arcColor={(d: any) => d.color}
                onArcHover={(arc, prevArc) => {
                    // console.log("Arc: ", arc);
                    setHoveredArc(arc ?? null);
                }}

                ringsData={rings}
                ringPropagationSpeed={0.02}
                ringResolution={32}
                ringMaxRadius={.25}
                ringColor={(d: any) => d.color}
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
                pointColor={() => "#007900"} // or color by type/rating
                pointRadius={0.04}
                onPointHover={(pilot) => setHoveredPilot(pilot ?? null)}
            />

            {/* Event Tooltip Card */}
            {hoveredArc && (
                <div
                    style={{
                        position: 'fixed',
                        top: mousePos.y + 10,
                        left: mousePos.x + 10,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '8px',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        maxWidth: '280px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        fontFamily: 'sans-serif'
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
                    {hoveredArc.startTime && (() => {
                        const now = new Date();
                        const startDate = new Date(hoveredArc.startTime);
                        const diffTime = startDate.setHours(0,0,0,0) - now.setHours(0,0,0,0);
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
                                    marginBottom: '4px'
                                }}
                            >
                                {dateTag}
                            </div>
                        );
                    })()}

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
            {hoveredPilot && (
                <div
                    style={{
                        position: 'fixed',
                        top: mousePos.y + 10,
                        left: mousePos.x + 10,
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

        </div>
    );
}