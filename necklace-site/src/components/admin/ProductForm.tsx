"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/products";

type FormValues = {
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  material: string;
  length: string;
  image: string;
  imageAlt: string;
  imageBg: string;
  gallery: string[];
  details: string;
  published: boolean;
  inStock: boolean;
};

const DEFAULT_BG = "#efe4cd";

const DEFAULTS: FormValues = {
  slug: "",
  name: "",
  subtitle: "",
  description: "",
  price: 2500,
  material: "ガラスビーズ／ ナイロンコード",
  length: "約 38–42cm",
  image: "",
  imageAlt: "",
  imageBg: DEFAULT_BG,
  gallery: [],
  details: [
    "ガラスビーズ／ ナイロンコード編み",
    "全長 約 38–42cm（個体差あり）",
    "一点ずつ手編み・色合いやビーズの並びには微妙な個体差があります",
  ].join("\n"),
  published: true,
  inStock: true,
};

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [values, setValues] = useState<FormValues>(
    product
      ? {
          slug: product.slug,
          name: product.name,
          subtitle: product.subtitle,
          description: product.description,
          price: product.price,
          material: product.material,
          length: product.length,
          image: product.image,
          imageAlt: product.imageAlt,
          imageBg: product.imageBg || DEFAULT_BG,
          gallery: Array.isArray(product.gallery) ? product.gallery : [],
          details: product.details.join("\n"),
          published: product.published,
          inStock: product.inStock,
        }
      : DEFAULTS,
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const uploadOne = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/products/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data.url as string;
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadOne(file);
      set("image", url);
      if (!values.imageAlt) set("imageAlt", file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onGalleryFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of files) {
        urls.push(await uploadOne(file));
      }
      setValues((p) => ({ ...p, gallery: [...p.gallery, ...urls] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeGalleryAt = (index: number) =>
    setValues((p) => ({
      ...p,
      gallery: p.gallery.filter((_, i) => i !== index),
    }));

  const moveGallery = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= values.gallery.length) return;
    const next = [...values.gallery];
    [next[index], next[target]] = [next[target], next[index]];
    setValues((p) => ({ ...p, gallery: next }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...values,
        details: values.details
          .split("\n")
          .map((d) => d.trim())
          .filter(Boolean),
      };
      const url = isEdit
        ? `/api/admin/products/${product!.id}`
        : "/api/admin/products";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push("/admin/products");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider">
          メイン画像
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div
            className="relative h-44 w-32 flex-shrink-0 overflow-hidden rounded border border-border sm:h-48 sm:w-36"
            style={{ backgroundColor: values.imageBg }}
          >
            {values.image ? (
              <Image
                src={values.image}
                alt={values.imageAlt || "preview"}
                fill
                sizes="144px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                プレビュー
              </div>
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex cursor-pointer items-center rounded border border-border bg-background px-4 py-2 text-sm transition hover:bg-foreground hover:text-background">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={onFile}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? "アップロード中…" : values.image ? "画像を差し替え" : "画像をアップロード"}
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              JPG / PNG / WebP / AVIF ・ 8MB まで
            </p>
            <Field label="代替テキスト (画像の説明)" className="mt-3">
              <input
                type="text"
                value={values.imageAlt}
                onChange={(e) => set("imageAlt", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="背景色 (HEX)" className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={values.imageBg}
                  onChange={(e) => set("imageBg", e.target.value)}
                  className="h-9 w-12 rounded border border-border"
                />
                <input
                  type="text"
                  value={values.imageBg}
                  onChange={(e) => set("imageBg", e.target.value)}
                  className={inputCls}
                />
              </div>
            </Field>
          </div>
        </div>
      </section>

      <section>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider">
          追加画像 (ギャラリー)
        </label>
        <p className="mb-3 text-xs text-muted-foreground">
          商品詳細ページでメイン画像の下に並びます。複数選択可。
        </p>
        {values.gallery.length > 0 && (
          <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {values.gallery.map((url, i) => (
              <li
                key={`${url}-${i}`}
                className="relative aspect-square overflow-hidden rounded border border-border"
                style={{ backgroundColor: values.imageBg }}
              >
                <Image
                  src={url}
                  alt={`gallery ${i + 1}`}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/85 px-1 py-0.5">
                  <button
                    type="button"
                    aria-label="左へ"
                    onClick={() => moveGallery(i, -1)}
                    disabled={i === 0}
                    className="px-1 text-[11px] disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="削除"
                    onClick={() => removeGalleryAt(i)}
                    className="px-1 text-[11px] text-red-700"
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    aria-label="右へ"
                    onClick={() => moveGallery(i, 1)}
                    disabled={i === values.gallery.length - 1}
                    className="px-1 text-[11px] disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className="inline-flex cursor-pointer items-center rounded border border-border bg-background px-4 py-2 text-sm transition hover:bg-foreground hover:text-background">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={onGalleryFiles}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? "アップロード中…" : "+ 画像を追加"}
        </label>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="商品名 (日本語)">
          <input
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="サブタイトル (英語)">
          <input
            type="text"
            value={values.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="スラッグ (URLに使う英数字)">
          <input
            type="text"
            value={values.slug}
            onChange={(e) =>
              set(
                "slug",
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              )
            }
            pattern="[a-z0-9\-]+"
            className={inputCls}
            required
          />
        </Field>
        <Field label="価格 (円)">
          <input
            type="number"
            min={0}
            step={1}
            value={values.price}
            onChange={(e) => set("price", Number(e.target.value))}
            className={inputCls}
            required
          />
        </Field>
      </div>

      <Field label="説明文">
        <textarea
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          className={inputCls}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="素材">
          <input
            type="text"
            value={values.material}
            onChange={(e) => set("material", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="長さ">
          <input
            type="text"
            value={values.length}
            onChange={(e) => set("length", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="詳細 (1行1項目)">
        <textarea
          value={values.details}
          onChange={(e) => set("details", e.target.value)}
          rows={3}
          className={inputCls}
        />
      </Field>

      <div className="flex flex-wrap gap-6">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.published}
            onChange={(e) => set("published", e.target.checked)}
          />
          <span className="text-sm">公開する</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.inStock}
            onChange={(e) => set("inStock", e.target.checked)}
          />
          <span className="text-sm">在庫あり</span>
        </label>
      </div>

      <div className="flex gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={saving || uploading || !values.image}
          className="rounded-full bg-foreground px-6 py-2.5 text-sm text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "保存中…" : isEdit ? "更新" : "追加"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="rounded-full border border-border px-6 py-2.5 text-sm transition hover:bg-muted"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
