'use client';
import { Route, Ring } from "@/app/types";
import Image from "next/image";
import styles from "./eventSidePanel.module.css";

type Props = {
    routes: Route[];
    rings: Ring[];
    collapsed: boolean;
    onEventClick?: (event: {
        name: string;
        airports: string[];
        coords: { lat: number; lon: number }[];
    }) => void;
};

function getDayLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffMs = date.getTime() - today.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // <-- FLOOR instead of ROUND

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
    return date.toLocaleDateString(undefined, options);
}

export default function EventSidePanel({ routes, rings, collapsed, onEventClick }: Props) {
const eventsMap = new Map<
    string,
    {
        name: string;
        startTime: Date;
        endTime: Date;
        airports: string[];
        coords: { lat: number; lon: number }[];
        banner: string | null;
        link: string | null;
    }
>();

    console.log("EventSidePanel received routes:", routes);
    console.log("EventSidePanel received rings:", rings);

    routes.forEach(r => {
        if (!eventsMap.has(r.eventName)) {
            eventsMap.set(r.eventName, {
                name: r.eventName,
                startTime: r.startTime,
                endTime: r.endTime,
                airports: r.airportsInvolved,
                coords: [
                    { lat: r.startLat, lon: r.startLng },
                    { lat: r.endLat, lon: r.endLng }
                ],
                banner: r.banner,
                link: r.link,
            });
        }
    });

    rings.forEach(r => {
        if (!eventsMap.has(r.eventName)) {
            eventsMap.set(r.eventName, {
                name: r.eventName,
                startTime: r.startTime,
                endTime: r.endTime,
                airports: [r.icao],
                coords: [{ lat: r.lat, lon: r.lng }],
                banner: r.banner,
                link: r.link,
            });
        }
    });

    const events = Array.from(eventsMap.values()).sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    let lastDayLabel = "";
    return (
        <div
            className={`${styles.panel} ${
                collapsed ? styles.panelCollapsed : styles.panelOpen
            }`}
        >
            <h2 className={styles.title}>Events</h2>

            {events.map((event, idx) => {
                const dayLabel = getDayLabel(event.startTime);
                const showHeader = dayLabel !== lastDayLabel;
                lastDayLabel = dayLabel;

                return (
                    <div key={idx}>
                        {showHeader && (
                            <div className={styles.dayHeader}>{dayLabel}</div>
                        )}

                        <div
                            className={styles.eventCard}
                            onClick={() => onEventClick?.(event)}
                            style={{ cursor: "pointer" }}
                        >
                            <div className={styles.banner}>
                                {event.banner ? (
                                    <Image
                                        src={event.banner}
                                        alt={event.name}
                                        width={80}
                                        height={80}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : (
                                    <span className={styles.noImage}>No Image</span>
                                )}
                            </div>


                            <div className={styles.eventContent}>
                                <div className={styles.status}>
                                    {event.startTime <= new Date() && event.endTime >= new Date() ? (
                                        <span className={styles.ongoing}>● Ongoing</span>
                                    ) : (
                                        <span className={styles.upcoming}>● Upcoming</span>
                                    )}
                                </div>

                                <div className={styles.eventName}>{event.name}</div>

                                <div className={styles.eventTime}>
                                    {event.startTime.toLocaleString()} → {event.endTime.toLocaleString()}
                                </div>

                                <div className={styles.eventAirports}>
                                    {event.airports.join(", ")}
                                </div>

                                {event.link && (
                                    <a
                                        href={event.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.eventLinkButton}
                                    >
                                        More Info
                                    </a>
                                )}
                            </div>

                        </div>
                    </div>
                );
            })}
        </div>
    );
}