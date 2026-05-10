"use client";

import { CartDrawer } from "./cart-drawer";

export function CartProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CartDrawer />
    </>
  );
}
