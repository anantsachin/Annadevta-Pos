// Local offline queue using localStorage.
// Queues order payloads when offline; flushes when connectivity returns.
import api from "./api";

const KEY = "pos_offline_orders";

export const offlineQueue = {
  list() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  },
  add(order) {
    const list = offlineQueue.list();
    list.push({ ...order, _queued_at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("pos-queue-changed"));
  },
  clear() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("pos-queue-changed"));
  },
  count() { return offlineQueue.list().length; },
  async sync() {
    const list = offlineQueue.list();
    if (!list.length) return { synced: 0 };
    try {
      const cleaned = list.map(({ _queued_at, ...rest }) => rest);
      const { data } = await api.post("/sync/orders", { orders: cleaned });
      offlineQueue.clear();
      return data;
    } catch (e) {
      return { error: e?.response?.data?.detail || e.message };
    }
  },
};
