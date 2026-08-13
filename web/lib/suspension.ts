export type DurationLabel = "1h" | "3h" | "1d" | "3d" | "7d" | "permanent";

/** 영구 정지는 이 값을 그대로 저장한다 — `suspended_until > now()` 하나로 정지
 * 여부를 판정하기 위해 별도 boolean 컬럼을 두지 않는다. */
export const PERMANENT_SUSPENSION_UNTIL = new Date("9999-12-31T23:59:59Z");

const DURATION_MS: Record<Exclude<DurationLabel, "permanent">, number> = {
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function durationToSuspendedUntil(label: DurationLabel, now: Date = new Date()): Date {
  if (label === "permanent") return PERMANENT_SUSPENSION_UNTIL;
  return new Date(now.getTime() + DURATION_MS[label]);
}

export function isValidDurationLabel(v: unknown): v is DurationLabel {
  return v === "1h" || v === "3h" || v === "1d" || v === "3d" || v === "7d" || v === "permanent";
}

export function isPermanentSuspension(until: Date): boolean {
  return until.getTime() === PERMANENT_SUSPENSION_UNTIL.getTime();
}

export function isSuspensionActive(until: Date | null): boolean {
  return until !== null && until.getTime() > Date.now();
}
