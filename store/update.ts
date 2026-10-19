import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isNetworkError } from "@/lib/network-error";
import { reportError } from "@/lib/report";
import { zustandStorage } from "@/lib/storage";
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
export const REQUIRED_MAX_DISMISS = 3;

type UpdateCheckResult =
  | { status: "success"; hasUpdate: boolean }
  | { status: "failed" }
  | { status: "skipped" };

let pendingCheck: Promise<UpdateCheckResult> | null = null;

interface RequiredDismissState {
  version: string;
  count: number;
}

interface UpdateStore {
  hasUpdate: boolean;
  level: UpdateLevel;
  latestVersion: string | null;
  applicableReleases: Release[];
  reason: LocalizedString | null;
  downloadUrl: ReleaseDownloadUrl | null;
  blockedByMinVersion: boolean;
  blockedByDeparted: boolean;
  isRollout: boolean;

  dismissedRecommendedVersion: string | null;
  requiredDismiss: RequiredDismissState | null;

  checking: boolean;
  checkedAt: number | null;

  modalOpen: boolean;

  check: (options?: { force?: boolean }) => Promise<UpdateCheckResult>;
  openModal: () => void;
  closeModal: () => void;
}

export const useUpdateStore = create<UpdateStore>()(
  persist(
    (set, get) => ({
      hasUpdate: false,
      level: "silent",
      latestVersion: null,
      applicableReleases: [],
      reason: null,
      downloadUrl: null,
      blockedByMinVersion: false,
      blockedByDeparted: false,
      isRollout: false,

      dismissedRecommendedVersion: null,
      requiredDismiss: null,

      checking: false,
      checkedAt: null,
      modalOpen: false,

      openModal: () => set({ modalOpen: true }),
      closeModal: () => {
        const { level, latestVersion, requiredDismiss } = get();
        if (!latestVersion) {
          set({ modalOpen: false });
          return;
        }
        if (level === "required") {
          const current =
            requiredDismiss && requiredDismiss.version === latestVersion
              ? requiredDismiss.count
              : 0;
          if (current < REQUIRED_MAX_DISMISS) {
            set({
              requiredDismiss: {
                version: latestVersion,
                count: current + 1,
              },
              modalOpen: false,
            });
          }
          return;
        }
        if (level === "recommended") {
          set({
            dismissedRecommendedVersion: latestVersion,
            modalOpen: false,
          });
          return;
        }
        set({ modalOpen: false });
      },

      check: (options) => {
        if (pendingCheck) return pendingCheck;
        const checkedAt = get().checkedAt;
        if (
          !options?.force &&
          checkedAt !== null &&
          Date.now() - checkedAt < MIN_CHECK_INTERVAL_MS
        ) {
          return Promise.resolve({ status: "skipped" });
        }
        set({ checking: true });
        pendingCheck = (async (): Promise<UpdateCheckResult> => {
          try {
            const manifest = await fetchUpdateManifest();
            if (!manifest) return { status: "failed" };
            const summary = summarizeUpdate(
              manifest,
              getCurrentChannel(),
              getCurrentAppVersion(),
            );

            const prev = get();
            const dismissedRecommendedVersion =
              summary.latestVersion &&
              prev.dismissedRecommendedVersion === summary.latestVersion
                ? prev.dismissedRecommendedVersion
                : null;
            const requiredDismiss =
              summary.latestVersion &&
              prev.requiredDismiss?.version === summary.latestVersion
                ? prev.requiredDismiss
                : null;

            const autoOpen =
              summary.hasUpdate &&
              (summary.level === "required" ||
                (summary.level === "recommended" &&
                  dismissedRecommendedVersion !== summary.latestVersion));

            set({
              hasUpdate: summary.hasUpdate,
              level: summary.level,
              latestVersion: summary.latestVersion,
              applicableReleases: summary.applicableReleases,
              reason: summary.reason,
              downloadUrl: summary.downloadUrl,
              blockedByMinVersion: summary.blockedByMinVersion,
              blockedByDeparted: summary.blockedByDeparted,
              isRollout: summary.isRollout,
              dismissedRecommendedVersion,
              requiredDismiss,
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
        // 仅持久化用户操作
        dismissedRecommendedVersion: s.dismissedRecommendedVersion,
        requiredDismiss: s.requiredDismiss,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<UpdateStore> | undefined;
        return {
          ...current,
          dismissedRecommendedVersion:
            typeof saved?.dismissedRecommendedVersion === "string"
              ? saved.dismissedRecommendedVersion
              : null,
          requiredDismiss:
            saved?.requiredDismiss &&
            typeof saved.requiredDismiss.version === "string" &&
            Number.isInteger(saved.requiredDismiss.count) &&
            saved.requiredDismiss.count >= 0
              ? saved.requiredDismiss
              : null,
        };
      },
    },
  ),
);
