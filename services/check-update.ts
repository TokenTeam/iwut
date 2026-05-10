import Constants from "expo-constants";

const version = Constants.expoConfig?.version;

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkUpdate(): Promise<{
  hasUpdate: boolean;
  latestVersion: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const { version: latestVersion } = await fetch(
      "https://cdn.jsdmirror.com/cnb/TokenTeam/iwut@main/package.json",
      { signal: controller.signal },
    ).then((res) => res.json());

    return {
      hasUpdate: compareVersions(latestVersion, version ?? "0.0.0") > 0,
      latestVersion,
    };
  } catch (err) {
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      err instanceof TypeError
    ) {
      return { hasUpdate: false, latestVersion: version ?? "0.0.0" };
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}
