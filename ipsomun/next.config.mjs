/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Vercel 이미지 최적화를 쓰지 않는다.
    //
    // 상품 썸네일은 쿠팡·토스 CDN이 이미 적정 크기(20KB 안팎)로 서빙하므로
    // 재최적화의 이득이 거의 없는 반면, 요청마다 최적화 할당량을 소모한다.
    // 실제로 할당량이 소진돼 /_next/image가 402(Payment Required)를 반환하면서
    // 사이트 전체 이미지가 깨졌다. unoptimized면 원본 URL을 그대로 쓰므로
    // 할당량과 무관하고 CDN에서 바로 받아 더 빠르다.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async headers() {
    // 보안 응답 헤더. 관리자 화면이 서버 액션 폼이라 투명 iframe(클릭재킹)으로
    // 삭제·토글을 대신 누르게 할 수 있었다. 공개 페이지도 프레임 허용이 필요 없다.
    // 전체 CSP(script-src 등)는 애드센스·GA·jsdelivr 폰트 때문에 frame-ancestors만 건다.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
