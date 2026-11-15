// Wait for each response before starting the next polling delay. A slow request
// must not be superseded forever by the timer that is meant to refresh it.
export function pollWhileVisible(refresh: () => Promise<void>, interval: number) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function poll(initial = false) {
    if (stopped) return;
    if (initial || document.visibilityState === "visible") await refresh();
    if (!stopped && interval > 0)
      timer = setTimeout(() => void poll(), interval);
  }
  void poll(true);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
