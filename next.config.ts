import type { NextConfig } from "next";

const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'vatsim-my.nyc3.digitaloceanspaces.com',
            },
        ],
    },
    allowedDevOrigins: [
        'localhost',
        '127.0.0.1',
        '192.168.0.248',
        '*.local-origin.dev',
    ],
};

export default nextConfig;
