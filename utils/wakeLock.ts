// Keeps the screen awake while the show is on air, so the browser doesn't
// throttle/suspend the tab between songs. The Screen Wake Lock API releases the
// lock automatically when the tab is hidden, so we re-acquire on visibility
// change. All no-ops where the API is unsupported.

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

export class WakeLock {
  private sentinel: WakeLockSentinelLike | null = null;
  private active = false;
  private readonly onVisibility = () => {
    if (this.active && document.visibilityState === 'visible') void this.acquire();
  };

  /** Request the lock and keep it across tab-visibility changes. */
  async enable(): Promise<void> {
    this.active = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  /** Release the lock and stop re-acquiring it. */
  async disable(): Promise<void> {
    this.active = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    try {
      await this.sentinel?.release();
    } catch {
      // ignore
    }
    this.sentinel = null;
  }

  private async acquire(): Promise<void> {
    const nav = navigator as Navigator & WakeLockNavigator;
    if (!nav.wakeLock || (this.sentinel && !this.sentinel.released)) return;
    try {
      this.sentinel = await nav.wakeLock.request('screen');
    } catch {
      // user/agent denied — non-fatal, the show still runs while focused
    }
  }
}
