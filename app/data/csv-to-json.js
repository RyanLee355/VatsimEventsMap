const fs = require("fs");
const path = require("path");

const csvPath = path.join(__dirname, "iata-icao.csv");
const jsonPath = path.join(__dirname, "iata-icao.json");

const csv = fs.readFileSync(csvPath, "utf-8");

// Normalize line endings and split into lines
const lines = csv.replace(/\r/g, "").split("\n");

// Remove header line
lines.shift();

const airportsDb = {};

for (const line of lines) {
    if (!line || line.trim().length === 0) continue;

    // Split CSV while removing quotes
    const parts = line
        .split(",")
        .map(p => p.replace(/^"|"$/g, "").trim());

    if (parts.length < 7) continue;

    const country = parts[0];
    const region = parts[1];
    const iata = parts[2];
    const icao = parts[3];
    const name = parts[4];
    const lat = parseFloat(parts[5]);
    const lng = parseFloat(parts[6]);

    // Basic validation
    if (!icao || !name || isNaN(lat) || isNaN(lng)) continue;

    airportsDb[icao] = {
        name,
        iata,
        country,
        region,
        lat,
        lng
    };
}

fs.writeFileSync(jsonPath, JSON.stringify(airportsDb, null, 2));
console.log(`Converted ${Object.keys(airportsDb).length} airports to airports.json`);