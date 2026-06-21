import { useCallback, useMemo, useState } from "react";

// Cart state + memoized totals + line operations.
export function useCart() {
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);

  const addLine = useCallback((line) => {
    setCart((c) => {
      if (!line.is_thali) {
        const idx = c.findIndex((x) => x.menu_item_id === line.menu_item_id && !x.is_thali);
        if (idx >= 0) {
          const next = [...c];
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
          return next;
        }
      }
      return [...c, { ...line, _key: `${line.menu_item_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }];
    });
  }, []);

  const updateQty = useCallback((key, delta) => {
    setCart((c) => c.map((x) => (x._key === key ? { ...x, qty: Math.max(1, x.qty + delta) } : x)));
  }, []);

  const removeLine = useCallback((key) => {
    setCart((c) => c.filter((x) => x._key !== key));
  }, []);

  const clear = useCallback(() => {
    setCart([]);
    setDiscount(0);
  }, []);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
    const tax = cart.reduce((s, x) => s + x.price * x.qty * (x.tax_rate / 100), 0);
    const d = Number(discount) || 0;
    const total = Math.max(0, subtotal + tax - d);
    return { subtotal, tax, total, discount: d };
  }, [cart, discount]);

  return { cart, discount, setDiscount, addLine, updateQty, removeLine, clear, totals };
}
