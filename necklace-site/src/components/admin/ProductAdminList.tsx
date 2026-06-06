"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";
import { formatJPY } from "@/lib/utils";

export function ProductAdminList({ products }: { products: Product[] }) {
  const router = useRouter();
  const [items, setItems] = useState(products);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const persistOrder = (next: Product[]) => {
    const ids = next.map((p) => p.id);
    fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) setError(data.error);
      })
      .catch((e) => setError(String(e)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    persistOrder(next);
  };

  const toggle = async (
    id: string,
    field: "published" | "inStock",
    value: boolean,
  ) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除します。よろしいですか?`)) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setItems((prev) => prev.filter((p) => p.id !== id));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((p, i) => (
          <li
            key={p.id}
            className="rounded-lg border border-border bg-background p-3 sm:p-4"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div
                className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded sm:h-24 sm:w-20"
                style={{ backgroundColor: p.imageBg }}
              >
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.imageAlt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  {!p.published && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      下書き
                    </span>
                  )}
                  {!p.inStock && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-800">
                      売切
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.slug}
                </p>
                <p className="mt-1 text-sm tabular-nums">
                  {formatJPY(p.price)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={p.published}
                      disabled={busyId === p.id}
                      onChange={(e) =>
                        toggle(p.id, "published", e.target.checked)
                      }
                    />
                    <span className="text-xs">公開</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={p.inStock}
                      disabled={busyId === p.id}
                      onChange={(e) =>
                        toggle(p.id, "inStock", e.target.checked)
                      }
                    />
                    <span className="text-xs">在庫あり</span>
                  </label>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    編集
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(p.id, p.name)}
                    disabled={busyId === p.id}
                    className="text-xs text-red-600 underline hover:text-red-800 disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-label="上に移動"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="下に移動"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
