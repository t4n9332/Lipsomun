/**
 * 텔레그램 특가 채널 자동 발송
 * - 봇 생성: 텔레그램에서 @BotFather → /newbot → 토큰 발급
 * - 채널 생성 후 봇을 관리자로 추가
 * - 환경변수: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID(@채널아이디 또는 -100으로 시작하는 숫자)
 */

export function telegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** HTML 모드 메시지 발송 (4096자 제한 — 초과 시 자름) */
export async function sendTelegram(html: string): Promise<{ ok: boolean; error?: string }> {
  if (!telegramConfigured()) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: html.slice(0, 4096),
          parse_mode: "HTML",
          disable_web_page_preview: false,
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

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
