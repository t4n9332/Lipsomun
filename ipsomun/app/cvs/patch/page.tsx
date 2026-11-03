import type { Metadata } from "next";
import Link from "next/link";
import { monthLabel, type ChangeKind } from "@/lib/cvs";
import { CUR, PREV, HAS_PREV, CHANGES } from "@/lib/cvsData";
import CvsChangeRow from "@/components/CvsChangeRow";
import CvsSearch from "@/components/CvsSearch";

export const dynamic = "force-static";

const SITE = process.env.SITE_URL || "https://lipsomun.co.kr";
const TITLE = HAS_PREV
  ? `${monthLabel(CUR.month)} 편의점 행사 패치노트 — 버프·너프 총정리`
  : "편의점 행사 패치노트 — 버프·너프 총정리";

export const metadata: Metadata = {
  title: TITLE,
  description: "지난달과 비교해 1+1·2+1 조건이 좋아진(버프)·나빠진(너프)·새로 생긴·끝난 편의점 행사를 게임 패치노트처럼 정리했습니다.",
  alternates: { canonical: `${SITE}/cvs/patch` },
  openGraph: { title: TITLE, url: `${SITE}/cvs/patch`, type: "article", siteName: "입소문", locale: "ko_KR", images: ["/og-default.png"] },
};

const SECTIONS: { kind: ChangeKind; title: string; desc: string }[] = [
  { kind: "buff", title: "▲ 버프", desc: "지난달보다 1개당 싸진 행사" },
  { kind: "nerf", title: "▼ 너프", desc: "지난달보다 1개당 비싸진 행사" },
  { kind: "new", title: "✚ 신규", desc: "이번 달 새로 행사에 들어온 상품" },
  { kind: "ended", title: "✖ 종료", desc: "지난달엔 했는데 이번 달엔 빠진 상품" },
];

export default function CvsPatchPage() {
  return (
    <section className="section">
      <div className="section-head">
        <h1>🎮 {TITLE.split(" — ")[0]}</h1>
        <span className="sub">
          {HAS_PREV ? `${monthLabel(PREV.month)} → ${monthLabel(CUR.month)}` : ""}
        </span>
      </div>
      <p className="cvs-patch-lead">
        같은 상품이라도 2+1이 1+1로 바뀌면 <b>버프</b>, 1+1이 2+1로 바뀌면 <b>너프</b>입니다. 편의점마다
        반대로 움직이는 경우도 많으니 <Link href="/cvs">4사 비교</Link>와 같이 보세요.
      </p>
      {!HAS_PREV ? (
        <div className="empty">두 달치 데이터가 쌓이면 다음 달 1일부터 패치노트가 열립니다.</div>
      ) : (
        <div id="cvs-patch">
          <CvsSearch target="cvs-patch" />
          {SECTIONS.map((s) => {
            const list = CHANGES.filter((c) => c.kind === s.kind);
            if (!list.length) return null;
            return (
              <div key={s.kind} className="cvs-patch-sec">
                <h2 className={`cvs-${s.kind}-h`}>
                  {s.title} <small>{list.length}개 · {s.desc}</small>
                </h2>
                <ul className="cvs-changes">
                  {list.slice(0, 300).map((c, i) => (
                    <CvsChangeRow key={i} c={c} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
