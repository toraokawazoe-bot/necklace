import { COUPON_KINDS, type CouponKind } from "./coupon-kinds";

// クーポンが使えなかった理由をお客様向けの日本語にする。
export function couponReasonMessage(
  reason: "notfound" | "used" | "disabled" | "reserved" | "unavailable",
): string {
  switch (reason) {
    case "used":
      return "このクーポンはすでに使用済みです。";
    case "reserved":
      return "このクーポンは決済の手続き中です。進行中の決済を終えるか、しばらくしてからもう一度お試しください。";
    case "disabled":
      return "このクーポンは無効になっています。";
    case "unavailable":
      return "ただいまクーポンを確認できません。時間をおいてもう一度お試しください。";
    default:
      return "クーポンコードが見つかりません。入力内容をご確認ください。";
  }
}

export function couponWrongCartMessage(kind: CouponKind): string {
  const only = COUPON_KINDS[kind].onlyFor;
  return only
    ? `このクーポンは${only}にだけ使えます。カートに${only}が入っているかご確認ください。`
    : "このクーポンはカートの商品に使えません。";
}
