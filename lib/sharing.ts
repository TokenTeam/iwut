import * as Sharing from "expo-sharing";

let pendingShare: Promise<void> = Promise.resolve();

export function shareFileAsync(
  url: string,
  options?: Sharing.SharingOptions,
): Promise<void> {
  const share = pendingShare.then(() => Sharing.shareAsync(url, options));
  // 分享失败后仍允许后续请求执行
  pendingShare = share.catch(() => {});
  return share;
}
