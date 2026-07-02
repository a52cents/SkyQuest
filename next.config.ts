import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.output.trustedTypes = {
      policyName: "skyquest",
      onPolicyCreationFailure: "continue",
    };
    return config;
  },
};

export default nextConfig;
