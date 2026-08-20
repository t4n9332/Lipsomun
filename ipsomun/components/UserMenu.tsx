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
      <Link href="/my" className="user-chip">
        ⭐ 출석체크
      </Link>
    );
  }

  return (
    <Link href="/my" className="user-chip on">
      {me.level?.emoji} {me.level?.name}
      {me.stats && !me.stats.todayDone && <span className="dot" />}
    </Link>
  );
}
