import webpush from "web-push";
import {
  getPushSubscriptions,
  deletePushSubscription,
  getPushSubscriptionsByUsers,
  getFavoritePriceDrops,
} from "@/lib/db";

function configured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setup() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@lipsomun.co.kr",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** 저장된 모든 구독자에게 알림 발송. 만료된 구독은 자동 정리 */
export async function sendPushToAll(payload: PushPayload): Promise<{
  sent: number;
  removed: number;
  skipped?: string;
}> {
  if (!configured()) {
    return { sent: 0, removed: 0, skipped: "VAPID 키 미설정" };
  }
  setup();

  const subs = await getPushSubscriptions();
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        const subscription = JSON.parse(s.data);
        await webpush.sendNotification(subscription, body, { TTL: 3600 * 12 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await deletePushSubscription(s.endpoint).catch(() => {});
          removed++;
        }
      }
    })
  );

  return { sent, removed };
}

/** 특정 사용자들에게만 발송 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  if (!configured() || userIds.length === 0) return { sent: 0, removed: 0 };
  setup();
  const subs = await getPushSubscriptionsByUsers(userIds);
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(JSON.parse(s.data), body, { TTL: 3600 * 12 });
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await deletePushSubscription(s.endpoint).catch(() => {});
          removed++;
        }
      }
    })
  );
  return { sent, removed };
}

/** 찜한 상품 가격 인하 알림 — 사용자별로 묶어서 발송 */
export async function sendFavoritePriceDropPush(): Promise<{
  users: number;
  sent: number;
}> {
  if (!configured()) return { users: 0, sent: 0 };
  const drops = await getFavoritePriceDrops();
  if (drops.length === 0) return { users: 0, sent: 0 };

  const byUser = new Map<string, typeof drops>();
  for (const d of drops) {
    const arr = byUser.get(d.userId) || [];
    arr.push(d);
    byUser.set(d.userId, arr);
  }

  let sent = 0;
  for (const [userId, items] of byUser) {
    const top = items.reduce((a, b) =>
      b.prevPrice - b.price > a.prevPrice - a.price ? b : a
    );
    const others = items.length - 1;
    const title = "💸 찜한 상품 가격이 내려갔어요!";
    const short =
      top.title.length > 28 ? top.title.slice(0, 28) + "…" : top.title;
    const body =
      `${short} ${top.prevPrice.toLocaleString("ko-KR")}원 → ${top.price.toLocaleString("ko-KR")}원` +
      (others > 0 ? ` 외 ${others}개` : "");
    const url = others > 0 ? "/favorites" : `/p/${top.slug}`;
    const r = await sendPushToUsers([userId], { title, body, url });
    sent += r.sent;
  }
  return { users: byUser.size, sent };
}
