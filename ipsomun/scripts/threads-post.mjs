/**
 * 스레드 하루 1개 자동 게시 (2026-11-24) — AI 없이 돈다(토큰 비용 0).
 *
 *   node scripts/threads-post.mjs          # 오늘 아직 안 올렸으면 게시 (toss-auto.bat 가 social-card 다음에 부른다)
 *   node scripts/threads-post.mjs --dry    # 올릴 내용만 보여 줌
 *   node scripts/threads-post.mjs --force  # 오늘 이미 올렸어도 다시 (시험용 — 남용 금지)
 *
 * 내용: social-card.mjs 가 만든 오늘의 스레드 캡션(소셜카드/캡션-YYYY-MM-DD-*.txt, 인스타용 제외).
 *   본문 = 캡션에서 링크 줄을 빼고 "링크는 첫 댓글" 안내. 광고 표시 문구는 본문에 그대로 둔다(공정위 추천·보증 지침).
 *   첫 댓글 = 비교 링크(utm_source=threads → 관리자 '채널별 클릭'에 스레드로 잡힌다).
 *   사진 = 그 상품의 대표 이미지(공개 URL). 사진 게시가 실패하면 글만 올린다.
 * 토큰: 만료 15일 전부터 자동 갱신. 만료·실패는 [스레드] 로그 + PC 알림.
 * 계정·앱 연결: node scripts/threads-setup.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { publish, refreshToken } from "./lib-threads.mjs";
import { loadToken, saveToken } from "./lib-threads-config.mjs";
import { showToast } from "./lib-local-alert.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARD_DIR = path.join(__dirname, "..", "..", "소셜카드");
const POSTED_PATH = path.join(__dirname, ".threads-posted.json");
const CONFIG_PATH = path.join(__dirname, ".toss-config.json");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const log = (m) => console.log(`[스레드] ${m}`);

const kstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function readPosted() {
  try {
    return JSON.parse(readFileSync(POSTED_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** 오늘 날짜의 스레드 캡션 중 가장 최근 파일 */
function todaysCaption(day) {
  if (!existsSync(CARD_DIR)) return null;
  const files = readdirSync(CARD_DIR)
    .filter((f) => f.startsWith(`캡션-${day}-`) && f.endsWith(".txt"))
    .map((f) => path.join(CARD_DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] || null;
}

/** 캡션 → { body, link } */
export function splitCaption(caption) {
  const lines = caption.replace(/\r/g, "").split("\n");
  const linkLine = lines.find((l) => /^https?:\/\/\S+$/.test(l.trim()));
  const body = lines
    .filter((l) => l !== linkLine)
    .join("\n")
    .replace(/👇\s*$/m, "👇 (링크는 첫 댓글)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body: body.slice(0, 500), link: linkLine?.trim() || "" };
}

/** 비교 링크(/r/<상품id>)의 상품 대표 이미지 — 사이트 관리자 API 로 찾는다. 없으면 null(글만 게시) */
async function productImage(link) {
  const id = link.match(/\/r\/([0-9a-f-]{36})/)?.[1];
  if (!id || !existsSync(CONFIG_PATH)) return null;
  try {
    const c = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    const t = createHash("sha256").update("ipsomun:" + c.adminPassword + (c.tokenSecret ? ":" + c.tokenSecret : "")).digest("hex");
    const r = await fetch(c.siteUrl + "/api/admin/products?limit=10000", { headers: { Cookie: "ipsomun_admin=" + t } });
    const { products } = await r.json();
    const slug = products.find((p) => p.id === id)?.slug;
    if (!slug) return null;
    // 목록 API 에는 이미지가 없다 → 상품 페이지의 공유용 대표 이미지(og:image)를 읽는다
    const html = await (await fetch(`${c.siteUrl}/p/${encodeURIComponent(slug)}`)).text();
    const url = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") || "";
    return /^https:\/\//.test(url) ? url : null;
  } catch {
    return null;
  }
}

async function main() {
  const day = kstDay();
  const posted = readPosted();
  if (posted.day === day && !FORCE && !DRY) return log(`오늘(${day}) 이미 게시함 — 건너뜀 (${posted.postId})`);

  const file = todaysCaption(day);
  if (!file) return log(`오늘 캡션 없음(${CARD_DIR}) — social-card 가 안 돌았거나 새 상품이 없다. 건너뜀`);
  const { body, link } = splitCaption(readFileSync(file, "utf8"));
  if (!/수수료/.test(body)) return log("캡션에 광고 표시 문구가 없어 게시하지 않음(공정위 지침) — social-card.mjs 확인");
  const imageUrl = link ? await productImage(link) : null;

  if (DRY) {
    console.log(`\n--- 본문 (${body.length}자, 사진 ${imageUrl ? "있음" : "없음"}) ---\n${body}\n--- 첫 댓글 ---\n${link}\n`);
    return;
  }

  const tok = loadToken();
  if (!tok) return log("연결 안 됨 — node scripts/threads-setup.mjs 로 계정을 연결하면 다음 회차부터 게시");

  // 만료 15일 전부터 갱신(발급 24시간이 지나야 갱신 가능)
  let accessToken = tok.accessToken;
  const left = Date.parse(tok.expiresAt) - Date.now();
  if (left <= 0) {
    showToast("스레드 토큰 만료", "node scripts/threads-setup.mjs 로 다시 연결해 주세요.");
    return log("토큰 만료 — threads-setup.mjs 로 다시 연결 필요");
  }
  if (left < 15 * 86400_000 && Date.now() - Date.parse(tok.tokenSavedAt || 0) > 86400_000) {
    try {
      const r = await refreshToken(accessToken);
      saveToken({ accessToken: r.accessToken, expiresAt: r.expiresAt });
      accessToken = r.accessToken;
      log(`토큰 갱신 — 새 만료 ${r.expiresAt.slice(0, 10)}`);
    } catch (e) {
      log(`토큰 갱신 실패(${e.message}) — 기존 토큰으로 진행`);
    }
  }

  let postId;
  try {
    postId = await publish({ userId: tok.userId, accessToken, text: body, imageUrl: imageUrl || undefined });
  } catch (e) {
    if (!imageUrl) throw e;
    log(`사진 게시 실패(${e.message}) — 글만 다시 시도`);
    postId = await publish({ userId: tok.userId, accessToken, text: body });
  }
  if (link) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      await publish({ userId: tok.userId, accessToken, text: link, replyToId: postId });
    } catch (e) {
      log(`첫 댓글(링크) 실패: ${e.message} — 본문은 올라감`);
    }
  }
  writeFileSync(POSTED_PATH, JSON.stringify({ day, postId, file: path.basename(file), at: new Date().toISOString() }, null, 2));
  log(`게시 완료 @${tok.username} ${postId} — ${path.basename(file)}`);
}

main().catch((e) => {
  log(`실패: ${String(e?.message || e).slice(0, 200)}`);
  showToast("스레드 게시 실패", String(e?.message || e).slice(0, 80));
  process.exitCode = 1;
});
