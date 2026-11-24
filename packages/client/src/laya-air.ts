export const LAYA_AIR_VERSION = '3.3.0';

/** LayaAir IDE接入时先校验引擎版本，避免静默混用引擎API。 */
export function assertLayaAirVersion(actualVersion: string): void {
  if (actualVersion !== LAYA_AIR_VERSION) {
    throw new Error(`LayaAir版本不一致：要求${LAYA_AIR_VERSION}，实际${actualVersion}`);
  }
}
