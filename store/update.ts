import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isNetworkError } from "@/lib/network-error";
import { reportError } from "@/lib/report";
import { zustandStorage } from "@/lib/storage";
import { compareVersions } from "@/lib/version";
import {
  fetchUpdateManifest,
  getCurrentAppVersion,
  getCurrentChannel,
  summarizeUpdate,
  type LocalizedString,
  type Release,
  type ReleaseDownloadUrl,
  type UpdateLevel,
} from "@/services/update-config";

const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_INTERVAL_MS = 30 * 1000;
export const REQUIRED_MAX_DISMISS = 3;

type UpdateCheckResult =
  | { status: "success"; hasUpdate: boolean }
  | { status: "failed" }
  | { status: "skipped" };

let pendingCheck: Promise<UpdateCheckResult> | null = null;

interface UpdateStore {
  channel: string | null;
  hasUpdate: boolean;
  level: UpdateLevel;
  latestVersion: string | null;
  applicableReleases: Release[];
  reason: LocalizedString | null;
  downloadUrl: ReleaseDownloadUrl | null;
  blockedByMinVersion: boolean;
  blockedByDeparted: boolean;
  isRollout: boolean;

  dismissedRecommendedVersions: string[];
  requiredDismissCounts: Record<string, number>;

  checking: boolean;
  checkedAt: number | null;
  attemptedAt: number | null;

  modalOpen: boolean;

  check: (options?: { force?: boolean }) => Promise<UpdateCheckResult>;
  openModal: () => void;
  closeModal: () => void;
}

export const useUpdateStore = create<UpdateStore>()(
  persist(
    (set, get) => ({
      channel: null,
      hasUpdate: false,
      level: "silent",
      latestVersion: null,
      applicableReleases: [],
      reason: null,
      downloadUrl: null,
      blockedByMinVersion: false,
      blockedByDeparted: false,
      isRollout: false,

      dismissedRecommendedVersions: [],
      requiredDismissCounts: {},

      checking: false,
      checkedAt: null,
      attemptedAt: null,
      modalOpen: false,

      openModal: () => set({ modalOpen: true }),
      closeModal: () => {
        const {
          level,
          latestVersion,
          requiredDismissCounts,
          dismissedRecommendedVersions,
        } = get();
        if (!latestVersion) {
          set({ modalOpen: false });
          return;
        }
        if (level === "required") {
          const current = requiredDismissCounts[latestVersion] ?? 0;
          if (current < REQUIRED_MAX_DISMISS) {
            set({
              requiredDismissCounts: {
                ...requiredDismissCounts,
                [latestVersion]: current + 1,
              },
              modalOpen: false,
            });
          }
          return;
        }
        if (level === "recommended") {
          set({
            dismissedRecommendedVersions: dismissedRecommendedVersions.includes(
              latestVersion,
            )
              ? dismissedRecommendedVersions
              : [...dismissedRecommendedVersions, latestVersion],
            modalOpen: false,
          });
          return;
        }
        set({ modalOpen: false });
      },

      check: (options) => {
        if (pendingCheck) return pendingCheck;
        const checkedAt = get().checkedAt;
        const attemptedAt = get().attemptedAt;
        if (
          !options?.force &&
          ((checkedAt !== null &&
            Date.now() - checkedAt < MIN_CHECK_INTERVAL_MS) ||
            (attemptedAt !== null &&
              Date.now() - attemptedAt < RETRY_INTERVAL_MS))
        ) {
          return Promise.resolve({ status: "skipped" });
        }
        set({ checking: true, attemptedAt: Date.now() });
        pendingCheck = (async (): Promise<UpdateCheckResult> => {
          try {
            const manifest = await fetchUpdateManifest();
            if (!manifest) return { status: "failed" };
            const currentVersion = getCurrentAppVersion();
            const summary = summarizeUpdate(
              manifest,
              getCurrentChannel(),
              currentVersion,
            );

            const prev = get();
            const dismissedRecommendedVersions =
              prev.dismissedRecommendedVersions.filter(
                (version) => compareVersions(version, currentVersion) > 0,
              );
            const requiredDismissCounts = Object.fromEntries(
              Object.entries(prev.requiredDismissCounts).filter(
                ([version]) => compareVersions(version, currentVersion) > 0,
              ),
            );

            const autoOpen =
              summary.hasUpdate &&
              (summary.level === "required" ||
                (summary.level === "recommended" &&
                  !dismissedRecommendedVersions.includes(
                    summary.latestVersion!,
                  )));

            set({
              channel: summary.channel,
              hasUpdate: summary.hasUpdate,
              level: summary.level,
              latestVersion: summary.latestVersion,
              applicableReleases: summary.applicableReleases,
              reason: summary.reason,
              downloadUrl: summary.downloadUrl,
              blockedByMinVersion: summary.blockedByMinVersion,
              blockedByDeparted: summary.blockedByDeparted,
              isRollout: summary.isRollout,
              dismissedRecommendedVersions,
              requiredDismissCounts,
              checkedAt: Date.now(),
              modalOpen: summary.hasUpdate && (autoOpen || prev.modalOpen),
            });
            return { status: "success", hasUpdate: summary.hasUpdate };
          } catch (e) {
            if (!isNetworkError(e)) {
              reportError(e, { module: "update" });
            }
            return { status: "failed" };
          } finally {
            set({ checking: false });
          }
        })().finally(() => {
          pendingCheck = null;
        });
        return pendingCheck;
      },
    }),
    {
      name: "update",
      storage: zustandStorage,
      partialize: (s) => ({
        dismissedRecommendedVersions: s.dismissedRecommendedVersions,
        requiredDismissCounts: s.requiredDismissCounts,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | (Partial<UpdateStore> & {
              dismissedRecommendedVersion?: string;
              requiredDismiss?: { version: string; count: number };
            })
          | undefined;
        const validVersion = (value: unknown): value is string =>
          typeof value === "string" && /^\d+(\.\d+){0,2}$/.test(value);
        const dismissedRecommendedVersions = Array.isArray(
          saved?.dismissedRecommendedVersions,
        )
          ? saved.dismissedRecommendedVersions.filter(validVersion)
          : validVersion(saved?.dismissedRecommendedVersion)
            ? [saved.dismissedRecommendedVersion]
            : [];
        const counts = saved?.requiredDismissCounts;
        const requiredDismissCounts =
          counts && typeof counts === "object" && !Array.isArray(counts)
            ? Object.fromEntries(
                Object.entries(counts).filter(
                  ([version, count]) =>
                    validVersion(version) &&
                    Number.isInteger(count) &&
                    count >= 0,
                ),
              )
            : {};
        if (
          validVersion(saved?.requiredDismiss?.version) &&
          Number.isInteger(saved.requiredDismiss.count) &&
          saved.requiredDismiss.count >= 0
        ) {
          requiredDismissCounts[saved.requiredDismiss.version] =
            saved.requiredDismiss.count;
        }
        return {
          ...current,
          dismissedRecommendedVersions,
          requiredDismissCounts,
        };
      },
    },
  ),
);
