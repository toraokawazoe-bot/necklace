"use client";

import { useEffect, useRef, useState } from "react";
import {
  Order,
  ItemType,
  PaymentMethod,
  OrderStatus,
  Settings,
  STATUS_LIST,
  IgMessageDoc,
} from "@/lib/types";
import { formatDate, formatDateTime, subscribeThreadMessages } from "@/lib/storage";
import { compressImage } from "@/lib/image";
import { defaultPrice, formatYen } from "@/lib/pricing";
import styles from "./OrderForm.module.css";

interface Props {
  order: Order;
  settings: Settings;
  onSave: (order: Order) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// 送信失敗時、Graph のエラー（route が unwrap して { error: {...} } で返す）を
// 日本語のユーザー向けメッセージに変換する。
function igErrorMessage(data: unknown): string {
  const err =
    (
      data as {
        error?: { code?: string | number; error_subcode?: number; message?: string };
      } | null
    )?.error ?? null;
  const code = err?.code;
  const sub = err?.error_subcode;
  const msg = (err?.message ?? "").toLowerCase();

  if (code === "no_token")
    return "送信トークンが未設定です。管理者にご連絡ください。";
  if (code === "network")
    return "ネットワークエラーで送信できませんでした。電波を確認して再度お試しください。";
  if (code === "too_long")
    return "メッセージが長すぎます（1000バイトまで）。短くしてください。";
  // 24時間ウィンドウ超過
  if ((code === 10 && (sub === 2534022 || sub === 2018278)) ||
      (msg.includes("outside") && msg.includes("window")))
    return "最後の受信から24時間が過ぎているため、Instagramの仕様で返信できませんでした。";
  if (code === 190)
    return "アクセストークンの有効期限が切れています。再認証が必要です。";
  if (code === 200)
    return "メッセージ送信の権限が不足しています（instagram_business_manage_messages）。";
  if (code === 100 && sub === 2018001) return "送信先が見つかりませんでした。";
  if (code === 613)
    return "送信回数の上限に達しました。しばらくしてからお試しください。";
  return "送信に失敗しました。時間をおいて再度お試しください。";
}

export default function OrderForm({ order, settings, onSave, onDelete, onClose }: Props) {
  const [customer, setCustomer] = useState(order.customer);
  const [type, setType] = useState<ItemType>(order.type);
  const [length, setLength] = useState(order.length);
  const [design, setDesign] = useState(order.design);
  const [payment, setPayment] = useState<PaymentMethod>(order.payment);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [memo, setMemo] = useState(order.memo);
  const [priceInput, setPriceInput] = useState<string>(
    typeof order.priceOverride === "number" ? String(order.priceOverride) : ""
  );
  const [screenshot, setScreenshot] = useState<string | undefined>(order.screenshot);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isInstagram = order.source === "instagram";
  const [thread, setThread] = useState<IgMessageDoc[]>([]);
  const [threadLoaded, setThreadLoaded] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!isInstagram || !order.igThreadId) return;
    const unsub = subscribeThreadMessages(order.igThreadId, (msgs) => {
      setThread(msgs);
      setThreadLoaded(true);
    });
    return () => unsub();
  }, [isInstagram, order.igThreadId]);

  // 標準メッセージウィンドウ判定：最後の「受信」メッセージから24時間以内か。
  // direction 未設定の旧データは受信扱い（!== "out"）。
  const lastIncomingTs = thread.reduce(
    (acc, m) => (m.direction !== "out" ? Math.max(acc, m.ts ?? 0) : acc),
    0
  );
  const windowOpen =
    lastIncomingTs > 0 && Date.now() - lastIncomingTs < 24 * 60 * 60 * 1000;

  // 送信 API の上限は 1000「バイト」（UTF-8）。日本語は1文字≈3バイトなので
  // 文字数ではなくバイト数で判定し、サーバー側の Buffer.byteLength 判定と揃える。
  const replyBytes = new TextEncoder().encode(reply).length;
  const replyTooLong = replyBytes > 1000;

  const handleSendReply = async () => {
    const text = reply.trim();
    if (!order.igThreadId || !text || sending || replyTooLong) return;
    setSending(true);
    try {
      const res = await fetch("/api/instagram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: order.igThreadId, text }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        // 送信メッセージは onSnapshot 経由でバブルとして自動表示される
        setReply("");
      } else {
        alert(igErrorMessage(data));
      }
    } catch {
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      setScreenshot(compressed);
    } catch {
      alert("画像の読み込みに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(undefined);
  };

  const handleSave = () => {
    const next: Order = {
      ...order,
      customer: customer.trim(),
      type,
      length,
      design: design.trim(),
      payment,
      status,
      memo: memo.trim(),
    };
    if (screenshot) {
      next.screenshot = screenshot;
    } else {
      delete next.screenshot;
    }
    const priceTrim = priceInput.trim();
    if (priceTrim === "") {
      delete next.priceOverride;
    } else {
      const parsed = Number(priceTrim);
      if (!Number.isNaN(parsed)) next.priceOverride = parsed;
    }
    onSave(next);
  };

  const handleDelete = () => {
    if (confirm("このオーダーを削除しますか？")) {
      onDelete(order.id);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>オーダー編集</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className={styles.dateInfo}>受注日：{formatDate(order.created)}</div>

        <div className={styles.field}>
          <label className={styles.label}>インスタID</label>
          <input
            type="text"
            placeholder="@username"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            autoComplete="off"
          />
        </div>

        {isInstagram && (
          <div className={styles.field}>
            <label className={styles.label}>DM会話</label>
            <div className={styles.dmThread}>
              {!threadLoaded ? (
                <div className={styles.dmEmpty}>読み込み中…</div>
              ) : thread.length === 0 ? (
                <div className={styles.dmEmpty}>
                  まだ受信ログがありません
                </div>
              ) : (
                thread.map((m) => {
                  const isOut = m.direction === "out";
                  return (
                    <div
                      key={m.id}
                      className={`${styles.dmRow} ${isOut ? styles.dmRowOut : ""}`}
                    >
                      <div
                        className={`${styles.dmBubble} ${
                          isOut ? styles.dmBubbleOut : ""
                        }`}
                      >
                        {m.text && m.text.trim() ? m.text : m.summary}
                      </div>
                      <div className={styles.dmTime}>{formatDateTime(m.ts)}</div>
                    </div>
                  );
                })
              )}
            </div>

            {windowOpen ? (
              <div className={styles.hint}>24時間以内：返信できます</div>
            ) : (
              <div className={styles.dmWindowWarn}>
                最後の受信から24時間以上経過。Instagramの仕様で返信できない場合があります
              </div>
            )}
            <textarea
              className={styles.dmComposer}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder="返信を入力…"
            />
            {reply.length > 0 && (
              <div
                className={`${styles.dmByteCount} ${
                  replyTooLong ? styles.dmByteOver : ""
                }`}
              >
                {replyBytes} / 1000 バイト
              </div>
            )}
            <button
              type="button"
              className={styles.dmSendBtn}
              onClick={handleSendReply}
              disabled={!reply.trim() || sending || replyTooLong}
            >
              {sending ? "送信中…" : "送信"}
            </button>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>DMスクショ</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          {screenshot ? (
            <div className={styles.screenshotWrap}>
              <button
                type="button"
                className={styles.screenshotThumb}
                onClick={() => setPreviewOpen(true)}
                aria-label="スクショを拡大"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenshot} alt="DMスクショ" />
              </button>
              <div className={styles.screenshotActions}>
                <button
                  type="button"
                  className={styles.screenshotReplaceBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "処理中…" : "差し替え"}
                </button>
                <button
                  type="button"
                  className={styles.screenshotRemoveBtn}
                  onClick={handleRemoveScreenshot}
                >
                  削除
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.screenshotAddBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "処理中…" : "📷 画像を選択"}
            </button>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>種別</label>
          <div className={styles.typeGrid}>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === "ネックレス" ? styles.active : ""}`}
              onClick={() => setType("ネックレス")}
            >
              ネックレス
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === "ブレスレット" ? styles.active : ""}`}
              onClick={() => setType("ブレスレット")}
            >
              ブレスレット
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>長さ (cm)</label>
          <input
            type="number"
            placeholder="40"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>金額 (円)</label>
          <input
            type="number"
            placeholder={
              defaultPrice(settings, order.created, type) !== undefined
                ? String(defaultPrice(settings, order.created, type))
                : "デフォルト未設定"
            }
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            inputMode="numeric"
          />
          {(() => {
            const dp = defaultPrice(settings, order.created, type);
            const using =
              priceInput.trim() === "" && dp !== undefined ? dp : undefined;
            if (priceInput.trim() === "" && dp === undefined) {
              return (
                <div className={styles.hint}>
                  受注月のデフォルト未設定。空欄なら売上集計に金額0として加算されます
                </div>
              );
            }
            if (using !== undefined) {
              return (
                <div className={styles.hint}>
                  デフォルト適用：{formatYen(using)}
                </div>
              );
            }
            if (dp !== undefined) {
              return (
                <div className={styles.hint}>
                  この金額で上書き（デフォルト：{formatYen(dp)}）
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>デザイン</label>
          <textarea
            placeholder="例：シルバー925、6mm丸玉、星チャーム、留め具カニカン"
            value={design}
            onChange={(e) => setDesign(e.target.value)}
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>支払い方法</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            <option value="">未定</option>
            <option value="PayPay">PayPay</option>
            <option value="銀行振込">銀行振込</option>
            <option value="その他">その他</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ステータス</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>
                {s === "受信トレイ" ? "📥 " + s : s}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>メモ</label>
          <textarea
            placeholder="自由記入"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave}>保存</button>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
        </div>
        <button className={styles.deleteBtn} onClick={handleDelete}>このオーダーを削除</button>
      </div>

      {previewOpen && screenshot && (
        <div
          className={styles.previewOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setPreviewOpen(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshot} alt="DMスクショ拡大" className={styles.previewImg} />
        </div>
      )}
    </div>
  );
}
