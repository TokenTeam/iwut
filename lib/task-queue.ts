/**
 * 创建一个串行任务队列，同一队列上的任务严格按入队顺序执行，
 * 用于防止"删除-重建"类异步流程被并发调用交错破坏。
 */
export function createTaskQueue(): <T>(task: () => Promise<T>) => Promise<T> {
  let chain: Promise<unknown> = Promise.resolve();

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = chain.then(task);
    // 失败不阻塞后续任务；错误仍由 next 的调用方处理
    chain = next.catch(() => {});
    return next;
  };
}
