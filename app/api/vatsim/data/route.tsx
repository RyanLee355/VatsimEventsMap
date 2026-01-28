// app/api/vatsim/data/route.js

export async function GET() {
    const res = await fetch("https://data.vatsim.net/v3/vatsim-data.json");
    const data = await res.json();

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}