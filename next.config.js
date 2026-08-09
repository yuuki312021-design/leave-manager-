/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

module.exports = nextConfig;
