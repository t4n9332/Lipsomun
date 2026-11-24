import type { Metadata } from "next";

/**
 * 스레드(Meta) 로그인 승인 후 돌아오는 주소 — scripts/threads-setup.mjs 가 이 주소를 redirect_uri 로 쓴다.
 * 받은 code 를 크게 보여 줘서 운영자가 터미널에 붙여 넣게 한다. 서버에 저장하지 않는다.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "스레드 연결", robots: { index: false, follow: false } };

export default async function ThreadsCallback({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
}) {
  const sp = await searchParams;
  const code = (sp.code || "").replace(/#_$/, "");
  return (
    <section className="section" style={{ maxWidth: 640, margin: "40px auto", textAlign: "center" }}>
      <h1 style={{ fontSize: 22 }}>스레드 연결</h1>
      {code ? (
        <>
          <p>아래 코드를 복사해 터미널(threads-setup)에 붙여 넣으세요. 몇 분 안에, 한 번만 쓸 수 있습니다.</p>
          <textarea
            readOnly
            value={code}
            rows={4}
            style={{ width: "100%", fontSize: 15, padding: 12, fontFamily: "monospace" }}
            aria-label="승인 코드"
          />
        </>
      ) : (
        <p>
          승인 코드가 없습니다.{" "}
          {sp.error ? `(${sp.error}${sp.error_description ? `: ${sp.error_description}` : ""})` : ""} 터미널에서 다시
          실행해 주세요.
        </p>
      )}
    </section>
  );
}
