// fixedEvents.ts
const FIXED_EVENTS = [
    {
        name: "Zurich Night",
        weekday: 2, // Tuesday UTC
        startTimeUtc: "19:00",
        endTimeUtc: "21:00",
        airports: ["LSZH"],
        banner: "/images/events/zurich-night.png",
        link: "https://vacc.ch",
        intervalWeeks: 1, // weekly
    },
    {
        name: "Frankfurt Friday",
        weekday: 5, // Friday UTC
        startTimeUtc: "19:00",
        endTimeUtc: "21:00",
        airports: ["EDDF"],
        banner: "/images/events/frankfurt-friday.png",
        link: "https://vatsim-germany.org/",
        intervalWeeks: 2, // bi-weekly
        anchorWeek: "2024-01-19", // first known occurrence (UTC)
    },
    {
        name: "Munich Wednesday",
        weekday: 3, // Wednesday UTC
        startTimeUtc: "17:30",
        endTimeUtc: "20:30",
        airports: ["EDDM"],
        banner: "/images/events/munich-wednesday.png",
        link: "https://vatsim-germany.org/events/view",
        intervalWeeks: 1, // weekly
    },
];

export const fixedEventsProcessed = () => {
  const now = new Date();

  return FIXED_EVENTS.map(e => {
    const todayUtcMidnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));

    const currentWeekday = todayUtcMidnight.getUTCDay();
    let daysUntil = e.weekday - currentWeekday;
    if (daysUntil < 0) daysUntil += 7;

    const eventDate = new Date(todayUtcMidnight);
    eventDate.setUTCDate(todayUtcMidnight.getUTCDate() + daysUntil);

    const [sh, sm] = e.startTimeUtc.split(":").map(Number);
    const [eh, em] = e.endTimeUtc.split(":").map(Number);

    const start = new Date(eventDate);
    start.setUTCHours(sh, sm, 0, 0);

    const end = new Date(eventDate);
    end.setUTCHours(eh, em, 0, 0);

    // Roll forward if today's event already ended
    if (daysUntil === 0 && end < now) {
      start.setUTCDate(start.getUTCDate() + 7);
      end.setUTCDate(end.getUTCDate() + 7);
    }

    // 🔁 Handle bi-weekly (or N-weekly)
    if (e.intervalWeeks && e.intervalWeeks > 1) {
      if (!e.anchorWeek) {
        throw new Error(`anchorWeek required for bi-weekly event: ${e.name}`);
      }

      const anchor = new Date(`${e.anchorWeek}T00:00:00Z`);
      const diffWeeks = Math.floor(
        (start.getTime() - anchor.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );

      // If this week is OFF, jump forward by interval
      if (diffWeeks % e.intervalWeeks !== 0) {
        start.setUTCDate(start.getUTCDate() + 7);
        end.setUTCDate(end.getUTCDate() + 7);
      }
    }

    return {
      name: e.name,
      airports: e.airports.map(icao => ({ icao })),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      banner: e.banner,
      link: e.link,
      isWeekly: e.intervalWeeks === 1,
      intervalWeeks: e.intervalWeeks,
    };
  });
};
