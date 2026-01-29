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
};


export default nextConfig;
