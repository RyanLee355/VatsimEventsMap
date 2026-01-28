const fs = require("fs");
const path = require("path");

const txtPath = path.join(__dirname, "GlobalAirportDatabase.txt");
const jsonPath = path.join(__dirname, "airports.json");

const txt = fs.readFileSync(txtPath, "utf-8");

// Normalize line endings and split
const lines = txt.replace(/\r/g, "").split("\n");

// Filter out empty lines or lines too short
const airportsDb = {};
for (const line of lines) {
    if (!line || line.trim().length === 0) continue;

    const parts = line.split(";").map(p => p.trim());
    if (parts.length < 16) continue; // need at least 16 fields

    const icao = parts[0];
    const name = parts[2]; // airport name
    const city = parts[3];
    const country = parts[4];
    const lat = parseFloat(parts[14]);
    const lng = parseFloat(parts[15]);

    // Skip invalid numbers
    if (!icao || !name || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

    airportsDb[icao] = { name, city, country, lat, lng };
}

fs.writeFileSync(jsonPath, JSON.stringify(airportsDb, null, 2));
console.log(`Converted ${Object.keys(airportsDb).length} airports to airports.json`);