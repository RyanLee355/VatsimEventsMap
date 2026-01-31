import { DateCategory } from "@/app/types";
import { useState } from "react";
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
};

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
    setDateRange
}: Props) {
    const [open, setOpen] = useState(false);

    const categoriesDisabled = useDateRange;

    return (
        <div className={styles.wrapper}>
            
            {/* Mobile toggle */}
            <div
                className={styles.mobileToggle}
                onClick={() => setOpen(prev => !prev)}
            >
                Settings
            </div>

            {/* Panel */}
            <div
                className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
            >

                <div className={styles.closeRow}>
                    <strong>Settings</strong>
                    <span
                        className={styles.closeButton}
                        onClick={() => setOpen(false)}
                    >
                        ✕
                    </span>
                </div>

                {/* Toggles */}
                <div className={styles.toggleGroup}>
                    <div className={styles.toggleButton} onClick={togglePilots}>
                        {pilotToggle ? '> Showing Pilots' : '> Hiding Pilots'}
                    </div>

                    <div className={styles.toggleButton} onClick={togglePilotsEvent}>
                        {eventPilotToggle
                            ? '> Showing only Ongoing Event Pilots'
                            : '> Showing All Pilots'}
                    </div>

                    <div className={styles.toggleButton} onClick={toggleDayNight}>
                        {dayNightToggle ? '> Night Mode' : '> Day Mode'}
                    </div>
                </div>

                {/* Event Type */}
                <div className={styles.section}>
                    <span className={styles.sectionTitle}>Event Type</span>
                    <span className={styles.sectionHint}>(Click to toggle)</span>

                    <div className={styles.categoryList}>
                        <div
                            className={`${styles.categoryItem} ${
                                showNormalEvents ? styles.enabled : styles.disabledItem
                            }`}
                            onClick={toggleNormalEvents}
                        >
                            <span
                                className={styles.colorBox}
                                style={{ backgroundColor: '#4da6ff' }}
                            />
                            <span>Normal Events</span>
                        </div>

                        <div
                            className={`${styles.categoryItem} ${
                                showExamEvents ? styles.enabled : styles.disabledItem
                            }`}
                            onClick={toggleExamEvents}
                        >
                            <span
                                className={styles.colorBox}
                                style={{ backgroundColor: '#4da6ff' }}
                            />
                            <span>Exams</span>
                        </div>
                    </div>
                </div>

                {/* Event Dates */}
                <div
                    className={`${styles.section} ${
                        categoriesDisabled ? styles.disabled : ""
                    }`}
                >
                    <span className={styles.sectionTitle}>Event Dates</span>

                    {categoriesDisabled && (
                        <span className={styles.disabledHint}>
                            Disabled while custom date range is active
                        </span>
                    )}

                    <span className={styles.sectionHint}>(Click to toggle)</span>

                    <div className={styles.categoryList}>
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
                                    className={`${styles.categoryItem} ${
                                        enabled ? styles.enabled : styles.disabledItem
                                    }`}
                                    onClick={() => toggleCategory(key as DateCategory)}
                                >
                                    <span
                                        className={styles.colorBox}
                                        style={{ backgroundColor: color }}
                                    />
                                    <span>{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Date Range */}
                <div className={styles.section}>
                    <div
                        className={styles.toggleHeader}
                        onClick={() => setUseDateRange(!useDateRange)}
                    >
                        {useDateRange
                            ? '> Using Custom Date Range'
                            : '> Use Custom Date Range'}
                    </div>

                    {useDateRange && (
                        <div className={styles.dateRange}>
                            <label>Start</label>
                            <input
                                type="datetime-local"
                                value={dateRange.start ?? ''}
                                onChange={(e) =>
                                    setDateRange({
                                        ...dateRange,
                                        start: e.target.value
                                    })
                                }
                            />

                            <label>End</label>
                            <input
                                type="datetime-local"
                                value={dateRange.end ?? ''}
                                onChange={(e) =>
                                    setDateRange({
                                        ...dateRange,
                                        end: e.target.value
                                    })
                                }
                            />
                        </div>
                    )}
                </div>

            </div>

        </div>
    );
}