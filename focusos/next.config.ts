import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép chạy build/dev trên Windows khi thư mục project có dấu tiếng Việt.
  // Next/SWC native lockfile đang lỗi với path như "Dự án", nên có thể trỏ distDir
  // sang một thư mục ASCII bằng biến NEXT_DIST_DIR.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
