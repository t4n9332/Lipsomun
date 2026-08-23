import webpush from "web-push";
import { getPushSubscriptions, deletePushSubscription } from "@/lib/db";

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
