/**
 * 同步队列 - 确保同步操作串行执行，避免并发冲突
 */
class SyncQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  
  /**
   * 添加同步任务到队列
   */
  async add(task: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await task();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      this.process();
    });
  }
  
  /**
   * 处理队列中的任务
   */
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (e) {
          console.error('[syncQueue] 任务执行失败:', e);
        }
      }
    }
    
    this.processing = false;
  }
  
  /**
   * 清空队列
   */
  clear() {
    this.queue = [];
  }
  
  /**
   * 获取队列长度
   */
  get length() {
    return this.queue.length;
  }
  
  /**
   * 检查是否正在处理
   */
  get isProcessing() {
    return this.processing;
  }
}

// 导出单例
export const syncQueue = new SyncQueue();



