/**
 * 텔레그램 특가 채널 자동 발송
 * - 봇 생성: 텔레그램에서 @BotFather → /newbot → 토큰 발급
 * - 채널 생성 후 봇을 관리자로 추가
 * - 환경변수: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID(@채널아이디 또는 -100으로 시작하는 숫자)
 */

/**
 * 텔레그램 sendMessage 한 통의 상한은 4,096자다. 예전에는 `html.slice(0, 4096)`으로
 * 그냥 잘랐는데, 그러면 `<a href="…` 한가운데가 잘려 나가 텔레그램이 메시지 **전체**를
 * 거부했다(can't parse entities: Unclosed start tag). 브리핑에 실을 게 많은 날 —
 * 역대최저가·가격비교·오늘의 딜이 다 찬 날 — 만 골라서 발송이 통째로 실패했다.
 * (2026-09-07 로그 확인: 22회 중 1회, 전부 내용이 가장 많던 회차.)
 *
 * 그래서 자르지 않고 **줄 경계에서 나눠 여러 통으로** 보낸다. 태그가 쪼개질 일이 없고
 * 내용도 잃지 않는다.
 */
const LIMIT = 3900; // 4,096에서 여유를 둔다 (이모지는 2자로 세어질 수 있다)
const MAX_CHUNKS = 4; // 채널 도배 방지 상한

export function telegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * 줄 단위로 LIMIT 이하 덩어리로 나눈다. 한 줄이 그 자체로 한도를 넘는 비정상 입력만
 * safeTruncate로 처리한다(우리가 만드는 줄은 제목을 45자로 잘라 쓰므로 사실상 없다).
 */
export function splitForTelegram(html: string, limit = LIMIT): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const rawLine of html.split("\n")) {
    const line = rawLine.length > limit ? safeTruncate(rawLine, limit) : rawLine;
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length > limit) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** 열린 태그를 남기지 않고 자른다 — 잘린 자리의 불완전한 `<…`를 버리고 열린 태그를 닫는다 */
function safeTruncate(s: string, limit: number): string {
  let cut = s.slice(0, limit);
  // 잘린 끝에 닫히지 않은 `<`가 있으면 그 앞에서 끊는다
  const lastOpen = cut.lastIndexOf("<");
  if (lastOpen > cut.lastIndexOf(">")) cut = cut.slice(0, lastOpen);
  // 남아 있는 열린 태그를 역순으로 닫는다
  const stack: string[] = [];
  for (const m of cut.matchAll(/<(\/?)([a-z]+)[^>]*>/gi)) {
    if (m[1]) {
      const i = stack.lastIndexOf(m[2].toLowerCase());
      if (i >= 0) stack.splice(i, 1);
    } else {
      stack.push(m[2].toLowerCase());
    }
  }
  return cut + stack.reverse().map((t) => `</${t}>`).join("");
}

/** HTML 모드 메시지 발송 — 길면 줄 경계에서 나눠 여러 통으로 보낸다 */
export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  if (!telegramConfigured()) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정" };
  }
  const chunks = splitForTelegram(html).slice(0, MAX_CHUNKS);
  for (let i = 0; i < chunks.length; i++) {
    const r = await sendOne(chunks[i], i === 0);
    // 한 통이라도 실패하면 즉시 알린다 — 조용히 반쪽만 나가지 않게
    if (!r.ok) return { ok: false, error: `${i + 1}/${chunks.length}통 실패: ${r.error}` };
  }
  return { ok: true };
}

async function sendOne(text: string, preview: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: "HTML",
          // 미리보기는 첫 통에만 — 나머지까지 붙으면 채널이 지저분해진다
          disable_web_page_preview: !preview,
        }),
        cache: "no-store",
      }
    );
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "텔레그램 발송 실패" };
  }
}

/** 텍스트 노드용 이스케이프 */
export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 속성값(href)용 이스케이프. utm 파라미터가 붙은 링크에는 `&`가 들어 있는데
 * 날것으로 두면 텔레그램이 엔티티로 해석하려다 파싱에 실패할 수 있다.
 */
export function escAttr(s: string): string {
  return escHtml(s).replace(/"/g, "&quot;");
}
