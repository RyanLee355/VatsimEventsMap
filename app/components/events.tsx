import { Route, Ring, DateCategory } from "@/app/types";
// import airportsDb from "@/app/data/airports.json";
import airportsDb from "@/app/data/iata-icao.json";

function getAirportSafe(
    icao: string,
    airportsDb: { [icao: string]: { lat: number; lng: number; name: string } }
) {
    const airport = airportsDb[icao];

    if (!airport) {
        return {
            lat: 0,
            lng: 0,
            name: icao, // fallback name
            found: false,
        };
    }

    return {
        lat: airport.lat,
        lng: airport.lng,
        name: airport.name,
        found: true,
    };
}

export function eventToRoutesAndRings(
    event: {
        airports: { icao: string }[];
        name: string;
        start_time: string;
        end_time: string;
        banner: string | null;
        link: string;
    },
    airportsDb: { [icao: string]: { lat: number; lng: number; name: string } }
): { routes: Route[]; rings: Ring[] } {
    const routes: Route[] = [];
    const rings: Ring[] = [];

    if (!event.airports || event.airports.length === 0) return { routes, rings };
        const allIcaosWithNames = event.airports.map((a) => {
        const airport = getAirportSafe(a.icao, airportsDb);
        return `${airport.name} - (${a.icao})`;
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
        const airport = getAirportSafe(a, airportsDb);

        if (airport.found) {
            rings.push({
                icao: a,
                lat: airport.lat,
                lng: airport.lng,
                color: getColorForEvent(new Date(event.start_time), new Date(event.end_time)),
                category: getEventDateCategory(new Date(event.start_time), new Date(event.end_time)),
                eventName: event.name,
                startTime: new Date(event.start_time),
                endTime: new Date(event.end_time),
                radius: 100000,
                banner: event.banner,
                link: event.link,
            });

            const offset = 0.05; // visual separation
            routes.push({
                startIcao: a,
                endIcao: a,
                startLat: airport.lat,
                startLng: airport.lng,
                endLat: airport.lat,
                endLng: airport.lng + offset,
                color: getColorForEvent(new Date(event.start_time), new Date(event.end_time)),
                category: getEventDateCategory(new Date(event.start_time), new Date(event.end_time)),
                eventName: event.name,
                startTime: new Date(event.start_time),
                endTime: new Date(event.end_time),
                banner: event.banner,
                airportsInvolved: [`${airport.name} - (${a})`],
                link: event.link,
            });
        }

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

            const p1 = getAirportSafe(a1, airportsDb);
            const p2 = getAirportSafe(a2, airportsDb);

            // Only draw arcs if both airports exist
            if (p1.found && p2.found) {
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
                    link: event.link,
                });
            }
        }
    }

    return { routes, rings };
}

export function buildRoutesAndRings(events: any[]) {
    const allRoutes: Route[] = [];
    const allRings: Ring[] = [];

    console.log("Building routes and rings from events:", events);

    events.forEach(event => {
        const { routes, rings } = eventToRoutesAndRings(event, airportsDb);
        allRoutes.push(...routes);
        allRings.push(...rings);
    });

    return { allRoutes, allRings };
}

export function dedupeEventsByEarliest(events: any[]) {
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