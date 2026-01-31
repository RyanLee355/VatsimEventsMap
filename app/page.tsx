"use client";
import { useEffect, useState } from "react";
import { Route, Ring, Pilot, DateCategory } from "@/app/types";
import { dedupeEventsByEarliest, buildRoutesAndRings } from "@/app/components/events";
import airportsDb from "@/app/data/airports.json";
import GlobeWrapper from "@/app/components/globeWrapper";
import SettingsPanel from "@/app/components/settingsPanel";
import EventSidePanel from "@/app/components/eventSidePanel";
import styles from "./page.module.css";

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

    const isWithinDateRange = (start: Date, end: Date) => {
        if (!useDateRange || !dateRange.start || !dateRange.end) return true;

        const rangeStart = new Date(dateRange.start);
        const rangeEnd = new Date(dateRange.end);

        // Event overlaps the selected range
        return start <= rangeEnd && end >= rangeStart;
    };

    const isExamEvent = (name: string) =>
        name.toLowerCase().includes("exam");

    // Filtering
    const filteredRoutes = routes.filter(r => {
        const exam = isExamEvent(r.eventName);

        if (exam && !showExamEvents) return false;
        if (!exam && !showNormalEvents) return false;

        if (useDateRange) {
            return isWithinDateRange(r.startTime, r.endTime);
        }

        return enabledCategories[r.category];
    });

    const filteredRings = rings.filter(r => {
        const exam = isExamEvent(r.eventName);

        if (exam && !showExamEvents) return false;
        if (!exam && !showNormalEvents) return false;

        if (useDateRange) {
            return isWithinDateRange(r.startTime, r.endTime);
        }

        return enabledCategories[r.category];
    });

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
        <div className={styles.root}>
            <button
                onClick={() => setPanelCollapsed(prev => !prev)}
                className={`${styles.panelToggle} ${
                    panelCollapsed ? styles.panelClosed : styles.panelOpen
                }`}
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
                    Version 1.2 | by Miggle |{" "}
                    <a href="https://github.com/RyanLee355/VatsimEventsMap">GitHub Repo.</a>
                </span>
            </div>
        </div>
    );
}