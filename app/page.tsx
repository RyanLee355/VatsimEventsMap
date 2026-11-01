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
import PlannerPanel from "@/app/components/PlannerPanel";
import type { LatLng, PlannerEventLike } from "@/app/components/LandingPlanner";

const ZOOM_LEVEL_WHEN_FLYING_TO_EVENT = 0.25;
const REFRESH_COOLDOWN_SECONDS = 30;

type PlannerEvent = PlannerEventLike & { key: string };

const eventKey = (name: string, start: Date | string | number) =>
    `${name}|${new Date(start).getTime()}`;

// Module-level so its identity is stable
const getAirport = (icao: string): LatLng | undefined =>
    (airportsDb as Record<string, { lat: number; lng: number }>)[icao];

export default function Home() {

    const globeRef = useRef<GlobeHandle>(null);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [rings, setRings] = useState<Ring[]>([]);
    const [activePanel, setActivePanel] = useState<"settings" | "planner" | null>(null);
    const panelOpenHandler = (name: "settings" | "planner") => (open: boolean) =>
        setActivePanel(prev => (open ? name : prev === name ? null : prev));

    const [plannerRange, setPlannerRange] =
        useState<{ lat: number; lng: number; radiusNm: number } | null>(null);

    // One planner event per real event, merged from its routes and rings
    const plannerEvents = useMemo<PlannerEvent[]>(() => {
        const map = new Map<string, PlannerEvent>();
        const upsert = (
            name: string, start: Date, end: Date, color: any,
            icaos: (string | undefined)[]
        ) => {
            const key = eventKey(name, start);
            let ev = map.get(key);
            if (!ev) {
                ev = { key, eventName: name, startTime: start, endTime: end, color, airportsInvolved: [] };
                map.set(key, ev);
            }
            for (const i of icaos) if (i && !ev.airportsInvolved.includes(i)) ev.airportsInvolved.push(i);
        };
        routes.forEach(r =>
            upsert(r.eventName, r.startTime, r.endTime, (r as any).color,
                [r.startIcao, r.endIcao, ...((r as any).airportsInvolved ?? [])]));
        rings.forEach(r =>
            upsert(r.eventName, r.startTime, r.endTime, (r as any).color, [r.icao]));
        return [...map.values()];
    }, [routes, rings]);

    const [plannerKeys, setPlannerKeys] = useState<Set<string> | null>(null);
    const handlePlannerMatches = useCallback(
        (m: Set<PlannerEvent> | null) =>
            setPlannerKeys(m ? new Set([...m].map(e => e.key)) : null),
        []
    );

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
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);

    const SETTINGS_KEY = "vatsim-events-map:settings:v1"; // bump the version if the shape ever changes

    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Load once on mount (must be in an effect: localStorage doesn't exist during server render)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                if (typeof s.pilotToggle === "boolean") setPilotToggle(s.pilotToggle);
                if (typeof s.eventPilotToggle === "boolean") setEventPilotToggle(s.eventPilotToggle);
                if (typeof s.dayNightToggle === "boolean") setDayNightToggle(s.dayNightToggle);
                if (s.enabledCategories && typeof s.enabledCategories === "object") {
                    setEnabledCategories(prev => ({ ...prev, ...s.enabledCategories }));
                }
                // keep at least one event type on
                if (typeof s.showNormalEvents === "boolean" && typeof s.showExamEvents === "boolean"
                    && (s.showNormalEvents || s.showExamEvents)) {
                    setShowNormalEvents(s.showNormalEvents);
                    setShowExamEvents(s.showExamEvents);
                }
            }
        } catch { /* corrupted or blocked storage: fall back to defaults */ }
        setSettingsLoaded(true);
    }, []);

    // Save whenever a setting changes (but only after loading, so defaults don't overwrite saved values)
    useEffect(() => {
        if (!settingsLoaded) return;
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                pilotToggle,
                eventPilotToggle,
                dayNightToggle,
                enabledCategories,
                showNormalEvents,
                showExamEvents,
            }));
        } catch { /* storage full or disabled: ignore */ }
    }, [settingsLoaded, pilotToggle, eventPilotToggle, dayNightToggle, enabledCategories, showNormalEvents, showExamEvents]);


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
        setActivePanel(isMobile ? null : "settings");
    }, []);

    const fetchEvents = useCallback(async () => {
        const [eventsJson, dataJson] = await Promise.all([
            fetch("/api/vatsim/events", { next: { revalidate: 300 } }).then(r => r.json()),
            fetch("/api/vatsim/data", { next: { revalidate: 15 } }).then(r => r.json())
        ]);

        const apiEvents = eventsJson.data;
        const fixedEvents = fixedEventsProcessed();
        const mergedEvents = [...apiEvents, ...fixedEvents];
        const dedupedEvents = dedupeEventsByEarliest(mergedEvents);
        const { allRoutes, allRings } = buildRoutesAndRings(dedupedEvents);

        setRoutes(allRoutes);
        setRings(allRings);
        setPilotData(dataJson.pilots);
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing || cooldownRemaining > 0) return;

        try {
            setIsRefreshing(true);
            setCurrentTime(new Date());
            await fetchEvents();

            // Start cooldown
            setCooldownRemaining(REFRESH_COOLDOWN_SECONDS);
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchEvents, isRefreshing, cooldownRemaining]);

    useEffect(() => {
        if (cooldownRemaining <= 0) return;

        const interval = setInterval(() => {
            setCooldownRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [cooldownRemaining]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    const toggleCategory = (cat: DateCategory) => setEnabledCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    const togglePilots = () => setPilotToggle(prev => !prev);
    const togglePilotsEvent = () => setEventPilotToggle(prev => !prev);
    const toggleDayNight = () => setDayNightToggle(prev => !prev);

    const isWithinDateRange = useCallback((start: Date, end: Date) => {
        if (!useDateRange || !dateRange.start || !dateRange.end) return true;

        const rangeStart = new Date(dateRange.start);
        const rangeEnd = new Date(dateRange.end);

        return start <= rangeEnd && end >= rangeStart;
    }, [useDateRange, dateRange]);


    // Filtering

    const passesEventFilters = useCallback((
        eventName: string,
        category: DateCategory,
        startTime: Date,
        endTime: Date
    ) => {
        if (plannerKeys) return plannerKeys.has(eventKey(eventName, startTime));

        const exam = eventName.toLowerCase().includes("exam");

        if (exam && !showExamEvents) return false;
        if (!exam && !showNormalEvents) return false;

        if (useDateRange) {
            return isWithinDateRange(startTime, endTime);
        }

        return enabledCategories[category];
    }, [showExamEvents, showNormalEvents, useDateRange, dateRange, enabledCategories]);

    const filteredRoutes = useMemo(() =>
        routes.filter(r =>
            passesEventFilters(r.eventName, r.category, r.startTime, r.endTime)
        ),
    [routes, passesEventFilters]);

    const filteredRings = useMemo(() =>
        rings.filter(r =>
            passesEventFilters(r.eventName, r.category, r.startTime, r.endTime)
        ),
    [rings, passesEventFilters]);

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
                currentTime={currentTime}
                onRefresh={handleRefresh}
                cooldownRemaining={cooldownRemaining}
                isRefreshing={isRefreshing}
                onEventClick={handleEventClick}
            />


            <main>
                {settingsLoaded && (
                    <GlobeWrapper
                        ref={globeRef}
                        routes={filteredRoutes}
                        rings={filteredRings}
                        airportPoints={airportPoints}
                        pilotData={pilotToggle ? pilotDataFiltered : []}
                        dayNightMode={dayNightToggle}
                        rangeCircle={plannerRange}
                    />
                )}
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

                open={activePanel === "settings"}
                onOpenChange={panelOpenHandler("settings")}
            />

            <PlannerPanel
                events={plannerEvents}
                getAirport={getAirport}
                onFocus={(lat, lng) => globeRef.current?.flyTo(lat, lng, ZOOM_LEVEL_WHEN_FLYING_TO_EVENT)}
                onMatches={handlePlannerMatches}
                open={activePanel === "planner"}
                onOpenChange={panelOpenHandler("planner")}
                onRange={setPlannerRange}
            />

            {/* Title */}
            <div className={styles.title}>
                <span style={{ fontWeight: "bold", textAlign: "center" }}>VATSIM EVENTS 3D MAP</span>
                <span className={styles.subtitle} style={{ textAlign: "center" }}>
                    Version 1.5 | by Miggle
                    {/* <a href="https://github.com/RyanLee355/VatsimEventsMap">GitHub Repo.</a> */}
                </span>
            </div>
        </div>
    );
}