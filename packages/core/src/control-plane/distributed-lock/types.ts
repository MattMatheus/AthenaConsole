export interface DistributedLockAcquireRequest {
  lockName: string;
  ownerId: string;
  leaseMs: number;
}

export interface DistributedLockReleaseRequest {
  lockName: string;
  ownerId: string;
  token: string;
}

export type DistributedLockAcquireResult =
  | {
      acquired: true;
      lockName: string;
      ownerId: string;
      token: string;
      acquiredAt: string;
      expiresAt: string;
    }
  | {
      acquired: false;
    };

export interface IDistributedLock {
  tryAcquire(request: DistributedLockAcquireRequest): Promise<DistributedLockAcquireResult>;
  release(request: DistributedLockReleaseRequest): Promise<void>;
}
