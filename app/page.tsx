"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Ring, Pilot, DateCategory } from "@/app/types";
import { dedupeEventsByEarliest, buildRoutesAndRings } from "@/app/components/events";
import airportsDb from "@/app/data/airports.json";
import GlobeWrapper from "@/app/components/globeWrapper";
import SettingsPanel from "@/app/components/settingsPanel";
import EventSidePanel from "@/app/components/eventSidePanel";
import styles from "./page.module.css";
import { GlobeHandle } from "./components/globeComponents";
import { fixedEventsProcessed } from "./components/fixedEvents";

const ZOOM_LEVEL_WHEN_FLYING_TO_EVENT = 0.25;

export default function Home() {

    const globeRef = useRef<GlobeHandle>(null);
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
        day6plus: false,
    });
    const [panelCollapsed, setPanelCollapsed] = useState(true);
    const [useDateRange, setUseDateRange] = useState(false);
    const [dateRange, setDateRange] = useState<{
        start: string | null;
        end: string | null;
        }>({
        start: null,
        end: null
    });
    const [showNormalEvents, setShowNormalEvents] = useState(true);
    const [showExamEvents, setShowExamEvents] = useState(true);

    const toggleNormalEvents = () => {
        setShowNormalEvents(prev => {
            // If turning OFF the last enabled one, flip exams ON
            if (prev && !showExamEvents) {
                setShowExamEvents(true);
            }
            return !prev;
        });
    };

    const toggleExamEvents = () => {
        setShowExamEvents(prev => {
            // If turning OFF the last enabled one, flip normal ON
            if (prev && !showNormalEvents) {
                setShowNormalEvents(true);
            }
            return !prev;
        });
    };
    
    useEffect(() => {
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        setPanelCollapsed(isMobile);
    }, []);

    useEffect(() => {
        fetch("/api/vatsim/events", { next: { revalidate: 300 } })
            .then(res => res.json())
            .then(json => {
                const apiEvents = json.data;

                const now = new Date();

                const fixedEvents = fixedEventsProcessed();
                // const fixedEvents: never[] = []; // KEEP EMPTY FOR NOW, weeek timing fix incomplete.
                // console.log("FIXED EVENTS (after processing):", fixedEvents);

                // Merge API + fixed events
                const mergedEvents = [...apiEvents, ...fixedEvents];
                
                // TODO: FIXED EVENTS can't carry isWeekly through the [...] merge.

                // console.log("Merged events (API + fixed):", mergedEvents);
                
                const dedupedEvents = dedupeEventsByEarliest(mergedEvents);
                // console.log("Deduped events:", dedupedEvents);
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

    const isWithinDateRange = (start: Date, end: Date) => {
        if (!useDateRange || !dateRange.start || !dateRange.end) return true;

        const rangeStart = new Date(dateRange.start);
        const rangeEnd = new Date(dateRange.end);

        // Event overlaps the selected range
        return start <= rangeEnd && end >= rangeStart;
    };

    // Filtering
    const filteredRoutes = useMemo(() => {
        // Keep inside useMemo to avoid re-defining on every render, since it's used in both routes and rings filtering
        const isExamEvent = (name: string) => name.toLowerCase().includes("exam");

        return routes.filter(r => {
            const exam = isExamEvent(r.eventName);

            if (exam && !showExamEvents) return false;
            if (!exam && !showNormalEvents) return false;

            if (useDateRange) {
                return isWithinDateRange(r.startTime, r.endTime);
            }

            return enabledCategories[r.category];
        });
    }, [routes, showExamEvents, showNormalEvents, useDateRange, dateRange, enabledCategories]);

    const filteredRings = useMemo(() => {
        // Keep inside useMemo to avoid re-defining on every render, since it's used in both routes and rings filtering
        const isExamEvent = (name: string) => name.toLowerCase().includes("exam");

        return rings.filter(r => {
            const exam = isExamEvent(r.eventName);

            if (exam && !showExamEvents) return false;
            if (!exam && !showNormalEvents) return false;

            if (useDateRange) {
                return isWithinDateRange(r.startTime, r.endTime);
            }

            return enabledCategories[r.category];
        });
    }, [rings, showExamEvents, showNormalEvents, useDateRange, dateRange, enabledCategories]);

    const usedIcaos = useMemo(() => {
        const set = new Set<string>();
        filteredRoutes.forEach(r => {
            set.add(r.startIcao);
            set.add(r.endIcao);
        });
        filteredRings.forEach(r => set.add(r.icao));
        return set;
    }, [filteredRoutes, filteredRings]);

    const airportPoints = useMemo(() => {
        return Object.entries(airportsDb)
            .filter(([icao]) => usedIcaos.has(icao))
            .map(([icao, coords]) => ({
                lat: coords.lat,
                lng: coords.lng,
                label: icao
            }));
    }, [usedIcaos]);

    // Filter pilots for ongoing events
    const ongoingEventIcaos = useMemo(() => {
        const set = new Set<string>();

        filteredRings
            .filter(r => r.category === "ongoing")
            .forEach(r => set.add(r.icao));

        filteredRoutes
            .filter(r => r.category === "ongoing")
            .forEach(r => {
                set.add(r.startIcao);
                set.add(r.endIcao);
            });

        return set;
    }, [filteredRoutes, filteredRings]);

    const pilotDataFiltered = useMemo(() => {
        return pilotData.filter(pilot => {
            if (!pilot.flight_plan) return false;
            if (!eventPilotToggle) return true;

            return (
                ongoingEventIcaos.has(pilot.flight_plan.departure) ||
                ongoingEventIcaos.has(pilot.flight_plan.arrival)
            );
        });
    }, [pilotData, eventPilotToggle, ongoingEventIcaos]);

    const handleEventClick = useCallback((event: { coords: { lat: number; lon: number; }[]; }) => {
        const lat = event.coords[0].lat;
        const lon = event.coords[0].lon;
        globeRef.current?.flyTo(lat, lon, ZOOM_LEVEL_WHEN_FLYING_TO_EVENT);
    }, []);


    return (
        <div className={styles.root}>
            <button
                onClick={() => setPanelCollapsed(prev => !prev)}
                className={`${styles.panelToggle} ${
                    panelCollapsed ? styles.panelClosed : styles.panelOpen
                }`}
            >
                {panelCollapsed ? "▶" : "◀"}
            </button>

            <EventSidePanel
                routes={filteredRoutes}
                rings={filteredRings}
                collapsed={panelCollapsed}
                onEventClick={handleEventClick}
            />

            <main>
                <GlobeWrapper
                    ref={globeRef}
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

                showNormalEvents={showNormalEvents}
                showExamEvents={showExamEvents}
                toggleNormalEvents={toggleNormalEvents}
                toggleExamEvents={toggleExamEvents}

                useDateRange={useDateRange}
                setUseDateRange={setUseDateRange}
                dateRange={dateRange}
                setDateRange={setDateRange}
            />

            {/* Title */}
            <div className={styles.title}>
                <span style={{ fontWeight: "bold", textAlign: "center" }}>VATSIM EVENTS 3D MAP</span>
                <span className={styles.subtitle} style={{ textAlign: "center" }}>
                    Version 1.4 | by Miggle |{" "}
                    <a href="https://github.com/RyanLee355/VatsimEventsMap">GitHub Repo.</a>
                </span>
            </div>
        </div>
    );
}