import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

// In-memory job store. For multi-instance production deployments replace with Redis.
const jobs = new Map<string, Job>();

// Simple concurrency-limited async queue (max 3 parallel AI jobs)
const MAX_CONCURRENT = 3;
let running = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSlot(): void {
  running--;
  const next = waitQueue.shift();
  if (next) {
    running++;
    next();
  }
}

/**
 * Enqueue an async task. Returns a jobId immediately; the task runs in the
 * background respecting the concurrency limit.
 */
export function enqueueJob(task: () => Promise<any>): string {
  const id = uuidv4();
  const job: Job = { id, status: 'pending', createdAt: new Date() };
  jobs.set(id, job);

  // Run without blocking the caller
  (async () => {
    await acquireSlot();
    job.status = 'running';
    job.startedAt = new Date();
    try {
      job.result = await task();
      job.status = 'done';
    } catch (err: any) {
      job.status = 'failed';
      job.error = err?.message ?? String(err);
    } finally {
      job.completedAt = new Date();
      releaseSlot();
      // Expire old jobs after 1 hour to avoid memory leaks
      setTimeout(() => jobs.delete(id), 60 * 60 * 1000);
    }
  })();

  return id;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
