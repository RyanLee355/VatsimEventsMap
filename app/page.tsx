"use client";
import { useState, useEffect } from "react";
import GlobeComponent from "./components/globeComponents";
import airportsDb from "@/app/data/airports.json";

export type Route = {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    color: string[];
    eventName: string;
    startTime: Date;
    endTime: Date;
    banner: string | null;
    airportsInvolved: string[];
    category: DateCategory;
    startIcao: string;
    endIcao: string;
};

export type Ring = {
    lat: number;
    lng: number;
    color: string[];
    eventName: string;
    startTime: Date;
    endTime: Date;
    radius?: number;
    banner: string | null;
    category: DateCategory;
    icao: string;
};

type DateCategory =
    | 'ongoing'
    | 'today'
    | 'tomorrow'
    | 'day2'
    | 'day3'
    | 'day4to5'
    | 'day6plus';

type NetworkData = {
    general: GeneralInfo;
    pilots: Pilot[];
    controllers: Controller[];
    atis: Atis[];
    servers: Server[];
};

type GeneralInfo = {
    version: number;
    reload: number;
    update: string; // ISO timestamp string
};

export type Pilot = {
    cid: number;
    name: string;
    callsign: string;
    server: string;

    pilot_rating: number;
    military_rating: number;

    latitude: number;
    longitude: number;
    altitude: number;
    groundspeed: number;
    heading: number;
    transponder: string;

    qnh_i_hg: number;
    qnh_mb: number;

    flight_plan: FlightPlan | null;

    logon_time: string;
    last_updated: string;
};

export type FlightPlan = {
    flight_rules: string;
    aircraft: string;
    aircraft_faa: string;

    departure: string;
    arrival: string;
    alternate: string;

    cruise_tas: number;
    altitude: string;

    route: string;
    remarks: string;

    enroute_time: string;
    fuel_time: string;
};

export type Controller = {
    cid: number;
    name: string;
    callsign: string;
    frequency: string;

    facility: number;
    rating: number;
    server: string;

    visual_range: number;
    text_atis: string | null;

    logon_time: string;
    last_updated: string;
};

export type Atis = {
    cid: number;
    callsign: string;
    frequency: string;
    facility: number;

    text_atis: string[];
    logon_time: string;
    last_updated: string;
};

export type Server = {
    ident: string;
    hostname: string;
    location: string;
};

function eventToRoutesAndRings(
    event: {
        airports: { icao: string }[];
        name: string;
        start_time: string;
        end_time: string;
        banner: string | null;
    },
    airportsDb: { [icao: string]: { lat: number; lng: number; name: string } }
): { routes: Route[]; rings: Ring[] } {
    const routes: Route[] = [];
    const rings: Ring[] = [];

    if (!event.airports || event.airports.length === 0) return { routes, rings };
        const allIcaosWithNames = event.airports.map((a) => {
        const airport = airportsDb[a.icao];
        return airport ? `${airport.name} - (${a.icao})` : a.icao;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getColorForEvent = (startTime: Date, endTime: Date) => {
        const now = new Date();
        if (now >= startTime && now <= endTime) return ["#00ff00", "#00ff00"]; // ongoing
        const eventDay = new Date(startTime);
        eventDay.setHours(0, 0, 0, 0);
        const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (1000*60*60*24));
        if (diffDays <= 0) return ["#cea500", "#cea500"];
        if (diffDays === 1) return ["#c96b00", "#c96b00"];
        if (diffDays === 2) return ["#be3333", "#be3333"];
        if (diffDays === 3) return ["#ff00ff91", "#ff00ff91"];
        if (diffDays <= 5) return ["#8800ff", "#8800ff"];
        return ["#00f", "#0ff"];
    };

    function getEventDateCategory(startTime: Date, endTime: Date): DateCategory {
        const now = new Date();

        if (now >= startTime && now <= endTime) return 'ongoing';

        const today = new Date();
        today.setHours(0,0,0,0);

        const eventDay = new Date(startTime);
        eventDay.setHours(0,0,0,0);

        const diffDays = Math.round(
            (eventDay.getTime() - today.getTime()) / (1000*60*60*24)
        );

        if (diffDays <= 0) return 'today';
        if (diffDays === 1) return 'tomorrow';
        if (diffDays === 2) return 'day2';
        if (diffDays === 3) return 'day3';
        if (diffDays <= 5) return 'day4to5';
        return 'day6plus';
    }

    if (event.airports.length === 1) {
        const a = event.airports[0].icao;
        const airport = airportsDb[a];
        if (!airport) return { routes, rings };

        rings.push({
            icao: a,
            lat: airport.lat,
            lng: airport.lng,
            color: getColorForEvent(new Date(event.start_time), new Date(event.end_time)),
            category: getEventDateCategory(new Date(event.start_time), new Date(event.end_time)),
            eventName: event.name,
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            radius: 100000, // in meters, adjust as needed
            banner: event.banner,
        });
    }

    if (event.airports.length === 1) {
        const a = event.airports[0].icao;
        const airport = airportsDb[a];
        if (!airport) return { routes, rings };

        const offset = 0.05; // Lat/Long Degs. offset for visual separation

        routes.push({
            startIcao: a,
            endIcao: a,
            startLat: airport.lat,
            startLng: airport.lng,
            endLat: airport.lat,
            endLng: airport.lng + offset,
            color: getColorForEvent(
                new Date(event.start_time),
                new Date(event.end_time)
            ),
            category: getEventDateCategory(new Date(event.start_time), new Date(event.end_time)),
            eventName: event.name,
            startTime: new Date(event.start_time),
            endTime: new Date(event.end_time),
            banner: event.banner,
            airportsInvolved: [`${airport.name} - (${a})`],
        });

        return { routes, rings };
    }


    const seenPairs = new Set<string>();

    for (let i = 0; i < event.airports.length; i++) {
        for (let j = i+1; j < event.airports.length; j++) {
            const a1 = event.airports[i].icao;
            const a2 = event.airports[j].icao;
            const pairKey = [a1,a2].sort().join('-');
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);

            const p1 = airportsDb[a1];
            const p2 = airportsDb[a2];
            if (!p1 || !p2) continue;

            routes.push({
                startIcao: a1,
                endIcao: a2,
                startLat: p1.lat,
                startLng: p1.lng,
                endLat: p2.lat,
                endLng: p2.lng,
                color: getColorForEvent(new Date(event.start_time), new Date(event.end_time)),
                category: getEventDateCategory(new Date(event.start_time), new Date(event.end_time)),
                eventName: event.name,
                startTime: new Date(event.start_time),
                endTime: new Date(event.end_time),
                banner: event.banner,
                airportsInvolved: allIcaosWithNames,
            });
        }
    }

    return { routes, rings };
}

