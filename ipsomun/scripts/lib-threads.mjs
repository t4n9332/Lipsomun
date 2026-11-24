// scripts/lib-threads.mjs — Threads 공식 API(OAuth) 연동. ThreadsAuto/src/threads-api.js 에서 이 파일만 가져왔다(2026-11-24, 본체·계정과는 무관).
//
// 왜 API로 가나:
//   브라우저 자동화는 "지금 어느 계정이 활성인가"를 매번 알아내야 하는데,
//   메타 계정 센터에 여러 계정이 묶이면 그걸 확실히 알 방법이 없다(실제로 엉뚱한 계정에 글이 올라갔다).
//   API는 계정마다 액세스 토큰이 1:1로 발급되므로 계정이 섞일 수가 없다.
//   덤으로 봇 탐지·계정 정지 위험도 사라진다(공식 경로).
//
// 흐름:
//   ① 인가 URL 열기 → 사용자가 승인 → redirect_uri 로 code 전달
//   ② code → 단기 토큰(1시간) → 장기 토큰(60일)
//   ③ 게시: 컨테이너 생성(/threads) → 발행(/threads_publish)
//   ④ 첫 댓글: reply_to_id 로 같은 방식 한 번 더
//
// 제한(계정당 24시간): 게시 250건 · 답글 1,000건 · 삭제 100건
const GRAPH = "https://graph.threads.net";
const AUTH = "https://threads.net/oauth/authorize";

export const SCOPES = [
  "threads_basic",             // 필수
  "threads_content_publish",   // 게시
  "threads_manage_replies",    // 첫 댓글(비교 링크)
  // threads_read_replies 는 쓰지 않는다 — 앱에 추가하지 않은 권한을 요청하면 승인 단계에서 막힌다(2026-11-24)
];

/** 사용자가 승인할 인가 URL */
export function authUrl({ appId, redirectUri, state = "" }) {
  const q = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(","),
    response_type: "code",
    ...(state ? { state } : {}),
  });
  return `${AUTH}?${q}`;
}

async function post(path, params) {
  const r = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}
async function get(path, params) {
  const r = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

/** code → 장기 토큰(60일) + 계정 정보 */
export async function exchangeCode({ appId, appSecret, redirectUri, code }) {
  // ① 단기 토큰(1시간)
  const short = await post("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: String(code).replace(/#_$/, ""), // 리다이렉트 URL 끝에 붙는 '#_' 제거
  });
  // ② 장기 토큰(60일)
  const long = await get("/access_token", {
    grant_type: "th_exchange_token",
    client_secret: appSecret,
    access_token: short.access_token,
  });
  const me = await get("/v1.0/me", {
    fields: "id,username,threads_profile_picture_url",
    access_token: long.access_token,
  });
  return {
    userId: me.id,
    username: me.username,
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + (long.expires_in ?? 5184000) * 1000).toISOString(),
  };
}

/** 장기 토큰 갱신(만료 전 재발급 — 24시간 이상 지난 토큰만 가능) */
export async function refreshToken(accessToken) {
  const j = await get("/refresh_access_token", {
    grant_type: "th_refresh_token",
    access_token: accessToken,
  });
  return {
    accessToken: j.access_token,
    expiresAt: new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString(),
  };
}

/**
 * 글 게시. 컨테이너 생성 → 발행 2단계.
 * @param {object} o
 * @param {string} o.userId
 * @param {string} o.accessToken
 * @param {string} o.text 본문(해시태그 포함해 넘기면 됨)
 * @param {string} [o.imageUrl] 공개 URL(로컬 파일 불가 — 업로드 필요)
 * @param {string} [o.replyToId] 이 글에 답글로 달 때
 * @returns {Promise<string>} 게시된 글 id
 */
export async function publish({ userId, accessToken, text, imageUrl, replyToId }) {
  const container = await post(`/v1.0/${userId}/threads`, {
    media_type: imageUrl ? "IMAGE" : "TEXT",
    ...(imageUrl ? { image_url: imageUrl } : {}),
    text: String(text || "").slice(0, 500),
    ...(replyToId ? { reply_to_id: replyToId } : {}),
    access_token: accessToken,
  });
  // 컨테이너가 준비될 때까지 잠깐 기다린다(권장 30초, 텍스트는 대개 즉시)
  await new Promise((r) => setTimeout(r, imageUrl ? 8000 : 1500));
  const res = await post(`/v1.0/${userId}/threads_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });
  return res.id;
}

/** 글 + 첫 댓글(쿠팡 링크)을 한 번에 */
export async function publishWithComment({ userId, accessToken, text, imageUrl, comment }) {
  const postId = await publish({ userId, accessToken, text, imageUrl });
  if (comment) {
    await new Promise((r) => setTimeout(r, 2500));
    await publish({ userId, accessToken, text: comment, replyToId: postId });
  }
  return postId;
}

/** 토큰이 살아있는지 + 어떤 계정인지 확인 */
export async function whoami(accessToken) {
  const me = await get("/v1.0/me", { fields: "id,username", access_token: accessToken });
  return { userId: me.id, username: me.username };
}
