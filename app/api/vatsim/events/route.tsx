// app/api/vatsim/events/route.js

export async function GET() {
    const res = await fetch("https://my.vatsim.net/api/v2/events/latest", {
        headers: {
            "User-Agent": "YourAppName (contact@example.com)"
        }
    });

    const data = await res.json();

    return Response.json(data);
}