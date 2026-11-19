// progress.js — save / load in localStorage: cash, jobs done, best stats.
// The game never requires a save to play; loading is a convenience.
const KEY = 'verde-heat-save-v1';

export function createProgress() {
  const progress = {
    cash: 0,
    jobsDone: 0,
    bestCash: 0,
    plays: 0,

    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        this.cash = data.cash || 0;
        this.jobsDone = data.jobsDone || 0;
        this.bestCash = data.bestCash || 0;
        this.plays = data.plays || 0;
        return true;
      } catch {
        return false;
      }
    },

    save(S) {
      try {
        this.bestCash = Math.max(this.bestCash, S.jobs.cash);
        this.jobsDone = S.jobs.done;
        this.cash = S.jobs.cash;
        window.localStorage.setItem(KEY, JSON.stringify({
          cash: this.cash,
          jobsDone: this.jobsDone,
          bestCash: this.bestCash,
          plays: this.plays,
        }));
      } catch {
        // Storage unavailable (private mode): play on without saving.
      }
    },

    wipe() {
      try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
      this.cash = 0;
      this.jobsDone = 0;
      this.bestCash = 0;
    },
  };
  return progress;
}
