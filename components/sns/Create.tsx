"use client";

import { useEffect, useMemo, useState } from "react";
import { SNS_PLACES, SNS_PLACE_LABEL, SnsIdea, SnsPlace, SnsPolicy, SnsPostRecord, isInstagramPost } from "@/lib/types";
import { addPost, fromLocalInput, judgeFormats, toLocalInput, updateIdea, weekRange } from "@/lib/sns";
import {
  CAPTION_TEMPLATES,
  FORMAT_CARDS,
  FormatCard,
  HASHTAGS,
  HOOKS,
  HookCat,
  IG_HASHTAG_MAX,
  POST_CHECKS,
  SHOOT_CHECKS,
  SLIDE_NOTE,
  SLIDE_ORDER,
  confidenceRank,
  fillTemplate,
  findFormat,
  templateFields,
} from "@/lib/snsKnowledge";
import { Chips, CopyButton } from "./common";
import type { AiApplied } from "./AiSuggest";
import styles from "../SnsPlan.module.css";

export interface CreatePreset {
  ideaId?: string;
  formatId?: string;
  nonce: number;
}

interface Props {
  policy: SnsPolicy;
  posts: SnsPostRecord[];
  ideas: SnsIdea[];
  preset: CreatePreset | null;
  onLogged: () => void;
}

// 自動で埋める欄(フック・キーワードから)
const AUTO_FIELDS = ["キーワード", "一言", "型の一言"];

function omit(m: Record<string, string>, keys: string[]): Record<string, string> {
  const n = { ...m };
  for (const k of keys) delete n[k];
  return n;
}

function verdictScore(v: string | undefined): number {
  if (v === "続ける") return 2;
  if (v === "やめる候補") return -2;
  return 0;
}

