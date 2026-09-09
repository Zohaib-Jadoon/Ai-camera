/** Coordinate refresh-token rotation without tying the algorithm to React or HTTP. */
export interface RefreshSession {
  user: { id: string };
  accessToken: string;
  refreshToken: string;
}

export class SessionChangedError extends Error {
  constructor() { super('The signed-in session changed'); }
}

export function createSessionRefresher<T extends RefreshSession>(options: {
  read: () => T | null;
  renew: (refreshToken: string) => Promise<T>;
  save: (session: T) => void;
  withLock: (work: () => Promise<T>) => Promise<T>;
}) {
  const pending = new Map<string, Promise<T>>();
  return (expectedToken: string, expectedUserId: string): Promise<T> => {
    const key = `${expectedUserId}:${expectedToken}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const promise = options.withLock(async () => {
      const previous = options.read();
      if (!previous || previous.user.id !== expectedUserId) throw new SessionChangedError();
      // A different request/tab may already have completed rotation under the lock.
      if (previous.accessToken !== expectedToken) return previous;
      const next = await options.renew(previous.refreshToken);
      const current = options.read();
      if (!current || current.user.id !== previous.user.id ||
          current.accessToken !== previous.accessToken || current.refreshToken !== previous.refreshToken ||
          next.user.id !== previous.user.id) {
        throw new SessionChangedError();
      }
      options.save(next);
      return next;
    });
    pending.set(key, promise);
    void promise.finally(() => { if (pending.get(key) === promise) pending.delete(key); }).catch(() => {});
    return promise;
  };
}
