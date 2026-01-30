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
};

export default function SettingsPanel({
    enabledCategories,
    toggleCategory,
    pilotToggle,
    eventPilotToggle,
    dayNightToggle,
    togglePilots,
    togglePilotsEvent,
    toggleDayNight
}: Props) {
    const [open, setOpen] = useState(false);

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

                <div style={{ marginBottom: '12px', gap: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div onClick={togglePilots} style={{ cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', color: 'white' }}>
                    <span>{pilotToggle ? '> Showing Pilots' : '> Hiding Pilots'}</span>
                    </div>
                    <div onClick={togglePilotsEvent} style={{ cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', color: 'white' }}>
                    <span>{eventPilotToggle ? '> Showing only Ongoing Event Pilots' : '> Showing All Pilots'}</span>
                    </div>
                    <div onClick={toggleDayNight} style={{ cursor: 'pointer', backgroundColor: 'rgba(0,0,0,0.6)', padding: '12px', borderRadius: '8px', color: 'white' }}>
                    <span>{dayNightToggle ? '> Night Mode' : '> Day Mode'}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
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
                        <div key={key} onClick={() => toggleCategory(key as DateCategory)} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', opacity: enabled ? 1 : 0.35, transition: 'opacity 0.2s ease' }}>
                            <span style={{ width: '16px', height: '16px', backgroundColor: color, borderRadius: '3px', border: enabled ? 'none' : '1px solid #666', boxSizing: 'border-box' }} />
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