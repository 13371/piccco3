/**
 * 重试队列管理器
 * 实现退避策略：第1次5秒，第2次15秒，第3次60秒
 */
interface RetryTask {
  id: string;
  task: () => Promise<void>;
  retryCount: number;
  maxRetries: number;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
}

class RetryQueue {
  private queue: Map<string, RetryTask> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private isProcessing = false;

  /**
   * 计算退避延迟时间（秒）
   * 第1次：5秒，第2次：15秒，第3次：60秒
   */
  private getBackoffDelay(retryCount: number): number {
    if (retryCount === 1) return 5000; // 5秒
    if (retryCount === 2) return 15000; // 15秒
    if (retryCount >= 3) return 60000; // 60秒
    return 5000;
  }

  /**
   * 添加重试任务
   */
  add(
    id: string,
    task: () => Promise<void>,
    options: {
      maxRetries?: number;
      onSuccess?: () => void;
      onFailure?: (error: Error) => void;
    } = {}
  ): void {
    const { maxRetries = 3, onSuccess, onFailure } = options;

    // 如果任务已存在，取消之前的重试
    this.cancel(id);

    const retryTask: RetryTask = {
      id,
      task,
      retryCount: 0,
      maxRetries,
      onSuccess,
      onFailure,
    };

    this.queue.set(id, retryTask);
    this.scheduleRetry(id);
  }

  /**
   * 安排重试
   */
  private scheduleRetry(id: string): void {
    const task = this.queue.get(id);
    if (!task) return;

    const delay = this.getBackoffDelay(task.retryCount);
    
    const timer = setTimeout(async () => {
      this.timers.delete(id);
      
      try {
        await task.task();
        // 成功，移除任务
        this.queue.delete(id);
        task.onSuccess?.();
      } catch (error) {
        task.retryCount++;
        
        if (task.retryCount > task.maxRetries) {
          // 超过最大重试次数，移除任务并通知失败
          this.queue.delete(id);
          const err = error instanceof Error ? error : new Error(String(error));
          task.onFailure?.(err);
          console.error(`[RetryQueue] 任务 ${id} 重试失败，已达最大重试次数`);
        } else {
          // 继续重试
          this.scheduleRetry(id);
        }
      }
    }, delay);

    this.timers.set(id, timer);
    
    if (task.retryCount > 0) {
      console.log(`[RetryQueue] 任务 ${id} 将在 ${delay / 1000} 秒后重试（第 ${task.retryCount} 次）`);
    }
  }

  /**
   * 取消重试任务
   */
  cancel(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.queue.delete(id);
  }

  /**
   * 清空所有重试任务
   */
  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.queue.clear();
  }

  /**
   * 获取队列状态
   */
  getStatus(): { pending: number; retrying: string[] } {
    return {
      pending: this.queue.size,
      retrying: Array.from(this.queue.keys()),
    };
  }
}

// 导出单例
export const retryQueue = new RetryQueue();