function buildRoutesAndRings(events: any[], airportsDb: any) {
    const allRoutes: Route[] = [];
    const allRings: Ring[] = [];

    events.forEach(event => {
        const { routes, rings } = eventToRoutesAndRings(event, airportsDb);
        allRoutes.push(...routes);
        allRings.push(...rings);
    });

    return { allRoutes, allRings };
}

function dedupeEventsByEarliest(events: any[]) {
    const map = new Map<string, any>();

    for (const event of events) {
        if (!event.airports || event.airports.length === 0) continue;

        const airportKey = event.airports
            .map((a: any) => a.icao)
            .sort()
            .join('-');

        const key = `${airportKey}|${event.name}`;
        const start = new Date(event.start_time);

        if (!map.has(key)) {
            map.set(key, event);
        } else {
            const existing = map.get(key);
            const existingStart = new Date(existing.start_time);

            // Keeps the EARLIEST one only
            if (start < existingStart) {
                map.set(key, event);
            }
        }
    }

    return Array.from(map.values());
}

export default function Home() {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [rings, setRings] = useState<Ring[]>([]);
    const [pilotData, setPilotData] = useState<Pilot[]>([]);
    const [pilotToggle, setPilotToggle] = useState<boolean>(true);
    const [eventPilotToggle, setEventPilotToggle] = useState<boolean>(false);
    const [dayNightToggle, setDayNightToggle] = useState<boolean>(true);

    const [enabledCategories, setEnabledCategories] = useState<Record<DateCategory, boolean>>({
        ongoing: true,
        today: true,
        tomorrow: true,
        day2: true,
        day3: true,
        day4to5: true,
        day6plus: true
    });

    const toggleCategory = (cat: DateCategory) => {
        setEnabledCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    useEffect(() => {
        async function fetchEvents() {
            const res = await fetch("/api/vatsim/events", {
                next: { revalidate: 300 }
            });

            const json = await res.json();

            const dedupedEvents = dedupeEventsByEarliest(json.data);
            const { allRoutes, allRings } = buildRoutesAndRings(dedupedEvents, airportsDb);

            setRoutes(allRoutes);
            setRings(allRings);
        }
        fetchEvents();
    }, []);

    useEffect(() => {
        async function fetchNetworkData() {
            const res = await fetch("/api/vatsim/data", {
                next: { revalidate: 15 }
            });

            const json = await res.json();

            // Process network data if needed

            setPilotData(json.pilots);
        }
        fetchNetworkData();
    }, []);

    // Filter routes and rings based on enabled time categories
    const filteredRoutes = routes.filter(
        r => enabledCategories[r.category]
    );
    const filteredRings = rings.filter(
        r => enabledCategories[r.category]
    );

    // Get ICAOs used in routes (both start and end)
    const usedIcaos = new Set<string>();
    filteredRoutes.forEach(r => {
        usedIcaos.add(r.startIcao);
        usedIcaos.add(r.endIcao);
    });
    filteredRings.forEach(r => {
        usedIcaos.add(r.icao);
    });

    // Only show labels for used airports
    const airportPoints = Object.entries(airportsDb)
        .filter(([icao]) => usedIcaos.has(icao))
        .map(([icao, coords]) => ({
            lat: coords.lat,
            lng: coords.lng,
            label: icao
        }));

    // Filter pilots by those only going to/from a CURRENT ONGOING EVENT
    // 1. Get all ICAOs of airports with ongoing events
    const ongoingEventIcaos = new Set<string>(
        filteredRings
            .filter(r => r.category === 'ongoing')
            .map(r => r.icao)
    );

    // 2. Include start/end of routes that are ongoing
    filteredRoutes
        .filter(r => r.category === 'ongoing')
        .forEach(r => {
            ongoingEventIcaos.add(r.startIcao);
            ongoingEventIcaos.add(r.endIcao);
        });

    // 3. Then filter pilots
    const pilotDataFiltered = pilotData.filter(pilot => {
        const fp = pilot.flight_plan;
        if (!fp) return false;

        // If eventPilotToggle is off, show all pilots
        if (!eventPilotToggle) return true;

        // Show pilots whose departure or arrival is in an ongoing event airport
        return ongoingEventIcaos.has(fp.departure) || ongoingEventIcaos.has(fp.arrival);
    });

    const togglePilots = () => {
        setPilotToggle(prev => !prev);
    };

    const togglePilotsEvent = () => {
        setEventPilotToggle(prev => !prev);
    };

    const toggleDayNight = () => {
        setDayNightToggle(prev => !prev);
    }

    return (
        <div style={{fontFamily: 'monospace'}}>
            <main>
                <GlobeComponent
                    routes={filteredRoutes}
                    rings={filteredRings}
                    airportPoints={airportPoints}
                    pilotData={pilotToggle ? pilotDataFiltered : []}
                    dayNightMode={dayNightToggle}
                />
            </main>

            {/* Title */}
            <div style={{
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'white',
                opacity: 0.85,
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '1.5rem',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <span style={{ fontWeight: 'bold' }}>VATSIM EVENTS 3D MAP</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Version 1 | by Miggle | <a href="https://github.com/RyanLee355/VatsimEventsMap">GitHub Repo.</a></span>
            </div>

            {/* Bottom Right Settings */}
            <div
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 10000,
                }}
            >
                {/* Toggles */}
                <div style={{ marginBottom: '12px', gap: '8px', display: 'flex', flexDirection: 'column' }}>
                    {/* Pilots toggle */}
                    <div
                        onClick={() => togglePilots()}
                        style={{
                            cursor: 'pointer',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            padding: '12px',
                            borderRadius: '8px',
                            color: 'white',
                        }}
                    >
                        <span>{pilotToggle ? '> Showing Pilots' : '> Hiding Pilots'}</span>
                    </div>
                    {/* Event Pilots toggle */}
                    <div
                        onClick={() => togglePilotsEvent()}
                        style={{
                            cursor: 'pointer',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            padding: '12px',
                            borderRadius: '8px',
                            color: 'white',
                        }}
                    >
                        <span>{eventPilotToggle ? '> Showing only Ongoing Event Pilots' : '> Showing All Pilots'}</span>
                    </div>
                    {/* Day/Night toggle */}
                    <div
                        onClick={() => toggleDayNight()}
                        style={{
                            cursor: 'pointer',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            padding: '12px',
                            borderRadius: '8px',
                            color: 'white',
                        }}
                    >
                        <span>{dayNightToggle ? '> Night Mode' : '> Day Mode'}</span>
                    </div>
                </div>


                {/* Legend container */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    }}
                >
                    <span style={{ fontWeight: 'bold'}}>Event Dates</span>
                    
                    <span style={{ fontSize: '0.75rem', color: '#ccc' }}>(Click to toggle)</span>

                    <div style={{ marginTop: '8px' }}>
                    {[
                        ['ongoing', 'Ongoing', '#00ff00'],
                        ['today', 'Today', '#ffcc00'],
                        ['tomorrow', 'Tomorrow', '#ff8800'],
                        ['day2', 'In 2 Days', '#ff4444'],
                        ['day3', 'In 3 Days', '#ff00ff'],
                        ['day4to5', 'In 4–5 Days', '#8800ff'],
                        ['day6plus', 'In 6+ Days', '#00f']
                    ].map(([key, label, color]) => {
                        const enabled = enabledCategories[key as DateCategory];

                        return (
                            <div
                                key={key}
                                onClick={() => toggleCategory(key as DateCategory)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '6px',
                                    cursor: 'pointer',
                                    opacity: enabled ? 1 : 0.35,
                                    transition: 'opacity 0.2s ease'
                                }}
                            >
                                <span
                                    style={{
                                        width: '16px',
                                        height: '16px',
                                        backgroundColor: color,
                                        borderRadius: '3px',
                                        border: enabled ? 'none' : '1px solid #666',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <span style={{ fontSize: '0.8rem' }}>{label}</span>
                            </div>
                        );
                    })}
                    </div>

                </div>
            </div>


        </div>
    );
}