export default function Create({ policy, posts, ideas, preset, onLogged }: Props) {
  const [formatId, setFormatId] = useState<string>("");
  const [picking, setPicking] = useState(true);
  const [hookCat, setHookCat] = useState<HookCat | "">("");
  const [hook, setHook] = useState("");
  const [place, setPlace] = useState<SnsPlace>("tiktokPhoto");
  const [templateId, setTemplateId] = useState<string>("tiktokPhoto");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [checks, setChecks] = useState<boolean[]>(() => POST_CHECKS.map(() => false));
  const [ideaId, setIdeaId] = useState("");
  const [logTs, setLogTs] = useState(() => toLocalInput(Date.now()));
  const [wearing, setWearing] = useState(false);
  const [notice, setNotice] = useState(false);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  // 「写真から提案」を使ったとき(記録用。§4-E)
  const [ai, setAi] = useState<{ formatId: string; hookCandidates: string[] } | null>(null);

  const fmt = findFormat(formatId);

  // 分析で伸びた型・自分の振り返りで「続ける」になった型を上に
  const verdicts = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of judgeFormats(posts).stats) if (s.formatId) m[s.formatId] = s.verdict;
    return m;
  }, [posts]);
  const ordered = useMemo(
    () =>
      FORMAT_CARDS.map((f, i) => ({ f, i }))
        .sort(
          (a, b) =>
            verdictScore(verdicts[b.f.id]) - verdictScore(verdicts[a.f.id]) ||
            confidenceRank(b.f) - confidenceRank(a.f) ||
            a.i - b.i
        )
        .map((x) => x.f),
    [verdicts]
  );

  const chooseFormat = (f: FormatCard) => {
    setFormatId(f.id);
    setPicking(false);
    setHookCat(f.hookCats[0]);
    setHook("");
    setPlace(f.defaultPlace);
    setTemplateId(f.notice ? "notice" : f.id === "gift" ? "gift" : f.defaultPlace);
    setWearing(f.wearing);
    setNotice(f.notice);
  };

  // アイデア箱・ナレッジ・振り返りから来たとき
  useEffect(() => {
    if (!preset) return;
    const idea = preset.ideaId ? ideas.find((i) => i.id === preset.ideaId) : undefined;
    if (preset.ideaId) setIdeaId(preset.ideaId);
    const f = findFormat(preset.formatId ?? idea?.formatId);
    if (f) chooseFormat(f);
    else {
      setFormatId("");
      setPicking(true);
    }
    if (idea?.text) setMemo(idea.text);
    setLogTs(toLocalInput(Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.nonce]);

  const template = CAPTION_TEMPLATES.find((t) => t.id === templateId) ?? CAPTION_TEMPLATES[0];
  const tFields = templateFields(template.text);
  const values: Record<string, string> = {
    ...fields,
    キーワード: fields["キーワード"] ?? keyword,
    一言: fields["一言"] ?? hook,
    型の一言: fields["型の一言"] ?? hook,
  };
  const filled = fillTemplate(template.text, values);
  const extraTags = tags.filter((t) => filled.indexOf(t) === -1);
  const caption = extraTags.length ? `${filled}\n${extraTags.join(" ")}` : filled;
  const tagCount = (caption.match(/#[^\s#]+/g) ?? []).length;
  const igOver = isInstagramPost(place) && tagCount > IG_HASHTAG_MAX;
  const unfilled = tFields.filter((k) => !(values[k] ?? "").trim());

  const toggleTag = (t: string) => setTags((xs) => (xs.indexOf(t) === -1 ? [...xs, t] : xs.filter((x) => x !== t)));

  // 今週すでに記録した告知・販売の投稿(AIに渡す。§4-A-9)
  const noticeThisWeek = useMemo(() => {
    const w = weekRange(Date.now());
    return posts.filter((p) => p.notice && p.ts >= w.start && p.ts < w.end).length;
  }, [posts]);

  const applyAi = (a: AiApplied) => {
    const f = findFormat(a.formatId);
    if (f) chooseFormat(f);
    setHook(a.hook);
    setKeyword(a.keyword);
    setFields((m) => omit(m, ["一言", "型の一言", "キーワード"]));
    setAi({ formatId: a.formatId, hookCandidates: a.hookCandidates });
  };

  const hookSource = (h: string): "AI案" | "テンプレ" | "自分" | undefined => {
    const t = h.trim();
    if (!t) return undefined;
    if (ai && ai.hookCandidates.indexOf(t) !== -1) return "AI案";
    if (Object.keys(HOOKS).some((c) => HOOKS[c as HookCat].indexOf(t) !== -1)) return "テンプレ";
    return "自分";
  };

  const adoptable = ideas.filter((i) => i.status === "採用" || i.id === ideaId);

  const log = async () => {
    const ts = fromLocalInput(logTs) ?? Date.now();
    setSaving(true);
    try {
      const id = await addPost({
        ts,
        place,
        formatId: fmt?.id,
        formatLabel: fmt?.name ?? "(型なし)",
        hook: hook.trim() || undefined,
        keyword: keyword || undefined,
        ideaId: ideaId || undefined,
        memo: memo.trim() || undefined,
        wearing,
        notice,
        views: null,
        saves: null,
        ai_used: !!ai,
        ai_format_id: ai?.formatId,
        final_format_id: fmt?.id,
        hook_source: hookSource(hook),
      });
      if (ideaId) {
        await updateIdea(ideaId, { status: "投稿済み", postId: id }).catch((e) => console.error("idea update failed", e));
      }
      setChecks(POST_CHECKS.map(() => false));
      setIdeaId("");
      setMemo("");
      setHook("");
      setFields({});
      setAi(null);
      setLogTs(toLocalInput(Date.now()));
      onLogged();
    } catch (e) {
      console.error("log post failed", e);
      alert("記録できませんでした。通信状況を確認してもう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.topBar}>
          <h3 className={styles.h3}>1. 型を選ぶ</h3>
          {!picking && (
            <button type="button" className={styles.secondary} onClick={() => setPicking(true)}>
              型を変える
            </button>
          )}
        </div>
        {picking ? (
          <>
            <div className={styles.note}>上ほど伸びやすい型(★=分析で裏付け。振り返りで「続ける」になった型も上に来ます)</div>
            <ul className={styles.list}>
              {ordered.map((f) => (
                <li key={f.id}>
                  <button type="button" className={styles.formatBtn} onClick={() => chooseFormat(f)}>
                    <span className={styles.formatName}>
                      {f.star ? "★" : ""}
                      {f.name}
                    </span>
                    <span className={styles.ideaMeta}>
                      {f.purpose}・手間{f.effort}・確度:{f.confidence}
                      {verdicts[f.id] ? `・判定:${verdicts[f.id]}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          fmt && (
            <div className={styles.formatCard}>
              <div className={styles.formatName}>
                {fmt.star ? "★" : ""}
                {fmt.name}
              </div>
              <dl className={styles.dl}>
                <dt>見せるもの</dt>
                <dd>{fmt.show}</dd>
                <dt>1枚目</dt>
                <dd>{fmt.firstSlide}</dd>
                <dt>目的</dt>
                <dd>{fmt.purpose}</dd>
                <dt>場所</dt>
                <dd>{fmt.places}</dd>
                <dt>手間</dt>
                <dd>{fmt.effort}</dd>
                {fmt.example && (
                  <>
                    <dt>例</dt>
                    <dd>{fmt.example}</dd>
                  </>
                )}
                <dt>確度</dt>
                <dd>{fmt.confidence}</dd>
              </dl>
            </div>
          )
        )}
      </section>

      {fmt && !picking && (
        <>
          <section className={styles.card}>
            <h3 className={styles.h3}>2. 1枚目の文字</h3>
            <Chips options={fmt.hookCats} value={hookCat} onChange={setHookCat} label="目的" />
            <ul className={styles.list}>
              {(hookCat ? HOOKS[hookCat] : []).map((h) => (
                <li key={h}>
                  <button
                    type="button"
                    className={`${styles.hookBtn} ${hook === h ? styles.hookOn : ""}`}
                    aria-pressed={hook === h}
                    onClick={() => {
                      setHook(hook === h ? "" : h);
                      setFields((m) => omit(m, ["一言", "型の一言"]));
                    }}
                  >
                    {h}
                  </button>
                </li>
              ))}
            </ul>
            <label className={styles.label}>
              使う文字(直してOK)
              <input className={styles.input} type="text" value={hook} onChange={(e) => setHook(e.target.value)} />
            </label>
          </section>

          <section className={styles.card}>
            <h3 className={styles.h3}>3. 写真・動画の並べ方</h3>
            <div className={styles.dim}>この型:1枚目=「{fmt.firstSlide}」/ {fmt.show}</div>
            <ol className={styles.steps}>
              {SLIDE_ORDER.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className={styles.note}>{SLIDE_NOTE}</div>
            <details className={styles.details}>
              <summary className={styles.summarySmall}>撮る前チェック(10)</summary>
              <ul className={styles.plainList}>
                {SHOOT_CHECKS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </details>
          </section>
        </>
      )}

      <section className={styles.card}>
        <h3 className={styles.h3}>{fmt && !picking ? "4. 文章" : "文章"}</h3>
        <div className={styles.fieldTitle}>投稿する場所</div>
        <Chips
          options={SNS_PLACES}
          value={place}
          onChange={(p) => {
            setPlace(p);
            if (CAPTION_TEMPLATES.some((t) => t.id === p) && templateId !== "notice" && templateId !== "gift") setTemplateId(p);
          }}
          label="投稿する場所"
          render={(p) => SNS_PLACE_LABEL[p]}
        />
        <label className={styles.label}>
          テンプレート
          <select className={styles.input} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {CAPTION_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {template.note && <div className={styles.note}>{template.note}</div>}

        <div className={styles.fieldTitle}>キーワード(1投稿に1つ)</div>
        <div className={styles.chips} role="group" aria-label="キーワード">
          {policy.keywords.map((k) => (
            <button
              key={k}
              type="button"
              className={`${styles.chip} ${keyword === k ? styles.chipOn : ""}`}
              aria-pressed={keyword === k}
              onClick={() => {
                setKeyword(keyword === k ? "" : k);
                setFields((m) => omit(m, ["キーワード"]));
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <div className={styles.note}>1枚目の文字・文章の最初・声の3か所に同じ語を入れる。詰め込みはスパム扱い。</div>

        {tFields.length > 0 && (
          <div className={styles.grid2}>
            {tFields.map((k) => (
              <label key={k} className={styles.label}>
                {k}
                {AUTO_FIELDS.indexOf(k) !== -1 && <span className={styles.dim}>(上で選んだもの)</span>}
                <input
                  className={styles.input}
                  type="text"
                  value={values[k] ?? ""}
                  onChange={(e) => setFields((m) => ({ ...m, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        )}

        <div className={styles.fieldTitle}>ハッシュタグ(大1+中2+小1+自社1)</div>
        {HASHTAGS.map((g) => (
          <div key={g.size} className={styles.tagGroup}>
            <span className={styles.tagSize}>{g.size}</span>
            <div className={styles.chips}>
              {g.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.chip} ${tags.indexOf(t) !== -1 ? styles.chipOn : ""}`}
                  aria-pressed={tags.indexOf(t) !== -1}
                  onClick={() => toggleTag(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className={igOver ? styles.warnBox : styles.note}>
          ハッシュタグ {tagCount}個
          {isInstagramPost(place) ? `(Instagramは${IG_HASHTAG_MAX}個まで)` : ""}
          {igOver ? " — 多すぎます。5個以内に減らしてください" : ""}
        </div>

        <div className={styles.fieldTitle}>できあがり</div>
        <textarea className={`${styles.input} ${styles.output}`} readOnly rows={6} value={caption} aria-label="できあがりの文章" />
        {unfilled.length > 0 && <div className={styles.warnText}>まだ埋まっていない欄:{unfilled.join("・")}</div>}
        <div className={styles.addRow}>
          <CopyButton text={caption} label="文章をコピー" />
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>投稿前チェック</h3>
        <div className={styles.note}>
          {checks.filter(Boolean).length}/{POST_CHECKS.length}
        </div>
        <ul className={styles.checks}>
          {POST_CHECKS.map((c, i) => (
            <li key={c}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={(e) => setChecks((xs) => xs.map((x, j) => (j === i ? e.target.checked : x)))}
                />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>投稿した</h3>
        <div className={styles.dim}>
          {SNS_PLACE_LABEL[place]}/{fmt ? fmt.name : "型なし"}
          {keyword ? `/${keyword}` : ""}
          {ai ? "/AIの提案を使用" : ""}
        </div>
        {!fmt && (
          <label className={styles.label}>
            型
            <select
              className={styles.input}
              value=""
              onChange={(e) => {
                const f = findFormat(e.target.value);
                if (f) chooseFormat(f);
              }}
            >
              <option value="">(型なし)</option>
              {FORMAT_CARDS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.label}>
          使ったフック
          <input className={styles.input} type="text" value={hook} onChange={(e) => setHook(e.target.value)} />
        </label>
        <label className={styles.label}>
          元のアイデア
          <select className={styles.input} value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
            <option value="">(なし)</option>
            {adoptable.map((i) => (
              <option key={i.id} value={i.id}>
                {(i.text || i.url || "(スクショのみ)").slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          投稿日時
          <div className={styles.addRow}>
            <input className={styles.input} type="datetime-local" value={logTs} onChange={(e) => setLogTs(e.target.value)} />
            <button type="button" className={styles.secondary} onClick={() => setLogTs(toLocalInput(Date.now()))}>
              今
            </button>
          </div>
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={wearing} onChange={(e) => setWearing(e.target.checked)} />
          <span>1枚目に「人が着けた姿」</span>
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={notice} onChange={(e) => setNotice(e.target.checked)} />
          <span>告知・販売の投稿(週{policy.noticeMaxPerWeek}本まで)</span>
        </label>
        <label className={styles.label}>
          メモ(なくてもOK)
          <input className={styles.input} type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <button type="button" className={styles.primary} onClick={log} disabled={saving}>
          {saving ? "記録中…" : "投稿した!を記録"}
        </button>
        <div className={styles.note}>3日たったら、振り返りで再生数と保存数を入れます。</div>
      </section>
    </>
  );
}
