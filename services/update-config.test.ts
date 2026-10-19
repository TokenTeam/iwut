import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { getRolloutBucket } from "@/lib/update-rollout";

mock.module("expo-application", () => ({
  nativeApplicationVersion: "0.3.26",
  getAndroidId: () => "test-device",
}));
mock.module("expo-updates", () => ({ channel: "preview" }));
mock.module("react-native", () => ({ Platform: { OS: "android" } }));

let stored: unknown = null;
mock.module("@/lib/storage", () => ({
  zustandStorage: {
    getItem: () => stored,
    setItem: (_name: string, value: unknown) => {
      stored = value;
    },
    removeItem: () => {
      stored = null;
    },
  },
}));
mock.module("@/lib/report", () => ({ reportError: () => {} }));

const { parseUpdateManifest, summarizeUpdate } =
  await import("./update-config");
const { useUpdateStore: store } = await import("@/store/update");

const context = {
  platform: "android" as const,
  deviceId: "test-device",
  now: Date.parse("2026-10-19T00:00:00Z"),
};
const rollout = {
  android: {
    percentage: (getRolloutBucket("release", context.deviceId) + 1) / 100,
    seed: "release",
  },
};

function release(version: string, fields: Record<string, unknown> = {}) {
  return { version, level: "recommended", ...fields };
}

function config(
  releases: Record<string, unknown>[],
  fields: Record<string, unknown> = {},
) {
  return {
    version: 1,
    channels: {
      production: { latestVersion: "0.3.29", releases, ...fields },
    },
  };
}

function summarize(raw: unknown, platform = context.platform) {
  return summarizeUpdate(parseUpdateManifest(raw), "preview", "0.3.26", {
    ...context,
    platform,
  });
}

describe("update configuration", () => {
  test("falls back to a full target when rollout inherits required level", () => {
    const summary = summarize(
      config([
        release("0.3.27", { level: "required", reason: "Upgrade" }),
        release("0.3.28", { rollout }),
      ]),
    );
    expect(summary.latestVersion).toBe("0.3.27");
    expect(summary.level).toBe("required");
    expect(summary.isRollout).toBe(false);
  });

  test("allows partial updates after the required version is installed", () => {
    const summary = summarizeUpdate(
      parseUpdateManifest(
        config([
          release("0.3.27", { level: "required", reason: "Upgrade" }),
          release("0.3.28", { rollout }),
        ]),
      ),
      "production",
      "0.3.27",
      context,
    );
    expect(summary.latestVersion).toBe("0.3.28");
    expect(summary.level).toBe("recommended");
    expect(summary.isRollout).toBe(true);
  });

  test("minimum support and departed versions use full targets", () => {
    for (const raw of [
      config([release("0.3.27"), release("0.3.28", { rollout })], {
        minSupportedVersion: "0.3.27",
      }),
      config([
        release("0.3.26", { departed: true }),
        release("0.3.27"),
        release("0.3.28", { rollout }),
      ]),
    ]) {
      const summary = summarize(raw);
      expect(summary.latestVersion).toBe("0.3.27");
      expect(summary.level).toBe("required");
      expect(summary.isRollout).toBe(false);
    }
  });

  test("keeps the resolved channel and target download URL", () => {
    const downloadUrl = { android: "https://example.com/production.apk" };
    const summary = summarize(config([release("0.3.27", { downloadUrl })]));
    expect(summary.channel).toBe("production");
    expect(summary.downloadUrl?.android).toBe(downloadUrl.android);
    const raw = config([release("0.3.27")]);
    const preview = {
      ...raw,
      channels: { preview: raw.channels.production },
    };
    expect(summarize(preview).channel).toBe("preview");
  });

  test("keeps intermediate logs without inheriting excluded policy", () => {
    const summary = summarize(
      config([
        release("0.3.27", {
          rollout: { android: { percentage: 0, seed: "release" } },
          changelog: "Changes",
        }),
        release("0.3.28", { level: "silent" }),
      ]),
    );
    expect(summary.level).toBe("silent");
    expect(summary.applicableReleases).toHaveLength(2);
    expect(summary.applicableReleases[0]).not.toHaveProperty("rollout");
  });

  test.each([
    "",
    "invalid-date",
    "2026-02-30T00:00:00Z",
    "2026-10-19",
    "2026-10-19T25:00:00Z",
    "2026-10-19T00:00:00+08:00",
    123,
  ])("rejects invalid release date %s", (releasedAt) => {
    expect(
      parseUpdateManifest(config([release("0.3.27", { releasedAt })])),
    ).toBeNull();
  });

  test.each([
    undefined,
    null,
    "2026-10-19T00:00:00Z",
    "2026-10-19T00:00:00.1Z",
  ])("accepts optional or valid UTC release date %s", (releasedAt) => {
    expect(
      parseUpdateManifest(config([release("0.3.27", { releasedAt })])),
    ).not.toBeNull();
  });

  test("does not select future releases", () => {
    expect(
      summarize(
        config([release("0.3.27", { releasedAt: "2026-10-20T00:00:00Z" })]),
      ).hasUpdate,
    ).toBe(false);
  });

  test.each(["", "invalid", "0.3.x", 123])(
    "rejects invalid minimum version %s",
    (minSupportedVersion) => {
      expect(
        parseUpdateManifest(config([], { minSupportedVersion })),
      ).toBeNull();
    },
  );

  test.each([undefined, null, "0.3.27"])(
    "accepts optional or valid minimum version %s",
    (minSupportedVersion) => {
      expect(
        parseUpdateManifest(config([], { minSupportedVersion })),
      ).not.toBeNull();
    },
  );
});

