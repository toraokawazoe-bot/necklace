"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CartLine = {
  productId: string;
  size: number;
  qty: number;
};

type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  hydrated: boolean;
  add: (productId: string, size: number, qty?: number) => void;
  remove: (productId: string, size: number) => void;
  setQty: (productId: string, size: number, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setHydrated: () => void;
};

const sameLine = (a: CartLine, productId: string, size: number) =>
  a.productId === productId && a.size === size;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      hydrated: false,
      add: (productId, size, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) =>
            sameLine(l, productId, size),
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                sameLine(l, productId, size)
                  ? { ...l, qty: l.qty + qty }
                  : l,
              ),
              isOpen: true,
            };
          }
          return {
            lines: [...state.lines, { productId, size, qty }],
            isOpen: true,
          };
        }),
      remove: (productId, size) =>
        set((state) => ({
          lines: state.lines.filter((l) => !sameLine(l, productId, size)),
        })),
      setQty: (productId, size, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => !sameLine(l, productId, size))
              : state.lines.map((l) =>
                  sameLine(l, productId, size) ? { ...l, qty } : l,
                ),
        })),
      clear: () => set({ lines: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "740nll-cart-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
