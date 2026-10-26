import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "60mb" },
    serverComponentsExternalPackages: ["adm-zip", "bcryptjs"],
  },
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