describe("update user state", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    stored = null;
    store.setState(store.getInitialState(), true);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    store.setState(store.getInitialState(), true);
  });

  async function check(raw: unknown) {
    globalThis.fetch = Object.assign(async () => Response.json(raw), {
      preconnect: originalFetch.preconnect,
    });
    return store.getState().check({ force: true });
  }

  test("preserves dismissal across pause and resume", async () => {
    const active = config([release("0.3.27")]);
    await check(active);
    store.getState().closeModal();
    await check(
      config([
        release("0.3.27", {
          rollout: { android: { percentage: 0, seed: "release" } },
        }),
      ]),
    );
    expect(store.getState().dismissedRecommendedVersions).toEqual(["0.3.27"]);
    expect(store.getState().modalOpen).toBe(false);
    await check(active);
    expect(store.getState().modalOpen).toBe(false);
  });

  test("preserves dismissals for both targets across fallback", async () => {
    await check(config([release("0.3.28")]));
    store.getState().closeModal();
    await check(config([release("0.3.27")]));
    store.getState().closeModal();
    await check(config([release("0.3.28")]));
    expect(store.getState().modalOpen).toBe(false);
    expect(store.getState().dismissedRecommendedVersions).toEqual([
      "0.3.28",
      "0.3.27",
    ]);
  });

  test("preserves required counts across missing targets and fallback", async () => {
    const required = (version: string) =>
      release(version, { level: "required", reason: "Upgrade" });
    await check(config([required("0.3.28")]));
    store.getState().closeModal();
    await check(config([]));
    await check(config([required("0.3.27")]));
    store.getState().closeModal();
    await check(config([required("0.3.28")]));
    expect(store.getState().requiredDismissCounts).toEqual({
      "0.3.28": 1,
      "0.3.27": 1,
    });
    store.getState().closeModal();
    expect(store.getState().requiredDismissCounts["0.3.28"]).toBe(2);
  });

  test("cleans up only installed versions", async () => {
    store.setState({
      dismissedRecommendedVersions: ["0.3.25", "0.3.26", "0.3.27"],
      requiredDismissCounts: { "0.3.25": 1, "0.3.26": 2, "0.3.27": 3 },
    });
    await check(config([]));
    expect(store.getState().dismissedRecommendedVersions).toEqual(["0.3.27"]);
    expect(store.getState().requiredDismissCounts).toEqual({ "0.3.27": 3 });
  });

  test("invalid configuration preserves the last valid state", async () => {
    await check(config([release("0.3.27")]));
    store.getState().closeModal();
    expect(
      await check(config([release("0.3.28", { releasedAt: "invalid" })])),
    ).toEqual({ status: "failed" });
    expect(store.getState().latestVersion).toBe("0.3.27");
    expect(store.getState().dismissedRecommendedVersions).toEqual(["0.3.27"]);
  });

  test("migrates legacy user state without restoring update data", async () => {
    stored = {
      state: {
        hasUpdate: true,
        latestVersion: "0.3.29",
        dismissedRecommendedVersion: "0.3.27",
        requiredDismiss: { version: "0.3.28", count: 2 },
      },
      version: 0,
    };
    await store.persist.rehydrate();
    expect(store.getState().hasUpdate).toBe(false);
    expect(store.getState().latestVersion).toBeNull();
    expect(store.getState().dismissedRecommendedVersions).toEqual(["0.3.27"]);
    expect(store.getState().requiredDismissCounts).toEqual({ "0.3.28": 2 });
    store.getState().openModal();
    expect(Object.keys((stored as { state: object }).state).sort()).toEqual([
      "dismissedRecommendedVersions",
      "requiredDismissCounts",
    ]);
  });
});
