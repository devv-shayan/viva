import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF extraction runs only in the Node.js upload route. Keep its Node/native
  // dependencies external so Vercel loads the correct runtime binary.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;