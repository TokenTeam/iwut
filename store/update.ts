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

  dismissedRecommendedVersion: string | null;
  requiredDismiss: RequiredDismissState | null;

  checking: boolean;
  checkedAt: number | null;

  modalOpen: boolean;

  check: (options?: { force?: boolean }) => Promise<void>;
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

      dismissedRecommendedVersion: null,
      requiredDismiss: null,

      checking: false,
      checkedAt: null,
      modalOpen: false,

      openModal: () => set({ modalOpen: true }),
      closeModal: () => {
        const { level, latestVersion, requiredDismiss, blockedByMinVersion } =
          get();
        if (!latestVersion) {
          set({ modalOpen: false });
          return;
        }
        if (level === "required" && !blockedByMinVersion) {
          // Soft-required: bump the dismiss counter. The modal component
          // derives `remaining`/`hardBlock` from this on the next render and
          // hides the close affordance once REQUIRED_MAX_DISMISS is hit.
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
          // hardBlock case: ignore close — UI shouldn't even render a close
          // affordance, but guard here defensively.
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

      check: async (options) => {
        if (get().checking) return;
        const checkedAt = get().checkedAt;
        if (
          !options?.force &&
          checkedAt !== null &&
          Date.now() - checkedAt < MIN_CHECK_INTERVAL_MS
        ) {
          return;
        }
        set({ checking: true });
        try {
          const manifest = await fetchUpdateManifest();
          const summary = summarizeUpdate(
            manifest,
            getCurrentChannel(),
            getCurrentAppVersion(),
          );

          const prev = get();
          // Reset dismiss state when the targeted version changes; otherwise
          // a "稍后再说" tap on v1.4.0 would silence v1.5.0 too.
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

          // Auto-open the modal for recommended/required, except when the
          // user has already dismissed *this* recommended version. required
          // always reopens (each launch counts as a chance until exhausted).
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
            dismissedRecommendedVersion,
            requiredDismiss,
            checkedAt: Date.now(),
            modalOpen: autoOpen || prev.modalOpen,
          });
        } catch (e) {
          if (!isNetworkError(e)) {
            reportError(e, { module: "update" });
          }
        } finally {
          set({ checking: false });
        }
      },
    }),
    {
      name: "update",
      storage: zustandStorage,
      partialize: (s) => ({
        // NOTE: checkedAt is intentionally *not* persisted. It's an in-process
        // throttle for foreground/background loops; persisting it would mean a
        // cold start within 5 min of any previous check (even a 404) silently
        // skips the fetch and leaves the user staring at stale state.
        hasUpdate: s.hasUpdate,
        level: s.level,
        latestVersion: s.latestVersion,
        applicableReleases: s.applicableReleases,
        reason: s.reason,
        downloadUrl: s.downloadUrl,
        blockedByMinVersion: s.blockedByMinVersion,
        dismissedRecommendedVersion: s.dismissedRecommendedVersion,
        requiredDismiss: s.requiredDismiss,
      }),
    },
  ),
);
