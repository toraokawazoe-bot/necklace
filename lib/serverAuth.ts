// サーバー専用: ブラウザから届いた Firebase ID トークンを確かめ、運用者本人(OWNER_UID)かを判定する。
// instagram/send と同じ考え方。OWNER_UID が未設定のときは「誰でも」にせず失敗させる(fail closed)。
import { getAdminAuth, isAdminConfigured } from "./firebaseAdmin";

export type OwnerCheck =
  | { ok: true; uid: string }
  | { ok: false; status: number; error: "unauthorized" | "forbidden" | "not_configured" };

export async function verifyOwner(authorization: string | null): Promise<OwnerCheck> {
  const ownerUid = process.env.OWNER_UID;
  if (!ownerUid || !isAdminConfigured()) return { ok: false, status: 503, error: "not_configured" };
  const authz = authorization ?? "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!idToken) return { ok: false, status: 401, error: "unauthorized" };
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.uid !== ownerUid) return { ok: false, status: 403, error: "forbidden" };
    return { ok: true, uid: decoded.uid };
  } catch {
    return { ok: false, status: 401, error: "unauthorized" };
  }
}
