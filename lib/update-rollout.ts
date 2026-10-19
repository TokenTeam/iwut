export interface Rollout {
  percentage: number;
  seed: string;
}

export function getRolloutBucket(seed: string, deviceId: string): number {
  const key = JSON.stringify([seed, deviceId]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193);
  }
  return (hash >>> 0) % 10000;
}

export function isInRollout(
  rollout: Rollout | null | undefined,
  deviceId: string | null,
): boolean {
  if (!rollout || rollout.percentage === 100) return true;
  if (rollout.percentage === 0 || !deviceId) return false;
  return getRolloutBucket(rollout.seed, deviceId) < rollout.percentage * 100;
}
