/**
 * 계산기 목록.
 *
 * 왜 계산기인가: 글은 읽고 1~2분이면 나가지만 계산기는 숫자를 바꿔가며 5분씩 머문다.
 * 체류시간이 길수록 광고 단가가 오른다. 그리고 한 번 만들면 계속 돈다 —
 * 매일 글을 쓰지 않아도 되는 자산이다.
 *
 * 새 계산기를 추가하려면 여기 한 줄 넣고 components/calc 에 컴포넌트를 만들면 된다.
 */

export type Calc = {
  slug: string;
  title: string;       // 페이지 제목 (검색 노출용)
  short: string;       // 목록에 뜨는 짧은 이름
  desc: string;        // 메타 설명
  keywords: string[];
  emoji: string;
};

export const CALCULATORS: Calc[] = [
  {
    slug: "대출갈아타기",
    title: "주택담보대출 갈아타기 계산기 — 이득인지 손해인지 바로 확인",
    short: "대출 갈아타기",
    desc:
      "금리 차이만 보면 손해 볼 수 있습니다. 아낄 이자에서 중도상환수수료를 빼면 " +
      "실제로 얼마가 남는지 숫자를 넣어 바로 계산해보세요.",
    keywords: [
      "주택담보대출갈아타기",
      "대환대출계산기",
      "중도상환수수료계산기",
      "주담대갈아타기",
      "대출갈아타기이득",
    ],
    emoji: "🏠",
  },
];

export const getCalc = (slug: string) =>
  CALCULATORS.find((c) => c.slug === decodeURIComponent(slug));
