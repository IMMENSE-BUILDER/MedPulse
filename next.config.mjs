/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow other devices on the home LAN (phone/tablet) to load the dev server.
  allowedDevOrigins: ['192.168.1.*', '127.0.0.1'],
};

export default nextConfig;
