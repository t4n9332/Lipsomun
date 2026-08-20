"use client";

import { useEffect, useState } from "react";
import { LEVELS } from "@/lib/levels";

interface Me {
  user: { name: string; email: string; picture: string } | null;
  stats?: { total: number; streak: number; todayDone: boolean };
  level?: { level: number; name: string; emoji: string; min: number };
  next?: { name: string; emoji: string; min: number } | null;
}

export default function MyPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pushState, setPushState] = useState<
    "unsupported" | "off" | "on" | "denied"
  >("off");

  async function load() {
    const r = await fetch("/api/me");
    setMe(await r.json());
  }

  useEffect(() => {
    load();
    // 푸시 지원/구독 상태 확인
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? "on" : "off");
      // 이미 구독 중이면 서버에 다시 등록 — 로그인 상태라면 계정과 연결됨
      // (찜한 상품 가격인하 알림이 이 연결을 통해 발송됨)
      if (sub) {
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        }).catch(() => {});
      }
    });
  }, []);

  async function stamp() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/attendance", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "출석 실패");
      setMsg(
        data.stamped
          ? `출석 완료! 도장 ${data.stats.total}개째 🎉`
          : "오늘은 이미 출석했어요. 내일 또 만나요!"
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "출석 실패");
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState("denied");
        setMsg("브라우저 알림이 차단되어 있어요. 주소창의 자물쇠 아이콘에서 허용해 주세요.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/key");
      const { key } = await keyRes.json();
      if (!key) throw new Error("서버 푸시 설정이 아직 안 되어 있어요.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushState("on");
      setMsg("알림 설정 완료! 매일 아침 7시 오늘의 특가를 보내드릴게요 🔔");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "알림 설정 실패");
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <div className="empty">불러오는 중...</div>;

  // ---------- 비로그인 ----------
  if (!me.user) {
    return (
      <section className="section" style={{ maxWidth: 520, margin: "60px auto" }}>
        <div className="my-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>⭐</div>
          <h1 style={{ fontSize: 22, margin: "10px 0 6px" }}>출석체크 & 레벨</h1>
          <p style={{ color: "#55524d", fontSize: 14.5, marginTop: 0 }}>
            매일 출석 도장을 모아 레벨을 올려보세요.
            <br />
            구글 계정으로 3초 만에 시작할 수 있어요.
          </p>
          <a href="/api/auth/google" className="btn google-btn">
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/>
            </svg>
            구글로 시작하기
          </a>
          <p style={{ fontSize: 12, color: "#8a867f" }}>
            이메일은 출석 기록 용도로만 사용됩니다.
          </p>
        </div>

        <div className="my-card">
          <h2 style={{ fontSize: 16, marginTop: 0 }}>레벨 안내</h2>
          {LEVELS.map((l) => (
            <div key={l.level} className="level-row">
              <span>
                {l.emoji} Lv.{l.level} {l.name}
              </span>
              <span style={{ color: "#8a867f" }}>도장 {l.min}개</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ---------- 로그인 상태 ----------
  const total = me.stats?.total ?? 0;
  const progress = me.next
    ? Math.min(100, Math.round((total / me.next.min) * 100))
    : 100;

  return (
    <section className="section" style={{ maxWidth: 520, margin: "40px auto" }}>
      <div className="my-card" style={{ textAlign: "center" }}>
        {me.user.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.user.picture} alt="" className="avatar" referrerPolicy="no-referrer" />
        )}
        <h1 style={{ fontSize: 20, margin: "8px 0 2px" }}>{me.user.name}님</h1>
        <div className="level-badge">
          {me.level?.emoji} Lv.{me.level?.level} {me.level?.name}
        </div>

        <button
          className="btn stamp-btn"
          onClick={stamp}
          disabled={busy || me.stats?.todayDone}
        >
          {me.stats?.todayDone ? "✅ 오늘 출석 완료" : "📮 오늘 출석 도장 찍기"}
        </button>
        {msg && <p style={{ fontSize: 13.5, color: "#2b8a3e" }}>{msg}</p>}

        <div className="stat-mini">
          <div>
            <b>{total}</b>
            <span>총 도장</span>
          </div>
          <div>
            <b>{me.stats?.streak ?? 0}일</b>
            <span>연속 출석</span>
          </div>
        </div>

        {me.next && (
          <div style={{ marginTop: 14 }}>
            <div className="progress">
              <div className="bar" style={{ width: progress + "%" }} />
            </div>
            <p style={{ fontSize: 12.5, color: "#8a867f", margin: "6px 0 0" }}>
              다음 레벨 {me.next.emoji} {me.next.name}까지 도장{" "}
              {me.next.min - total}개 남음
            </p>
          </div>
        )}
      </div>

      <div className="my-card">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>🔔 특가 알림</h2>
        {pushState === "on" ? (
          <p style={{ fontSize: 14, color: "#2b8a3e", margin: 0 }}>
            알림 설정 완료 — 매일 아침 오늘의 특가와, 찜한 상품의 가격 인하
            소식을 보내드려요.
          </p>
        ) : pushState === "unsupported" ? (
          <p style={{ fontSize: 13.5, color: "#8a867f", margin: 0 }}>
            이 브라우저는 알림을 지원하지 않아요.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "#55524d", marginTop: 0 }}>
              매일 아침 7시, 새 특가가 올라오면 알려드려요.
            </p>
            <button className="btn secondary" onClick={enablePush} disabled={busy}>
              알림 켜기
            </button>
          </>
        )}
      </div>

      <p style={{ textAlign: "center" }}>
        <a href="/api/auth/signout" style={{ fontSize: 13, color: "#8a867f" }}>
          로그아웃
        </a>
      </p>
    </section>
  );
}
