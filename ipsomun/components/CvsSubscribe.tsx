import { TELEGRAM_CHANNEL_URL, withUtm } from "@/lib/util";

/** 편의점 행사는 매달 돌아오는 정보 — 다음 달 1일에 다시 오게 텔레그램 구독으로 묶는다 */
export default function CvsSubscribe({ place }: { place: string }) {
  return (
    <aside className="cvs-sub">
      <div>
        <strong>📣 다음 달 편의점 행사, 1일 아침에 받아보세요</strong>
        <span>버프·너프와 &lsquo;어디가 이득&rsquo;을 텔레그램 채널로 보내드려요. 광고 없이 한 달에 한 번.</span>
      </div>
      <a
        className="btn"
        href={withUtm(TELEGRAM_CHANNEL_URL, "site", "cta", `cvs-${place}`)}
        target="_blank"
        rel="noopener"
      >
        텔레그램 구독
      </a>
    </aside>
  );
}
