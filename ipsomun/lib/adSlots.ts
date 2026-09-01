/**
 * 애드센스 광고 슬롯 ID를 한 곳에 모은 파일.
 *
 * 왜 따로 빼는가: 슬롯을 페이지마다 하드코딩해두면 "어느 계산기가 버는지"를 보려고
 * 슬롯을 나눌 때 파일을 전부 뒤져야 한다. 계산기별로 슬롯을 따로 파는 것이 목적이다 —
 * 그래야 다음에 뭘 만들지 애드센스 보고서가 알려준다. 슬롯 하나로 묶어두면
 * 그 정보가 통째로 사라진다.
 *
 * ⚠️ 아직 애드센스에서 광고 단위를 만들지 않아 전부 PLACEHOLDER 다.
 * PLACEHOLDER 인 항목은 AdSlot 이 아예 렌더하지 않는다 — 존재하지 않는 슬롯 ID로
 * <ins> 를 그려봐야 광고는 안 채워지고 빈 자리만 남기 때문이다.
 *
 * 채우는 순서:
 *   애드센스 → 광고 → 광고 단위 기준 → 디스플레이 광고 → 이름을 슬러그와 같게 만들고
 *   생성 → data-ad-slot 숫자를 아래 해당 줄에 붙여넣기.
 */

/** 아직 슬롯을 만들지 않았다는 표시. 이 값이면 광고를 렌더하지 않는다. */
export const AD_SLOT_PLACEHOLDER = "1234567890";

/** 계산기 슬러그 → 슬롯 ID */
export const CALC_AD_SLOTS: Record<string, string> = {
  대출갈아타기: AD_SLOT_PLACEHOLDER,
  연봉실수령액: AD_SLOT_PLACEHOLDER,
  퇴직금: AD_SLOT_PLACEHOLDER,
  실업급여: AD_SLOT_PLACEHOLDER,
  연차수당: AD_SLOT_PLACEHOLDER,
  연금저축IRP세액공제: AD_SLOT_PLACEHOLDER,
  연말정산환급금: AD_SLOT_PLACEHOLDER,
  종합소득세: AD_SLOT_PLACEHOLDER,
};

/** 파일 도구 슬러그 → 슬롯 ID */
export const TOOL_AD_SLOTS: Record<string, string> = {
  PDF합치기: AD_SLOT_PLACEHOLDER,
};

export const calcAdSlot = (slug: string) =>
  CALC_AD_SLOTS[slug] ?? AD_SLOT_PLACEHOLDER;

export const toolAdSlot = (slug: string) =>
  TOOL_AD_SLOTS[slug] ?? AD_SLOT_PLACEHOLDER;

/** 슬롯이 아직 준비되지 않았는지 */
export const isPlaceholderSlot = (slot: string) =>
  !slot || slot === AD_SLOT_PLACEHOLDER;
