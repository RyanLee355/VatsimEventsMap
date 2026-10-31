'use client';
import { DateCategory } from "@/app/types";
import { useEffect, useState } from "react";
import styles from "./settingsPanel.module.css";

type Props = {
    enabledCategories: Record<DateCategory, boolean>;
    toggleCategory: (cat: DateCategory) => void;
    pilotToggle: boolean;
    eventPilotToggle: boolean;
    dayNightToggle: boolean;
    togglePilots: () => void;
    togglePilotsEvent: () => void;
    toggleDayNight: () => void;

    showNormalEvents: boolean;
    showExamEvents: boolean;
    toggleNormalEvents: () => void;
    toggleExamEvents: () => void;

    useDateRange: boolean;
    setUseDateRange: (value: boolean) => void;
    dateRange: {
        start: string | null;
        end: string | null;
    };
    setDateRange: (range: { start: string | null; end: string | null }) => void;

    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const CATEGORIES: { key: DateCategory; label: string; color: string }[] = [
    { key: 'ongoing', label: 'Ongoing', color: '#00ff00' },
    { key: 'today', label: 'Today', color: '#ffcc00' },
    { key: 'tomorrow', label: 'Tomorrow', color: '#ff8800' },
    { key: 'day2', label: 'In 2 days', color: '#ff4444' },
    { key: 'day3', label: 'In 3 days', color: '#ff00ff' },
    { key: 'day4to5', label: 'In 4–5 days', color: '#8800ff' },
    { key: 'day6plus', label: 'In 6+ days', color: '#3b82ff' },
];

const DEFAULT_CATEGORIES: Record<DateCategory, boolean> = {
    ongoing: true,
    today: true,
    tomorrow: true,
    day2: true,
    day3: true,
    day4to5: true,
    day6plus: false,
};

// --- date helpers (datetime-local inputs use local time, "YYYY-MM-DDTHH:mm") ---
const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

const PRESETS: { label: string; range: () => [Date, Date] }[] = [
    { label: 'Next 24h', range: () => { const n = new Date(); return [n, new Date(n.getTime() + 24 * 3600 * 1000)]; } },
    { label: 'Today', range: () => { const n = new Date(); return [startOfDay(n), endOfDay(n)]; } },
    { label: 'Tomorrow', range: () => { const t = addDays(new Date(), 1); return [startOfDay(t), endOfDay(t)]; } },
    {
        label: 'This weekend',
        range: () => {
            const n = new Date();
            const day = n.getDay(); // 0 = Sun
            const sat = day === 0 ? addDays(n, -1) : addDays(n, 6 - day);
            return [startOfDay(sat), endOfDay(addDays(sat, 1))];
        },
    },
    { label: 'Next 7 days', range: () => { const n = new Date(); return [n, addDays(n, 7)]; } },
];

// --- small building blocks ---
function Switch({
    checked, onChange, label, hint, disabled,
}: { checked: boolean; onChange: () => void; label: string; hint?: string; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            className={styles.switchRow}
            onClick={onChange}
        >
            <span className={styles.switchText}>
                <span className={styles.switchLabel}>{label}</span>
                {hint && <span className={styles.switchHint}>{hint}</span>}
            </span>
            <span className={`${styles.track} ${checked ? styles.trackOn : ''}`}>
                <span className={styles.thumb} />
            </span>
        </button>
    );
}

function Chip({
    active, onClick, color, children,
}: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={onClick}
        >
            {color && <span className={styles.dot} style={{ backgroundColor: color }} />}
            {children}
        </button>
    );
}

const GearIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export default function SettingsPanel({
    enabledCategories,
    toggleCategory,
    pilotToggle,
    eventPilotToggle,
    dayNightToggle,
    togglePilots,
    togglePilotsEvent,
    toggleDayNight,

    showNormalEvents,
    showExamEvents,
    toggleNormalEvents,
    toggleExamEvents,

    useDateRange,
    setUseDateRange,
    dateRange,
    setDateRange,

    open,
    onOpenChange,
}: Props) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    }, []);

    // Esc closes the panel
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onOpenChange]);

    const enabledCount = CATEGORIES.filter(c => enabledCategories[c.key]).length;
    const rangeInvalid = !!(dateRange.start && dateRange.end && dateRange.end < dateRange.start);

    const setAllCategories = (value: boolean) => {
        CATEGORIES.forEach(({ key }) => {
            if (enabledCategories[key] !== value) toggleCategory(key);
        });
    };

    const applyPreset = (range: () => [Date, Date]) => {
        const [s, e] = range();
        setUseDateRange(true);
        setDateRange({ start: toInput(s), end: toInput(e) });
    };

    const resetAll = () => {
        if (!pilotToggle) togglePilots();
        if (eventPilotToggle) togglePilotsEvent();
        if (!dayNightToggle) toggleDayNight();
        if (!showNormalEvents) toggleNormalEvents();
        if (!showExamEvents) toggleExamEvents();
        CATEGORIES.forEach(({ key }) => {
            if (enabledCategories[key] !== DEFAULT_CATEGORIES[key]) toggleCategory(key);
        });
        setUseDateRange(false);
        setDateRange({ start: null, end: null });
    };

    return (
        <div className={styles.wrapper}>
            {/* Mobile backdrop */}
            {open && isMobile && (
                <div className={styles.backdrop} onClick={() => onOpenChange(false)} />
            )}

            {/* Panel */}
            <div
                className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
                role="dialog"
                aria-label="Map settings"
                aria-hidden={!open}
            >
                <div className={styles.header}>
                    <span className={styles.title}>Settings</span>
                    <div className={styles.headerActions}>
                        <button type="button" className={styles.linkButton} onClick={resetAll}>
                            Reset
                        </button>
                        <button
                            type="button"
                            className={styles.closeButton}
                            onClick={() => onOpenChange(false)}
                            aria-label="Close settings"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className={styles.scroll}>
                    {/* Display */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Display</h3>
                        <Switch
                            checked={pilotToggle}
                            onChange={togglePilots}
                            label="Show pilots"
                            hint="Live aircraft from the VATSIM feed"
                        />
                        <Switch
                            checked={eventPilotToggle}
                            onChange={togglePilotsEvent}
                            disabled={!pilotToggle}
                            label="Only ongoing event pilots"
                            hint="Hide flights not to or from an ongoing event"
                        />
                        <Switch
                            checked={dayNightToggle}
                            onChange={toggleDayNight}
                            label="Night map"
                            hint={dayNightToggle ? 'Dark basemap' : 'Light basemap'}
                        />
                    </section>

                    {/* Event type */}
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Event type</h3>
                        <div className={styles.chips}>
                            <Chip active={showNormalEvents} onClick={toggleNormalEvents} color="#4da6ff">
                                Normal events
                            </Chip>
                            <Chip active={showExamEvents} onClick={toggleExamEvents} color="#f5a623">
                                Exams
                            </Chip>
                        </div>
                    </section>

                    {/* Event dates */}
                    <section className={`${styles.section} ${useDateRange ? styles.sectionDisabled : ''}`}>
                        <div className={styles.sectionHeaderRow}>
                            <h3 className={styles.sectionTitle}>
                                Event dates <span className={styles.count}>{enabledCount}/{CATEGORIES.length}</span>
                            </h3>
                            <div className={styles.miniActions}>
                                <button type="button" className={styles.linkButton} onClick={() => setAllCategories(true)}>
                                    All
                                </button>
                                <button type="button" className={styles.linkButton} onClick={() => setAllCategories(false)}>
                                    None
                                </button>
                            </div>
                        </div>
                        {useDateRange && (
                            <p className={styles.note}>Overridden by the custom date range below.</p>
                        )}
                        <div className={styles.chips}>
                            {CATEGORIES.map(({ key, label, color }) => (
                                <Chip
                                    key={key}
                                    active={enabledCategories[key]}
                                    onClick={() => toggleCategory(key)}
                                    color={color}
                                >
                                    {label}
                                </Chip>
                            ))}
                        </div>
                    </section>

                    {/* Custom date range */}
                    <section className={styles.section}>
                        <Switch
                            checked={useDateRange}
                            onChange={() => setUseDateRange(!useDateRange)}
                            label="Custom date range"
                            hint="Show events overlapping a specific window"
                        />

                        {useDateRange && (
                            <div className={styles.rangeBody}>
                                <div className={styles.chips}>
                                    {PRESETS.map(p => (
                                        <button
                                            key={p.label}
                                            type="button"
                                            className={styles.presetButton}
                                            onClick={() => applyPreset(p.range)}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                <div className={styles.dateGrid}>
                                    <label className={styles.dateField}>
                                        <span>Start</span>
                                        <input
                                            type="datetime-local"
                                            value={dateRange.start ?? ''}
                                            max={dateRange.end ?? undefined}
                                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value || null })}
                                        />
                                    </label>
                                    <label className={styles.dateField}>
                                        <span>End</span>
                                        <input
                                            type="datetime-local"
                                            value={dateRange.end ?? ''}
                                            min={dateRange.start ?? undefined}
                                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value || null })}
                                        />
                                    </label>
                                </div>

                                {rangeInvalid && (
                                    <p className={styles.error}>End must be after start. No events will match.</p>
                                )}
                                {(!dateRange.start || !dateRange.end) && (
                                    <p className={styles.note}>Set both a start and an end, or all events are shown.</p>
                                )}
                                {(dateRange.start || dateRange.end) && (
                                    <button
                                        type="button"
                                        className={styles.linkButton}
                                        onClick={() => setDateRange({ start: null, end: null })}
                                    >
                                        Clear dates
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {/* Toggle button */}
            <button
                type="button"
                className={styles.toggle}
                onClick={() => onOpenChange(!open)}
                aria-expanded={open}
            >
                <GearIcon />
                <span>Settings</span>
            </button>
        </div>
    );
}