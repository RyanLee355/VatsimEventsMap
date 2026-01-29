import { Route, Ring } from "@/app/types";
import Image from "next/image";

type Props = {
    routes: Route[];
    rings: Ring[];
    collapsed: boolean; // new
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

export default function EventSidePanel({ routes, rings, collapsed }: Props) {
    const eventsMap = new Map<
        string,
        { name: string; startTime: Date; endTime: Date; airports: string[]; banner: string | null }
    >();

    routes.forEach(r => {
        if (!eventsMap.has(r.eventName)) {
            eventsMap.set(r.eventName, {
                name: r.eventName,
                startTime: r.startTime,
                endTime: r.endTime,
                airports: r.airportsInvolved,
                banner: r.banner,
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
                banner: r.banner,
            });
        }
    });

    const events = Array.from(eventsMap.values()).sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    let lastDayLabel = "";
    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "25vw",
                minWidth: "250px",
                height: "100%",
                backgroundColor: "rgba(0,0,0,0.8)",
                color: "white",
                padding: "16px",
                overflowY: "auto",
                zIndex: 10000,
                boxShadow: "2px 0 10px rgba(0,0,0,0.5)",
                transition: "transform 0.3s ease",
                transform: collapsed ? "translateX(-100%)" : "translateX(0)",
            }}
        >
            <h2 style={{ marginBottom: "16px", fontSize: "1.25rem", fontWeight: "bold" }}>Events</h2>

            {events.map((event, idx) => {
                const dayLabel = getDayLabel(event.startTime);
                const showHeader = dayLabel !== lastDayLabel;
                lastDayLabel = dayLabel;

                return (
                    <div key={idx}>
                        {showHeader && (
                            <div style={{ marginTop: "12px", marginBottom: "4px", fontWeight: "bold", fontSize: "0.85rem", color: "#aaa" }}>
                                {dayLabel}
                            </div>
                        )}

                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                marginBottom: "12px",
                                padding: "8px",
                                borderRadius: "6px",
                                backgroundColor: "rgba(255,255,255,0.05)",
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    width: "80px",
                                    height: "80px",
                                    flexShrink: 0,
                                    borderRadius: "6px",
                                    overflow: "hidden",
                                    backgroundColor: "#222",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {event.banner ? (
                                    <Image
                                        src={event.banner}
                                        alt={event.name}
                                        width={80}
                                        height={80}
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : (
                                    <span style={{ color: "#666", fontSize: "0.75rem" }}>No Image</span>
                                )}
                            </div>

                            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: "0.75rem", marginBottom: "2px" }}>
                                    {event.startTime <= new Date() && event.endTime >= new Date() ? (
                                        <span style={{ color: "#00ff00", fontWeight: "bold" }}>● Ongoing</span>
                                    ) : (
                                        <span style={{ color: "#888888" }}>● Upcoming</span>
                                    )}
                                </div>
                                <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{event.name}</div>
                                <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                                    {event.startTime.toLocaleString()} → {event.endTime.toLocaleString()}
                                </div>
                                <div style={{ fontSize: "0.75rem", marginTop: "4px", color: "#ccc" }}>
                                    {event.airports.join(", ")}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}