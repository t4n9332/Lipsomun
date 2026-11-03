import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "이용약관", robots: { index: false } };

export default function TermsPage() {
  return (
    <section className="section prose-page">
      <h1>이용약관</h1>
      <p>본 약관은 입소문(https://lipsomun.co.kr, 이하 &ldquo;사이트&rdquo;) 이용에 관한 기본 사항을 정합니다. 2026년 11월 3일부터 적용됩니다.</p>

      <h2>1. 제공 정보의 성격</h2>
      <p>
        사이트의 가격비교·편의점 행사·계산기 결과는 공개된 자료와 공식 API를 바탕으로 만든 참고 정보입니다. 실제
        가격·행사·세금은 판매처, 매장, 개인 상황에 따라 다를 수 있으며, 최종 판단과 책임은 이용자에게 있습니다.
      </p>

      <h2>2. 제휴 링크</h2>
      <p>
        일부 링크는 제휴 링크로, 이를 통한 구매 시 사이트가 수수료를 받을 수 있습니다. 상품의 구매·배송·환불은 각
        판매처의 정책을 따르며 사이트는 거래 당사자가 아닙니다.
      </p>

      <h2>3. 회원 서비스</h2>
      <p>
        구글 로그인으로 찜·출석·가격 알림 기능을 쓸 수 있습니다. 비정상적인 방법(자동화된 대량 요청, 조회수·클릭수 조작
        등)으로 이용하면 이용을 제한할 수 있습니다.
      </p>

      <h2>4. 저작권</h2>
      <p>
        사이트가 직접 작성한 글·계산 로직·디자인의 저작권은 사이트에 있습니다. 상품명·상표·상품 이미지의 권리는 각
        권리자에게 있습니다.
      </p>

      <h2>5. 문의</h2>
      <p>
        <a href="mailto:t4n2140@gmail.com">t4n2140@gmail.com</a> · <Link href="/privacy">개인정보처리방침</Link>
      </p>
    </section>
  );
}
