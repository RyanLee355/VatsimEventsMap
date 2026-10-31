'use client';
// app/components/PlannerPanel.tsx
import { useEffect, useMemo, useState } from 'react';
import styles from './PlannerPanel.module.css';
import {
    evaluateEvents,
    type Candidate,
    type LatLng,
    type PlanResult,
    type PlannerEventLike,
    type Tweak,
} from '@/app/components/LandingPlanner';

type Props<T extends PlannerEventLike> = {
    /** Stable, unfiltered list of events (don't pass the planner-filtered list back in). */
    events: T[];
    /** ICAO -> coordinates. Must be able to resolve your origin airport as well as event airports. */
    getAirport: (icao: string) => LatLng | undefined;
    /** Called when a result is clicked, e.g. to fly the globe to the destination. */
    onFocus?: (lat: number, lng: number) => void;
    /** Receives the set of matching events (or null when the planner isn't filtering the map). */
    onMatches?: (matches: Set<T> | null) => void;

    open: boolean;
    onOpenChange: (open: boolean) => void;
};

// ---------- time helpers ----------
const pad = (n: number) => String(n).padStart(2, '0');

const todayStr = (utc: boolean) => {
    const d = new Date();
    return utc
        ? d.toISOString().slice(0, 10)
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "YYYY-MM-DD" + "HH:mm" interpreted as UTC (Zulu) or the browser's local time
const makeDate = (date: string, time: string, utc: boolean) =>
    new Date(utc ? `${date}T${time}:00Z` : `${date}T${time}:00`);

const dayIdx = (d: Date, utc: boolean) =>
    Math.floor((utc ? d.getTime() : d.getTime() - d.getTimezoneOffset() * 60000) / 86_400_000);

function fmtTime(d: Date, utc: boolean, ref: Date) {
    const h = utc ? d.getUTCHours() : d.getHours();
    const m = utc ? d.getUTCMinutes() : d.getMinutes();
    const diff = dayIdx(d, utc) - dayIdx(ref, utc);
    const dayTag = diff === 0 ? '' : ` ${diff > 0 ? '+' : '−'}${Math.abs(diff)}d`;
    return `${pad(h)}:${pad(m)}${utc ? 'Z' : ''}${dayTag}`;
}

const fmtRange = (a: Date, b: Date, utc: boolean, ref: Date) =>
    `${fmtTime(a, utc, ref)} – ${fmtTime(b, utc, ref)}`;

function fmtDur(min: number) {
    const m = Math.round(min);
    const h = Math.floor(m / 60);
    return h ? `${h}h ${pad(m % 60)}m` : `${m}m`;
}

const SPEEDS = [
    { label: 'Airliner', kt: 450 },
    { label: 'Turboprop', kt: 280 },
    { label: 'Light GA', kt: 120 },
];

// ---------- small building blocks ----------
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

const PlaneIcon = () => (
    <svg width="18" height="18" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">
        <path d="M32 3 L36 21 L60 38 L60 45 L36 39 L35 52 L43 58 L43 62 L32 59 L21 62 L21 58 L29 52 L28 39 L4 45 L4 38 L28 21 Z" />
    </svg>
);

// ---------- component ----------
export default function PlannerPanel<T extends PlannerEventLike>({
    events,
    getAirport,
    onFocus,
    onMatches,
    open,
    onOpenChange,

}: Props<T>) {

    const [origin, setOrigin] = useState('EGLL');
    const [utc, setUtc] = useState(true);
    const [date, setDate] = useState('');
    const [from, setFrom] = useState('08:00');
    const [to, setTo] = useState('11:00');
    const [departStr, setDepartStr] = useState(''); // blank = now
    const [speed, setSpeed] = useState(450);
    const [buffer, setBuffer] = useState(20);
    const [filterMap, setFilterMap] = useState(true);

    // Avoid SSR/client date mismatch: fill today's date after mount
    useEffect(() => setDate(todayStr(true)), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onOpenChange]);

    const plan = useMemo(() => {
        const icao = origin.trim().toUpperCase();
        if (!date || icao.length < 3 || !(speed > 0) || !from || !to) return null;

        const pos = getAirport(icao);
        if (!pos) return { error: `Can't find "${icao}" in the airport list.` } as const;

        const landFrom = makeDate(date, from, utc);
        let landTo = makeDate(date, to, utc);
        if (landTo <= landFrom) landTo = new Date(landTo.getTime() + 86_400_000); // window crosses midnight

        const now = new Date();
        const departAfter = departStr ? makeDate(departStr.slice(0, 10), departStr.slice(11, 16), utc) : now;
        if ([landFrom, landTo, departAfter].some((d) => Number.isNaN(d.getTime()))) return null;

        const result: PlanResult<T> = evaluateEvents(
            events,
            { origin: pos, landFrom, landTo, departAfter, now, speedKt: speed, bufferMin: buffer },
            getAirport
        );
        return { result, landFrom, icao } as const;
    }, [events, getAirport, origin, date, from, to, utc, departStr, speed, buffer]);

    const result = plan && 'result' in plan ? plan.result : null;
    const ref: Date = (plan && 'landFrom' in plan ? plan.landFrom : undefined) ?? new Date();

    // Optionally filter the globe to the events you can make
    useEffect(() => {
        if (!onMatches) return;
        onMatches(filterMap && open && result ? new Set(result.ok.map((c) => c.event)) : null);
    }, [filterMap, open, result, onMatches]);

    const tweakText = (t: Tweak) => {
        switch (t.kind) {
            case 'landLater':
                return `Land up to ${fmtDur(t.minutes)} later (window ends ${fmtTime(t.time, utc, ref)})`;
            case 'landEarlier':
                return `Land ${fmtDur(t.minutes)} earlier (window starts ${fmtTime(t.time, utc, ref)})`;
            case 'departEarlier':
                return `Depart ${fmtDur(t.minutes)} earlier (by ${fmtTime(t.time, utc, ref)})`;
        }
    };

    const focus = (c: Candidate<T>) => {
        const pos = getAirport(c.airport);
        if (pos) onFocus?.(pos.lat, pos.lng);
    };

    const renderCard = (c: Candidate<T>) => {
        const ev = c.event;
        const evStart = new Date(ev.startTime);
        const evEnd = new Date(ev.endTime);
        return (
            <button
                type="button"
                key={`${ev.eventName}-${c.airport}-${evStart.getTime()}`}
                className={`${styles.card} ${c.status === 'ok' ? styles.cardOk : styles.cardNear}`}
                style={{ ['--accent' as string]: ev.color?.[0] ?? '#19d219' }}
                onClick={() => focus(c)}
            >
                <span className={styles.cardTitle}>{ev.eventName}</span>
                <span className={styles.cardRoute}>
                    {plan && 'icao' in plan ? plan.icao : ''} → {c.airport}
                    <span className={styles.cardMeta}>
                        {Math.round(c.distanceNm).toLocaleString()} nm · {fmtDur(c.eteMin)}
                    </span>
                </span>

                {c.status === 'ok' && c.land && c.depart && (
                    <span className={styles.cardTimes}>
                        <span><b>Depart</b> {fmtRange(c.depart.from, c.depart.to, utc, ref)}</span>
                        <span><b>Land</b> {fmtRange(c.land.from, c.land.to, utc, ref)}</span>
                    </span>
                )}

                {c.status === 'near' && (
                    <span className={styles.tweaks}>
                        {c.tweaks.map((t) => (
                            <span key={t.kind} className={styles.tweak}>{tweakText(t)}</span>
                        ))}
                    </span>
                )}

                <span className={styles.cardEvent}>
                    Event {fmtRange(evStart, evEnd, utc, ref)}
                    {c.others > 0 && ` · +${c.others} more airport${c.others > 1 ? 's' : ''} work`}
                </span>
            </button>
        );
    };

    return (
        <div className={styles.wrapper}>
            <div
                className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
                role="dialog"
                aria-label="Landing planner"
                aria-hidden={!open}
            >
                <div className={styles.header}>
                    <span className={styles.title}>Landing planner</span>
                    <button type="button" className={styles.closeButton} onClick={() => onOpenChange(false)} aria-label="Close planner">
                        ✕
                    </button>
                </div>

                <div className={styles.scroll}>
                    <section className={styles.section}>
                        <div className={styles.row}>
                            <label className={styles.field} style={{ flex: '0 0 96px' }}>
                                <span>From</span>
                                <input
                                    value={origin}
                                    maxLength={4}
                                    spellCheck={false}
                                    autoCapitalize="characters"
                                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                                    className={styles.icao}
                                />
                            </label>
                            <label className={styles.field}>
                                <span>Date</span>
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                            </label>
                        </div>

                        <div className={styles.row}>
                            <label className={styles.field}>
                                <span>Land from</span>
                                <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
                            </label>
                            <label className={styles.field}>
                                <span>Land by</span>
                                <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
                            </label>
                        </div>

                        <div className={styles.chips}>
                            <Chip active={utc} onClick={() => setUtc(true)}>Zulu (UTC)</Chip>
                            <Chip active={!utc} onClick={() => setUtc(false)}>Local time</Chip>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Aircraft</h3>
                        <div className={styles.chips}>
                            {SPEEDS.map((s) => (
                                <Chip key={s.label} active={speed === s.kt} onClick={() => setSpeed(s.kt)}>
                                    {s.label} {s.kt} kt
                                </Chip>
                            ))}
                        </div>
                        <div className={styles.row}>
                            <label className={styles.field}>
                                <span>Ground speed (kt)</span>
                                <input type="number" min={40} max={700} value={speed}
                                    onChange={(e) => setSpeed(Number(e.target.value))} />
                            </label>
                            <label className={styles.field}>
                                <span>Taxi + climb/descent (min)</span>
                                <input type="number" min={0} max={120} value={buffer}
                                    onChange={(e) => setBuffer(Math.max(0, Number(e.target.value)))} />
                            </label>
                        </div>
                        <label className={styles.field}>
                            <span>Earliest departure (blank = now)</span>
                            <input type="datetime-local" value={departStr} onChange={(e) => setDepartStr(e.target.value)} />
                        </label>
                    </section>

                    <section className={styles.section}>
                        <label className={styles.checkRow}>
                            <input type="checkbox" checked={filterMap} onChange={(e) => setFilterMap(e.target.checked)} />
                            <span>Show only matching events on the globe</span>
                        </label>
                    </section>

                    <section className={styles.results}>
                        {!plan && <p className={styles.note}>Enter an airport and a landing window.</p>}
                        {plan && 'error' in plan && <p className={styles.error}>{plan.error}</p>}

                        {result && (
                            <>
                                <h3 className={styles.sectionTitle}>
                                    You can make <span className={styles.count}>{result.ok.length}</span>
                                </h3>
                                {result.ok.length === 0 && (
                                    <p className={styles.note}>Nothing fits this window. Check the near misses below.</p>
                                )}
                                {result.ok.map(renderCard)}

                                {result.near.length > 0 && (
                                    <>
                                        <h3 className={styles.sectionTitle} style={{ marginTop: 16 }}>
                                            Almost <span className={styles.count}>{result.near.length}</span>
                                        </h3>
                                        <p className={styles.note}>Each of these works with the change shown.</p>
                                        {result.near.map(renderCard)}
                                    </>
                                )}

                                {result.unresolved > 0 && (
                                    <p className={styles.note}>
                                        {result.unresolved} event{result.unresolved > 1 ? 's' : ''} skipped: airport coordinates not found.
                                    </p>
                                )}
                            </>
                        )}
                    </section>
                </div>
            </div>

            <button
                type="button"
                className={styles.toggle}
                onClick={() => onOpenChange(!open)}
                aria-expanded={open}
            >
                <PlaneIcon />
                <span>Planner</span>
            </button>
        </div>
    );
}