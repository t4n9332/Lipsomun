import Link from "next/link";
import { groupedTools, TOOLS } from "@/lib/tools";

export const revalidate = 86400;

export const metadata = {
  title: "파일 도구",
  description:
    "PDF 합치기 등 자주 쓰는 파일 작업을 브라우저에서 바로 처리합니다. " +
    "파일이 서버로 전송되지 않아 용량 제한이 없고 문서가 밖으로 나가지 않습니다.",
  alternates: { canonical: "/tools" },
};

const anchor = (g: string) => "tg-" + g.replace(/·/g, "-");

export default function ToolsHub() {
  const groups = groupedTools();

  return (
    <section className="section">
      <div className="section-head">
        <h2>🧰 파일 도구</h2>
        <span className="sub">
          설치도, 가입도, 업로드도 없습니다 — 브라우저에서 바로 끝납니다
        </span>
      </div>

      <p className="calc-intro">
        비슷한 서비스들은 파일을 자기 서버에 올려서 처리합니다. 여기는 다릅니다.
        <b> 파일이 이 컴퓨터를 떠나지 않습니다.</b> 그래서 용량 제한이 없고,
        회사 문서를 다뤄도 걱정할 것이 없습니다.
      </p>

      {groups.length > 1 && (
        <nav className="calc-groupnav">
          {groups.map((g) => (
            <a key={g.group} href={"#" + anchor(g.group)}>
              {g.group}
            </a>
          ))}
        </nav>
      )}

      {groups.map((g) => (
        <div key={g.group} className="calc-group">
          <h3 id={anchor(g.group)} className="calc-group-title">
            {g.group}
            <span>{g.items.length}개</span>
          </h3>
          <div className="calc-list">
            {g.items.map((t) => (
              <Link
                key={t.slug}
                href={"/tools/" + encodeURIComponent(t.slug)}
                className="calc-card"
              >
                <span className="calc-emoji">{t.emoji}</span>
                <span className="calc-card-body">
                  <b>{t.short}</b>
                  <em>{t.desc}</em>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <p className="calc-src">
        현재 {TOOLS.length}개이며 계속 늘려갑니다. 필요한 도구가 있으면
        <a href="mailto:t4n2140@gmail.com"> 알려주세요</a>.
      </p>
    </section>
  );
}
