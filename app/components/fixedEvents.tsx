const FIXED_EVENTS = [
    {
        name: "Zurich Night",
        weekday: 2, // Tuesday (UTC)
        startTimeUtc: "19:00",
        endTimeUtc: "21:00",
        airports: ["LSZH", "LSGG", "LFSB"],
        banner: "/images/events/zurich-night.png",
        link: "https://vacc.ch",
    },
    {
        name: "Frankfurt Friday",
        weekday: 5, // Friday (UTC)
        startTimeUtc: "19:00",
        endTimeUtc: "21:00",
        airports: ["EDDF"],
        banner: "/images/events/frankfurt-friday.png",
        link: "https://vatsim-germany.org/",
    },
];

export const fixedEventsProcessed = () => {
    const now = new Date();

    return FIXED_EVENTS.map(e => {
        // Get today's UTC midnight
        const todayUtc = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
        ));

        const currentWeekday = todayUtc.getUTCDay();
        let daysUntil = e.weekday - currentWeekday;
        if (daysUntil < 0) daysUntil += 7; // Next occurrence if weekday passed

        const eventDate = new Date(todayUtc);
        eventDate.setUTCDate(todayUtc.getUTCDate() + daysUntil);

        const [sh, sm] = e.startTimeUtc.split(":").map(Number);
        const [eh, em] = e.endTimeUtc.split(":").map(Number);

        const start = new Date(eventDate);
        start.setUTCHours(sh, sm, 0, 0);

        const end = new Date(eventDate);
        end.setUTCHours(eh, em, 0, 0);

        return {
            name: e.name,
            airports: e.airports.map(icao => ({ icao })),
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            banner: e.banner,
            link: e.link,
            isWeekly: true,
        };
    });
};