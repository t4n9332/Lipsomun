"use client";

import { useEffect, useState } from "react";

/**
 * 웹푸시 구독 버튼 — 로그인 없이 동작한다.
 *
 * 구독 진입점이 /my(로그인 뒤)에만 있어 구독자가 사실상 없었다. 푸시 구독 자체는
 * 계정이 필요 없고(`push_subscriptions.user_id`가 nullable), 로그인 상태면 서버가
 * 알아서 계정에 연결한다. 그래서 딜·가격비교·상품 상세처럼 사람이 실제로 머무는
 * 자리에 이 버튼을 둔다.
 *
 * 구독 상태 판별은 반드시 실제 PushManager 구독을 확인한다. Notification.permission만
 * 보면 "허용했지만 구독은 지운" 기기가 영영 구독 못 하는 상태로 굳는다.
 */
export default function PushSubscribeButton({
  label = "🔔 특가 알림 받기",
  hint,
  className = "push-cta",
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  const [state, setState] = useState<
    "loading" | "unsupported" | "off" | "on" | "busy"
  >("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      })
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setState("busy");
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("off");
        setMsg("알림이 차단돼 있어요. 주소창 자물쇠 아이콘에서 허용해 주세요.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await fetch("/api/push/key").then((r) => r.json());
      if (!key) throw new Error("서버 푸시 설정이 아직 안 되어 있어요.");
      // 이미 구독이 있으면 재사용한다 (다른 키로 재구독하면 InvalidStateError)
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("구독 저장에 실패했어요.");
      setState("on");
      setMsg("완료! 매일 아침 오늘의 특가를 보내드릴게요.");
    } catch (e) {
      setState("off");
      setMsg(e instanceof Error ? e.message : "알림 설정에 실패했어요.");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className={className}>
      {state === "on" ? (
        <p className="push-done">
          🔔 알림 설정 완료 — 매일 아침 특가와 찜한 상품 가격 인하를 보내드려요.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="btn push-btn"
            onClick={enable}
            disabled={state === "busy"}
          >
            {state === "busy" ? "설정 중..." : label}
          </button>
          {hint && <span className="push-hint">{hint}</span>}
        </>
      )}
      {msg && <p className="push-msg">{msg}</p>}
    </div>
  );
}
