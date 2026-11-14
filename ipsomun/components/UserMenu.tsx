"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Me {
  user: { name: string; picture: string } | null;
  stats?: { total: number; streak: number; todayDone: boolean };
  level?: { name: string; emoji: string };
}

export default function UserMenu() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null }));
  }, []);

  if (!me) return <span style={{ width: 60 }} />;

  if (!me.user) {
    return (
      <Link href="/my" className="user-chip" aria-label="출석체크">
        ⭐<span className="uc-txt"> 출석체크</span>
      </Link>
    );
  }

  return (
    <Link href="/my" className="user-chip on" aria-label={me.level?.name || "내 정보"}>
      {me.level?.emoji}<span className="uc-txt"> {me.level?.name}</span>
      {me.stats && !me.stats.todayDone && <span className="dot" />}
    </Link>
  );
}
