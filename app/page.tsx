"use client";
import { useEffect, useState } from "react";
import { Route, Ring, Pilot, DateCategory } from "@/app/types";
import { dedupeEventsByEarliest, buildRoutesAndRings } from "@/app/components/events";
import airportsDb from "@/app/data/airports.json";
import GlobeWrapper from "@/app/components/globeWrapper";
import SettingsPanel from "@/app/components/settingsPanel";
import EventSidePanel from "@/app/components/eventSidePanel";

export default function Home() {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [rings, setRings] = useState<Ring[]>([]);
    const [pilotData, setPilotData] = useState<Pilot[]>([]);
    const [pilotToggle, setPilotToggle] = useState(true);
    const [eventPilotToggle, setEventPilotToggle] = useState(false);
    const [dayNightToggle, setDayNightToggle] = useState(true);
    const [enabledCategories, setEnabledCategories] = useState<Record<DateCategory, boolean>>({
        ongoing: true,
        today: true,
        tomorrow: true,
        day2: true,
        day3: true,
        day4to5: true,
        day6plus: true,
    });
    const [panelCollapsed, setPanelCollapsed] = useState(false);

    useEffect(() => {
        fetch("/api/vatsim/events", { next: { revalidate: 300 } })
        .then(res => res.json())
        .then(json => {
            const dedupedEvents = dedupeEventsByEarliest(json.data);
            const { allRoutes, allRings } = buildRoutesAndRings(dedupedEvents);
            setRoutes(allRoutes);
            setRings(allRings);
        });
    }, []);

    useEffect(() => {
        fetch("/api/vatsim/data", { next: { revalidate: 15 } })
        .then(res => res.json())
        .then(json => setPilotData(json.pilots));
    }, []);

    const toggleCategory = (cat: DateCategory) => setEnabledCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    const togglePilots = () => setPilotToggle(prev => !prev);
    const togglePilotsEvent = () => setEventPilotToggle(prev => !prev);
    const toggleDayNight = () => setDayNightToggle(prev => !prev);

    // Filtering
    const filteredRoutes = routes.filter(r => enabledCategories[r.category]);
    const filteredRings = rings.filter(r => enabledCategories[r.category]);

    const usedIcaos = new Set<string>();
    filteredRoutes.forEach(r => { usedIcaos.add(r.startIcao); usedIcaos.add(r.endIcao); });
    filteredRings.forEach(r => usedIcaos.add(r.icao));

    const airportPoints = Object.entries(airportsDb)
        .filter(([icao]) => usedIcaos.has(icao))
        .map(([icao, coords]) => ({ lat: coords.lat, lng: coords.lng, label: icao }));

    // Filter pilots for ongoing events
    const ongoingEventIcaos = new Set(filteredRings.filter(r => r.category === 'ongoing').map(r => r.icao));
    filteredRoutes.filter(r => r.category === 'ongoing').forEach(r => { ongoingEventIcaos.add(r.startIcao); ongoingEventIcaos.add(r.endIcao); });

    const pilotDataFiltered = pilotData.filter(pilot => {
        if (!pilot.flight_plan) return false;
        if (!eventPilotToggle) return true;
        return ongoingEventIcaos.has(pilot.flight_plan.departure) || ongoingEventIcaos.has(pilot.flight_plan.arrival);
    });

    return (
        <div style={{ fontFamily: 'monospace' }}>
            <button
                onClick={() => setPanelCollapsed(prev => !prev)}
                style={{
                    position: "fixed",
                    top: "20px",
                    left: 0,
                    zIndex: 11000,
                    backgroundColor: "rgba(0,0,0,0.7)",
                    color: "white",
                    border: "none",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transform: panelCollapsed ? "translateX(0)" : "translateX(25vw)", // slide with panel
                    transition: "transform 0.3s ease",
                }}
            >
                {panelCollapsed ? "▶" : "◀"}
            </button>

            <EventSidePanel routes={filteredRoutes} rings={filteredRings} collapsed={panelCollapsed} />

            <main>
                <GlobeWrapper
                    routes={filteredRoutes}
                    rings={filteredRings}
                    airportPoints={airportPoints}
                    pilotData={pilotToggle ? pilotDataFiltered : []}
                    dayNightMode={dayNightToggle}
                />
            </main>

            <SettingsPanel
                enabledCategories={enabledCategories}
                toggleCategory={toggleCategory}
                pilotToggle={pilotToggle}
                eventPilotToggle={eventPilotToggle}
                dayNightToggle={dayNightToggle}
                togglePilots={togglePilots}
                togglePilotsEvent={togglePilotsEvent}
                toggleDayNight={toggleDayNight}
            />

            {/* Title (could also be modularized if needed) */}
            <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', color: 'white', opacity: 0.85, padding: '8px 16px', borderRadius: '8px', fontSize: '1.5rem', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>VATSIM EVENTS 3D MAP</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Version 1.1 | by Miggle | <a href="https://github.com/RyanLee355/VatsimEventsMap">GitHub Repo.</a></span>
            </div>
        </div>
    );
}