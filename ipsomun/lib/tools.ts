/**
 * 파일 도구 목록.
 *
 * 계산기(lib/calculators.ts)와 형제 구조지만 성격이 다르다 — 계산기는 숫자,
 * 이쪽은 파일이다. 그래서 라우트를 /tools 로 분리했다.
 *
 * 이 도구들의 공통 원칙: **파일을 서버로 보내지 않는다.**
 * 전부 사용자의 브라우저 안에서 끝난다. 업로드가 없으니 용량 제한도 없고,
 * 회사 문서를 다루는 사람이 마음 놓고 쓸 수 있다.
 * 대형 서비스(iLovePDF 등)는 서버에 올려서 처리하므로 구조상 이걸 못 한다.
 *
 * 새 도구는 여기 한 줄 + components/tools 컴포넌트 + [slug] REGISTRY 한 줄이면 붙는다.
 */

export const TOOL_GROUPS = ["PDF"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export type Tool = {
  slug: string;
  title: string;
  short: string;
  desc: string;
  keywords: string[];
  emoji: string;
  group: ToolGroup;
};

export const TOOLS: Tool[] = [
  {
    slug: "PDF합치기",
    title: "PDF 합치기 — 설치도 업로드도 없이 브라우저에서 바로",
    short: "PDF 합치기",
    desc:
      "여러 개의 PDF를 하나로 합칩니다. 파일이 서버로 전송되지 않고 " +
      "브라우저 안에서 처리되므로, 용량 제한이 없고 문서가 밖으로 나가지 않습니다.",
    keywords: [
      "PDF합치기",
      "PDF병합",
      "PDF파일합치기",
      "PDF묶기",
      "PDF합치기무료",
    ],
    emoji: "📎",
    group: "PDF",
  },
];

export const getTool = (slug: string) =>
  TOOLS.find((t) => t.slug === decodeURIComponent(slug));

export const groupedTools = () =>
  TOOL_GROUPS.map((g) => ({
    group: g,
    items: TOOLS.filter((t) => t.group === g),
  })).filter((x) => x.items.length > 0);
