'use client';
import { Route, Ring } from "@/app/types";
import Image from "next/image";
import styles from "./eventSidePanel.module.css";
import { useCallback, useMemo } from "react";

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

function getDayLabel(date: Date, todayStart: Date): string {
    const diffMs = date.getTime() - todayStart.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // <-- FLOOR instead of ROUND

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
    return date.toLocaleDateString(undefined, options);
}

export default function EventSidePanel({ routes, rings, collapsed, onEventClick }: Props) {
    
    function getEventTimingInfo(startTime: Date, endTime: Date, now: Date, todayStart: Date): {
        className: string;
        label: string;
    } {
        // Ongoing wins
        if (startTime <= now && endTime >= now) {
            return { className: "day-ongoing", label: "● Ongoing" };
        }

        const today = todayStart;
        const eventDay = new Date(startTime);
        eventDay.setHours(0, 0, 0, 0);

        const diffDays = Math.floor(
            (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays === 0)
            return { className: "day-today", label: "● Today" };

        if (diffDays === 1)
            return { className: "day-tomorrow", label: "● Tomorrow" };

        if (diffDays === 2)
            return { className: "day-2", label: "● In 2 days" };

        if (diffDays === 3)
            return { className: "day-3", label: "● In 3 days" };

        if (diffDays >= 4 && diffDays <= 5)
            return { className: "day-4-5", label: "● In 4–5 days" };

        return { className: "day-6-plus", label: "● In 6+ days" };
    }

    const events = useMemo(() => {
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
                isWeekly: boolean;
            }
        >();

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
                    isWeekly: !!r.isWeekly,
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
                    isWeekly: !!r.isWeekly,
                });
            }
        });

        return Array.from(eventsMap.values()).sort(
            (a, b) => a.startTime.getTime() - b.startTime.getTime()
        );
    }, [routes, rings]);

    const handleEventClick = useCallback(
        (event: {
            name: string;
            airports: string[];
            coords: { lat: number; lon: number; }[];
        }) => onEventClick?.(event),
        [onEventClick]
    );

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return (
        <div
            className={`${styles.panel} ${
                collapsed ? styles.panelCollapsed : styles.panelOpen
            }`}
        >
            <h2 className={styles.title}>Events</h2>

            {events.map((event, idx) => {
                const dayLabel = getDayLabel(event.startTime, todayStart);
                const prevDayLabel =
                    idx > 0 ? getDayLabel(events[idx - 1].startTime, todayStart) : null;
                const showHeader = dayLabel !== prevDayLabel;

                const timing = getEventTimingInfo(event.startTime, event.endTime, now, todayStart);

                return (
                    <div key={idx}>
                        {showHeader && (
                            <div className={styles.dayHeader}>{dayLabel}</div>
                        )}

                        <div
                            className={styles.eventCard}
                            onClick={() => handleEventClick(event)}
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
                                        sizes="80px"
                                        unoptimized
                                    />
                                ) : (
                                    <span className={styles.noImage}>No Image</span>
                                )}
                            </div>


                            <div className={styles.eventContent}>
                                <div className={styles.status}>
                                    <span className={styles[timing.className]}>
                                        {timing.label}
                                    </span>
                                </div>


                                <div className={styles.eventName}>
                                    {event.name}
                                
                                    {event.isWeekly && (
                                        <span className={styles.weeklyWrapper}>
                                            ⟳ Manually Fetched
                                            <span className={styles.weeklyTooltip}>
                                                This is an event manually fetched from the VACC website. Double check the event's official page to see if it is actually happening.
                                            </span>
                                        </span>
                                    )}
                                </div>

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