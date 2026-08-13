const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 사용자에게 보여줄 날짜(YYYY-MM-DD)를 한국 시간대로 찍는다.
 *
 * 서버는 UTC로 돈다. 그대로 toISOString()하면 한국 시각으로 저녁 9시 이후에
 * 계산된 날짜가 하루 뒤로 밀려, "언제부터 가능하다"는 안내가 실제와 어긋난다.
 */
export function kstDate(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
