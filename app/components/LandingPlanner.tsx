// app/lib/landingPlanner.ts
// Pure logic, no React. Great-circle distance, no winds.

export type LatLng = { lat: number; lng: number };

/** The minimum shape the planner needs from an event. Your own Event type just has to satisfy this. */
export type PlannerEventLike = {
    eventName: string;
    startTime: Date | string | number;
    endTime: Date | string | number;
    airportsInvolved: string[];
    color?: string[];
};

export type PlannerInput = {
    origin: LatLng;
    landFrom: Date;      // start of your landing window
    landTo: Date;        // end of your landing window
    departAfter: Date;   // earliest you can leave (defaults to "now" in the UI)
    now: Date;           // used so we never suggest departing in the past
    speedKt: number;     // average ground speed
    bufferMin: number;   // taxi + climb + approach allowance added to the flight time
};

export type Tweak = {
    kind: 'landLater' | 'landEarlier' | 'departEarlier';
    minutes: number;     // size of the change
    time: Date;          // the new boundary (new window end / new window start / new departure time)
};

export type Candidate<T> = {
    event: T;
    airport: string;
    distanceNm: number;
    eteMin: number;
    status: 'ok' | 'near';
    land?: { from: Date; to: Date };     // when you can land and still catch the event
    depart?: { from: Date; to: Date };   // when you'd need to leave to do that
    tweaks: Tweak[];                     // for 'near': smallest change that makes it work
    others: number;                      // other airports of the same event that also work
};

export type PlanResult<T> = {
    ok: Candidate<T>[];
    near: Candidate<T>[];
    unresolved: number;                  // events whose airports we couldn't locate
};

export const MAX_TWEAK_MIN = 180;        // don't suggest changes bigger than this

const MIN = 60_000;
const EARTH_NM = 3440.065;

export function distanceNm(a: LatLng, b: LatLng): number {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const ceilMin = (ms: number) => Math.ceil(ms / MIN);

function evalOne<T>(
    event: T,
    airport: string,
    dist: number,
    eteMs: number,
    evStart: number,
    evEnd: number,
    input: PlannerInput
): Candidate<T> | null {
    const L1 = input.landFrom.getTime();
    const L2 = input.landTo.getTime();
    const D = input.departAfter.getTime();
    const maxEarlierDepart = Math.max(0, D - input.now.getTime());

    const earliestArr = D + eteMs;                 // can't land before this
    const lo = Math.max(L1, evStart, earliestArr); // earliest valid landing
    const hi = Math.min(L2, evEnd);                // latest valid landing

    const base = { event, airport, distanceNm: dist, eteMin: eteMs / MIN, others: 0 };

    if (lo <= hi) {
        return {
            ...base,
            status: 'ok',
            land: { from: new Date(lo), to: new Date(hi) },
            depart: { from: new Date(lo - eteMs), to: new Date(hi - eteMs) },
            tweaks: [],
        };
    }

    // Not feasible as asked. Work out the smallest single change that fixes it.
    const tweaks: Tweak[] = [];

    // Window ends too early: let yourself land later
    if (L2 < lo && lo <= evEnd) {
        const m = ceilMin(lo - L2);
        tweaks.push({ kind: 'landLater', minutes: m, time: new Date(L2 + m * MIN) });
    }
    // Event ends before your window opens: let yourself land earlier
    if (L1 > hi && Math.max(evStart, earliestArr) <= hi) {
        const m = ceilMin(L1 - hi);
        tweaks.push({ kind: 'landEarlier', minutes: m, time: new Date(L1 - m * MIN) });
    }
    // You can't get there in time from your departure time: leave earlier
    if (Math.max(L1, evStart) <= hi && earliestArr > hi && earliestArr - hi <= maxEarlierDepart) {
        const m = ceilMin(earliestArr - hi);
        tweaks.push({ kind: 'departEarlier', minutes: m, time: new Date(D - m * MIN) });
    }

    const usable = tweaks.filter((t) => t.minutes <= MAX_TWEAK_MIN).sort((a, b) => a.minutes - b.minutes);
    if (!usable.length) return null;
    return { ...base, status: 'near', tweaks: usable };
}

export function evaluateEvents<T extends PlannerEventLike>(
    events: T[],
    input: PlannerInput,
    getAirport: (icao: string) => LatLng | undefined
): PlanResult<T> {
    const ok: Candidate<T>[] = [];
    const near: Candidate<T>[] = [];
    let unresolved = 0;

    for (const ev of events) {
        const s = new Date(ev.startTime).getTime();
        const e = new Date(ev.endTime).getTime();
        if (!Number.isFinite(s) || !Number.isFinite(e)) continue;

        const cands: Candidate<T>[] = [];
        let located = 0;

        for (const icao of new Set(ev.airportsInvolved ?? [])) {
            const pos = getAirport(icao);
            if (!pos) continue;
            located++;
            const dist = distanceNm(input.origin, pos);
            if (dist < 1) continue; // that's where you're starting from
            const eteMs = (dist / input.speedKt * 60 + input.bufferMin) * MIN;
            const c = evalOne(ev, icao, dist, eteMs, s, e, input);
            if (c) cands.push(c);
        }

        if (!located) unresolved++;

        const oks = cands.filter((c) => c.status === 'ok').sort((a, b) => a.distanceNm - b.distanceNm);
        if (oks.length) {
            ok.push({ ...oks[0], others: oks.length - 1 });
            continue;
        }
        const nears = cands
            .filter((c) => c.status === 'near')
            .sort((a, b) => a.tweaks[0].minutes - b.tweaks[0].minutes);
        if (nears.length) near.push(nears[0]);
    }

    ok.sort((a, b) => a.land!.from.getTime() - b.land!.from.getTime());
    near.sort((a, b) => a.tweaks[0].minutes - b.tweaks[0].minutes);
    return { ok, near, unresolved };
}