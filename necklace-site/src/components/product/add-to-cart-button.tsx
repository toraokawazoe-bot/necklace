"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-store";

export function AddToCartButton({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const add = useCart((s) => s.add);
  const [adding, setAdding] = useState(false);

  if (disabled) {
    return (
      <Button size="lg" variant="outline" disabled className="w-full">
        Sold out
      </Button>
    );
  }

  const handleAdd = () => {
    setAdding(true);
    add(productId, 1);
    setTimeout(() => setAdding(false), 600);
  };

  return (
    <Button
      size="lg"
      onClick={handleAdd}
      disabled={adding}
      className="w-full"
    >
      {adding ? "Added —" : "Add to cart"}
    </Button>
  );
}
