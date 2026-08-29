export const metadata = {
  title: "개인정보처리방침",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <section className="section" style={{ maxWidth: 720, margin: "40px auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>개인정보처리방침</h1>
      <div style={{ fontSize: 14.5, lineHeight: 1.8, color: "#3d3a36" }}>
        <p>
          입소문(https://lipsomun.co.kr, 이하 &ldquo;사이트&rdquo;)은
          개인정보보호법 등 관련 법령을 준수하며, 이용자의 개인정보를 아래와
          같이 처리합니다. 본 방침은 2026년 8월 20일부터 적용됩니다.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 28 }}>1. 수집하는 개인정보와 목적</h2>
        <p>
          사이트는 구글 계정 로그인 시 <b>이메일 주소, 이름, 프로필 사진</b>을
          수집합니다. 이 정보는 회원 식별, 출석 체크·레벨 등 회원 기능 제공,
          찜 목록 보관 및 찜한 상품의 가격 변동 알림 발송 목적으로만
          사용됩니다. 로그인하지 않아도 사이트의 모든 콘텐츠를 이용할 수
          있습니다.
        </p>
        <p>
          웹푸시 알림에 동의한 경우 브라우저가 발급하는 <b>푸시 구독
          정보</b>(기기 식별용 토큰)를 저장하며, 특가 소식과 가격 인하 알림
          발송에만 사용합니다. 알림은 브라우저 설정에서 언제든 해제할 수
          있습니다.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 28 }}>2. 쿠키와 방문 통계</h2>
        <p>
          사이트는 로그인 유지를 위한 필수 쿠키를 사용하며, 서비스 개선을 위해
          Google Analytics(GA4)로 방문 통계(방문 페이지, 유입 경로, 기기 유형
          등)를 수집합니다. 이 통계는 개인을 식별하지 않는 형태로 처리됩니다.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 28 }}>3. 보관 기간 및 파기</h2>
        <p>
          개인정보는 회원 탈퇴(삭제 요청) 시 지체 없이 파기합니다. 푸시 구독
          정보는 구독이 만료되거나 해제되면 자동으로 삭제됩니다.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 28 }}>4. 처리 위탁 및 제3자 제공</h2>
        <p>
          사이트는 서비스 운영을 위해 데이터 보관·처리를 국외 사업자에
          위탁합니다: Vercel(서버 호스팅, 미국), Neon(데이터베이스, 미국),
          Google(로그인 인증·방문 통계, 미국). 그 외 개인정보를 제3자에게
          제공하거나 판매하지 않습니다.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 28 }}>5. 이용자의 권리</h2>
        <p>
          이용자는 언제든 자신의 개인정보에 대한 열람·정정·삭제를 요청할 수
          있습니다. 아래 문의처로 연락 주시면 지체 없이 처리합니다.
        </p>

        <h2 style={{ fontSize: 17, marginTop: 28 }}>6. 문의처</h2>
        <p>
          개인정보 관련 문의: <a href="mailto:t4n2140@gmail.com" style={{ color: "#1c7ed6" }}>t4n2140@gmail.com</a>
        </p>

        <p style={{ marginTop: 28, fontSize: 13, color: "#8a867f" }}>
          사이트는 쿠팡 파트너스 등 제휴 마케팅 활동의 일환으로 일정액의
          수수료를 제공받으며, 이는 개인정보 수집과 무관합니다.
        </p>
      </div>
    </section>
  );
}
