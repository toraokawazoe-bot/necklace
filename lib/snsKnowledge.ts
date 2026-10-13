// SNS運用タブのナレッジ本体(docs/sns-spec.md §3 の内容)。
// 2026-10-13 とらお・しおんと決定。文言はできるだけ仕様書のまま。
import type { SnsPlace } from "./types";

// ---- 1枚目の文字・最初の一言(40) ----
export type HookCat = "認知・保存" | "共感・シーン" | "教育・保存" | "ファン化・本音" | "告知・注文";

export const HOOK_CATS: HookCat[] = ["認知・保存", "共感・シーン", "教育・保存", "ファン化・本音", "告知・注文"];

export const HOOKS: Record<HookCat, string[]> = {
  "認知・保存": [
    "2,500円の差し色ネックレス",
    "白T1枚が、これ1本で変わる",
    "首元がさみしい人へ",
    "プチプラなのに安っぽく見えない理由",
    "ビーズアクセ、これ1本で足りる",
    "黒コーデに足したい差し色",
    "手作りだけど、この価格",
    "毎日つけたくなる色を作りました",
    "鏡越しで撮った、今日の首元",
    "差し色ネックレス、3色比べてみた",
  ],
  "共感・シーン": [
    "月曜の朝、気分が上がる色",
    "デートの日はこのブルー",
    "授業の日に着けていきたい1本",
    "疲れてる日こそ、黄色",
    "何を着ればいいか分からない日の助っ人",
    "友達の誕生日に選ぶなら",
    "冬ニットの首元、さみしくない?",
    "地味な服が好きな人の差し色",
  ],
  "教育・保存": [
    "差し色を失敗しない3つのルール",
    "服が黒なら、ネックレスはこの色",
    "ブルベに似合う差し色はこれ(目安)",
    "首の長さ別、ネックレスの選び方",
    "40cmと45cm、見え方はこう違う",
    "重ね付けのコツ、3本まで",
    "GUの服に合わせるならこの色",
    "韓国っぽく見せる配色の考え方",
  ],
  "ファン化・本音": [
    "2,500円の理由、全部話します",
    "実はこの色、3回作り直しました",
    "失敗作を見せます",
    "ビーズ1粒ずつ通して◯分かかります",
    "20代の一人でアクセを作って売っています",
    "熊本から発送しています(実際に合わせる)",
    "売れ残るのが怖くて、でも作ってる",
  ],
  "告知・注文": [
    "本日20時、新作出ます",
    "再販決定、◯点だけ",
    "あと3点で完売",
    "次の販売は◯日。通知オンにして",
    "次に作る色、選んでください",
    "ポップアップ出店します(日時・場所)",
    "届いた日に撮ってくれた写真が嬉しすぎた",
  ],
};

// ---- 型カード(伸びた順。★=分析で裏付け) ----
export type Pillar = "wear" | "buy" | "daily" | "learn";

export const PILLAR_LABEL: Record<Pillar, string> = {
  wear: "着る(コーデ)",
  buy: "買える(新作・告知)",
  daily: "しおんの日常",
  learn: "知る(Q&A・お手入れ・長さ)",
};

export interface FormatCard {
  id: string;
  name: string;
  star: boolean; // ★ 分析で裏付け
  spec: string; // 仕様書の1行(そのまま)
  show: string; // 何を見せる・構成
  firstSlide: string; // 1枚目の作り方
  purpose: string;
  places: string;
  effort: string;
  example: string;
  confidence: string;
  hookCats: HookCat[];
  defaultPlace: SnsPlace;
  wearing: boolean; // 1枚目に人が着けた姿になる型
  notice: boolean; // 告知・販売の型
  pillar: Pillar;
}

export const FORMAT_CARDS: FormatCard[] = [
  {
    id: "wear-outfit",
    name: "人が着けた姿(服・おでかけ)",
    star: true,
    spec: "★人が着けた姿(服・おでかけ):1枚目=服とネックレスが一緒に写る自撮り・全身・スナップ / 2枚目〜=別角度、首元寄り、色名と値段 / 目的:認知・保存 / TikTok写真・フィード / 手間:低 / 例:鏡越しの全身に黒のビーズネックレス / 確度:中",
    show: "2枚目〜=別角度、首元寄り、色名と値段",
    firstSlide: "服とネックレスが一緒に写る自撮り・全身・スナップ",
    purpose: "認知・保存",
    places: "TikTok写真・フィード",
    effort: "低",
    example: "鏡越しの全身に黒のビーズネックレス",
    confidence: "中",
    hookCats: ["認知・保存", "共感・シーン"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "neck",
    name: "首元の着用(顔を切る)",
    star: true,
    spec: "★首元の着用(顔を切る):1枚目=鼻から下の首元アップ、1行目に値段 / 認知・注文 / TikTok写真・動画・リール / 低 / 例:「これ2,500円です」+チョーカー丈 / 中",
    show: "鼻から下の首元アップ。1行目に値段",
    firstSlide: "鼻から下の首元アップ、1行目に値段",
    purpose: "認知・注文",
    places: "TikTok写真・動画・リール",
    effort: "低",
    example: "「これ2,500円です」+チョーカー丈",
    confidence: "中",
    hookCats: ["認知・保存", "告知・注文"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "flatlay-season",
    name: "色の多い置き撮り+季節の一言",
    star: true,
    spec: "★色の多い置き撮り+季節の一言:新作3〜10本を並べ、1枚目に季節の英字や一言 / 認知・保存 / TikTok写真 / 低 / 例:「Winter」+冬色5本 / 中",
    show: "新作3〜10本を並べる",
    firstSlide: "季節の英字や一言",
    purpose: "認知・保存",
    places: "TikTok写真",
    effort: "低",
    example: "「Winter」+冬色5本",
    confidence: "中",
    hookCats: ["認知・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "wear",
  },
  {
    id: "layering",
    name: "重ね付け",
    star: true,
    spec: "★重ね付け:白い布の上で2〜3本を重ねる、1本→2本→3本 / 保存・客単価 / TikTok写真・フィード / 中 / 例:2,500円を2本重ねたセット提案 / 中",
    show: "白い布の上で2〜3本を重ねる、1本→2本→3本",
    firstSlide: "重ねた完成形",
    purpose: "保存・客単価",
    places: "TikTok写真・フィード",
    effort: "中",
    example: "2,500円を2本重ねたセット提案",
    confidence: "中",
    hookCats: ["教育・保存", "認知・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "wear",
  },
  {
    id: "coord3",
    name: "1本で3コーデ",
    star: true,
    spec: "★1本で3コーデ:同じネックレスを3着に / 保存・注文 / TikTok写真・リール / 中 / 例:黒ニット・白シャツ・グレーのスウェット / 低〜中",
    show: "同じネックレスを3着に",
    firstSlide: "1着目の着用姿",
    purpose: "保存・注文",
    places: "TikTok写真・リール",
    effort: "中",
    example: "黒ニット・白シャツ・グレーのスウェット",
    confidence: "低〜中",
    hookCats: ["教育・保存", "認知・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "complete",
    name: "「これひとつで首元のコーデが完成する」",
    star: true,
    spec: "★「これひとつで首元のコーデが完成する」型の完成形ワンフレーズ+スライド / 認知 / TikTok写真 / 低 / 低",
    show: "完成形のワンフレーズ+スライド",
    firstSlide: "完成形のワンフレーズ",
    purpose: "認知",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "低",
    hookCats: ["認知・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "friends",
    name: "友達と一緒・日常の物語",
    star: false,
    spec: "友達と一緒・日常の物語:友達と作った、2人で着けた / 共感 / TikTok写真 / 低 / 低",
    show: "友達と作った、2人で着けた",
    firstSlide: "2人で着けた姿",
    purpose: "共感",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "低",
    hookCats: ["共感・シーン", "ファン化・本音"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "daily",
  },
  {
    id: "which",
    name: "色違い比較「どっち派?」",
    star: false,
    spec: "色違い比較「どっち派?」 / 保存・コメント / TikTok写真・ストーリーズ(投票)/ 低 / 推論",
    show: "色違いを並べて比べる",
    firstSlide: "「どっち派?」",
    purpose: "保存・コメント",
    places: "TikTok写真・ストーリーズ(投票)",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["認知・保存", "共感・シーン"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "wear",
  },
  {
    id: "before-after",
    name: "Before/After",
    star: false,
    spec: "Before/After(服だけ→ネックレスを足す)/ 保存 / TikTok・リール / 低 / 推論",
    show: "服だけ→ネックレスを足す",
    firstSlide: "服だけの姿",
    purpose: "保存",
    places: "TikTok・リール",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["認知・保存", "教育・保存"],
    defaultPlace: "tiktokVideo",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "day-of",
    name: "「〇〇な日のネックレス」",
    star: false,
    spec: "「〇〇な日のネックレス」(授業の日・バイトの日・デート)/ 保存・共感 / 低 / 推論",
    show: "授業の日・バイトの日・デート",
    firstSlide: "「〇〇な日のネックレス」",
    purpose: "保存・共感",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["共感・シーン"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "colors",
    name: "似合う色(目安と明記)",
    star: false,
    spec: "似合う色(目安と明記)/ 保存・コメント / 中 / 推論",
    show: "似合う色。目安と明記する",
    firstSlide: "似合う色の問いかけ",
    purpose: "保存・コメント",
    places: "TikTok写真",
    effort: "中",
    example: "",
    confidence: "推論",
    hookCats: ["教育・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "learn",
  },
  {
    id: "knit-length",
    name: "冬ニットに合う長さ",
    star: false,
    spec: "冬ニットに合う長さ(タートル・クルー・V)+長さcm表 / 保存・注文 / 低 / 推論(11〜2月の主力)",
    show: "タートル・クルー・V+長さcm表",
    firstSlide: "ニットの首元",
    purpose: "保存・注文",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "推論(11〜2月の主力)",
    hookCats: ["教育・保存", "共感・シーン"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "learn",
  },
  {
    id: "gift",
    name: "ギフト提案",
    star: false,
    spec: "ギフト提案(友達へ2,500円、セット4,000円、ラッピング)/ 注文 / 低 / 推論(12月・卒業)",
    show: "友達へ2,500円、セット4,000円、ラッピング",
    firstSlide: "ラッピングした姿",
    purpose: "注文",
    places: "TikTok写真・フィード",
    effort: "低",
    example: "",
    confidence: "推論(12月・卒業)",
    hookCats: ["共感・シーン", "告知・注文"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "buy",
  },
  {
    id: "gu",
    name: "GU・古着の服に合わせる",
    star: false,
    spec: "GU・古着の服に合わせる / 保存・認知 / 低 / 推論(視聴者がGUも見ている)",
    show: "GU・古着の服に合わせる",
    firstSlide: "服と一緒の着用姿",
    purpose: "保存・認知",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "推論(視聴者がGUも見ている)",
    hookCats: ["教育・保存", "認知・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: true,
    notice: false,
    pillar: "wear",
  },
  {
    id: "korean",
    name: "韓国っぽ配色",
    star: false,
    spec: "韓国っぽ配色 / 認知 / 中 / 推論",
    show: "韓国っぽ配色",
    firstSlide: "配色が分かる1枚",
    purpose: "認知",
    places: "TikTok写真",
    effort: "中",
    example: "",
    confidence: "推論",
    hookCats: ["教育・保存", "認知・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "wear",
  },
  {
    id: "notice",
    name: "一点もの・再入荷・数量限定の告知",
    star: false,
    spec: "一点もの・再入荷・数量限定の告知(予告→当日→残りわずか)/ 注文 / 低 / IGで反応、ただし告知は週1本まで",
    show: "予告→当日→残りわずか",
    firstSlide: "日時か数量",
    purpose: "注文",
    places: "Instagramフィード・ストーリーズ",
    effort: "低",
    example: "",
    confidence: "IGで反応、ただし告知は週1本まで",
    hookCats: ["告知・注文"],
    defaultPlace: "igFeed",
    wearing: false,
    notice: true,
    pillar: "buy",
  },
  {
    id: "collab",
    name: "会場・お店とのコラボ投稿/メンション付き実況",
    star: true,
    spec: "会場・お店とのコラボ投稿/メンション付き実況 / 認知(フォロワー外)/ IG・ストーリーズ / 中 / ★IG",
    show: "会場・お店とのコラボ、メンション付きの実況",
    firstSlide: "会場・お店が分かる1枚",
    purpose: "認知(フォロワー外)",
    places: "IG・ストーリーズ",
    effort: "中",
    example: "",
    confidence: "★IG",
    hookCats: ["告知・注文", "ファン化・本音"],
    defaultPlace: "igReel",
    wearing: false,
    notice: false,
    pillar: "daily",
  },
  {
    id: "customer",
    name: "お客さんの着用紹介(許可を取る)",
    star: false,
    spec: "お客さんの着用紹介(許可を取る)/ 信頼 / 低 / 推論",
    show: "お客さんの着用写真(許可を取る)",
    firstSlide: "お客さんの着用姿",
    purpose: "信頼",
    places: "Instagramフィード・ストーリーズ",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["ファン化・本音"],
    defaultPlace: "igFeed",
    wearing: true,
    notice: false,
    pillar: "daily",
  },
  {
    id: "price-reason",
    name: "価格の理由",
    star: false,
    spec: "価格の理由 / 信頼 / 低 / 推論",
    show: "価格の理由",
    firstSlide: "「2,500円の理由」",
    purpose: "信頼",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["ファン化・本音"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "learn",
  },
  {
    id: "qa",
    name: "Q&A・よくある質問",
    star: false,
    spec: "Q&A・よくある質問(長さ・素材・送料)/ 信頼・注文 / 低 / 推論",
    show: "長さ・素材・送料",
    firstSlide: "質問の文字",
    purpose: "信頼・注文",
    places: "TikTok写真・ストーリーズ",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["教育・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "learn",
  },
  {
    id: "care",
    name: "お手入れ",
    star: false,
    spec: "お手入れ / 保存 / 低 / 推論",
    show: "お手入れの方法",
    firstSlide: "お手入れの文字",
    purpose: "保存",
    places: "TikTok写真",
    effort: "低",
    example: "",
    confidence: "推論",
    hookCats: ["教育・保存"],
    defaultPlace: "tiktokPhoto",
    wearing: false,
    notice: false,
    pillar: "learn",
  },
  {
    id: "making",
    name: "作っている過程・ASMR梱包・作家の一日",
    star: false,
    spec: "作っている過程・ASMR梱包・作家の一日 / ファン化 / 中 / 注意:伸びた投稿には無かった。ストーリーズ向け",
    show: "作っている過程・梱包・作家の一日",
    firstSlide: "手元",
    purpose: "ファン化",
    places: "ストーリーズ向け",
    effort: "中",
    example: "",
    confidence: "注意:伸びた投稿には無かった。ストーリーズ向け",
    hookCats: ["ファン化・本音"],
    defaultPlace: "igStory",
    wearing: false,
    notice: false,
    pillar: "daily",
  },
];

export function findFormat(id: string | undefined): FormatCard | undefined {
  return id ? FORMAT_CARDS.find((f) => f.id === id) : undefined;
}

// 確度の並べ替え用(大きいほど確か)
export function confidenceRank(f: FormatCard): number {
  const c = f.confidence;
  let r = 0;
  if (c.startsWith("中〜低") || c.startsWith("低〜中")) r = 2.5;
  else if (c.startsWith("中")) r = 3;
  else if (c.startsWith("低")) r = 2;
  else if (c.includes("★")) r = 2.5;
  else if (c.startsWith("推論")) r = 1;
  else r = 0.5;
  return r + (f.star ? 1 : 0);
}

// ---- 文章テンプレート ----
export interface CaptionTemplate {
  id: string;
  name: string;
  text: string; // {欄} を埋める
  note?: string;
  place?: SnsPlace; // この場所の既定テンプレート
  spec: string; // 仕様書の1行
}

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  {
    id: "tiktokPhoto",
    name: "TikTok写真",
    text: "{キーワード}|2,500円\n{一言}\nカラー: {色}\n長さ: {長さ}cm\n#{キーワード} #ビーズネックレス #プチプラアクセサリー #ビーズアクセ",
    note: "1行目にキーワード、本文の最初20字に主要語",
    place: "tiktokPhoto",
    spec: "「【1行目】{キーワード}|2,500円\\n{一言}\\nカラー: {色}\\n長さ: {長さ}cm\\n#{キーワード} #ビーズネックレス #プチプラアクセサリー #ビーズアクセ」(1行目にキーワード、本文の最初20字に主要語)",
  },
  {
    id: "tiktokVideo",
    name: "TikTok動画",
    text: "{型の一言}。{服1}/{服2}/{服3}で変わる。\n#ビーズアクセ #コーデ #プチプラアクセサリー",
    note: "字幕にも同じ語",
    place: "tiktokVideo",
    spec: "「{型の一言}。{服1}/{服2}/{服3}で変わる。\\n#ビーズアクセ #コーデ #プチプラアクセサリー」(字幕にも同じ語)",
  },
  {
    id: "igFeed",
    name: "Instagramフィード",
    text: "【新作】{色}ネックレス|{素材}|¥2,500|長さ{長さ}cm|ご購入はプロフィールのリンクへ\n保存して、買うときに見返してね",
    note: "ハッシュタグ5個まで",
    place: "igFeed",
    spec: "「【新作】{色}ネックレス|{素材}|¥2,500|長さ{長さ}cm|ご購入はプロフィールのリンクへ\\n保存して、買うときに見返してね」+ハッシュタグ5個まで",
  },
  {
    id: "igReel",
    name: "リール",
    text: "{一言}。気になった方はプロフィールのリンクから。",
    note: "ハッシュタグ5個まで",
    place: "igReel",
    spec: "「{一言}。気になった方はプロフィールのリンクから。」+ハッシュタグ5個まで",
  },
  {
    id: "igStory",
    name: "ストーリーズ",
    text: "今日のネックレス。気になったら『詳細』と返信してね",
    place: "igStory",
    spec: "「今日のネックレス。気になったら『詳細』と返信してね」",
  },
  {
    id: "notice",
    name: "告知",
    text: "【新作】本日{時刻}〜\n色: {色}\n数量: 各{数}点\n購入: プロフィールのリンク",
    spec: "「【新作】本日{時刻}〜\\n色: {色}\\n数量: 各{数}点\\n購入: プロフィールのリンク」",
  },
  {
    id: "gift",
    name: "ギフト",
    text: "友達の誕生日に2,500円で選ぶなら。{包装の内容}",
    spec: "「友達の誕生日に2,500円で選ぶなら。{包装の内容}」",
  },
  {
    id: "tiktokProfile",
    name: "TikTokプロフィール",
    text: "手作りビーズネックレス ¥2,500|購入は下のリンク",
    spec: "「手作りビーズネックレス ¥2,500|購入は下のリンク」",
  },
  {
    id: "igProfile",
    name: "Instagramプロフィール",
    text: "740NLL|ガラスビーズのハンドメイドネックレス\n{特徴} ¥2,500\nご注文👇",
    spec: "「740NLL|ガラスビーズのハンドメイドネックレス\\n{特徴} ¥2,500\\nご注文👇」",
  },
];

// テンプレート内の {欄} を出てきた順に重複なしで返す
export function templateFields(text: string): string[] {
  const out: string[] = [];
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (out.indexOf(m[1]) === -1) out.push(m[1]);
  }
  return out;
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{([^{}]+)\}/g, (all: string, k: string, offset: number) => {
    const v = (values[k] ?? "").trim();
    if (!v) return all;
    // 「#{キーワード}」のようにハッシュタグになる所は空白を詰める
    return offset > 0 && text.charAt(offset - 1) === "#" ? v.replace(/\s+/g, "") : v;
  });
}

// ---- ハッシュタグ ----
export const HASHTAGS: { size: "大" | "中" | "小" | "自社"; need: number; tags: string[] }[] = [
  { size: "大", need: 1, tags: ["#ハンドメイドアクセサリー", "#アクセサリー", "#ネックレス"] },
  { size: "中", need: 2, tags: ["#ビーズネックレス", "#ハンドメイドネックレス", "#ビーズアクセサリー", "#ガラスビーズ"] },
  { size: "小", need: 1, tags: ["#星モチーフ", "#カラフルアクセ", "#ビーズ好き"] },
  { size: "自社", need: 1, tags: ["#740NLL"] },
];

export const IG_HASHTAG_MAX = 5;

export const DEFAULT_KEYWORDS = ["ビーズネックレス", "差し色ネックレス", "プチプラ アクセサリー", "ビーズアクセ", "ウィメンズ ネックレス"];

// ---- チェックリスト ----
export const SHOOT_CHECKS: string[] = [
  "照明を消して自然光だけ",
  "大きな窓の前で逆光〜横から",
  "フラッシュとHDRはオフ",
  "グリッドをオン、レンズを固定",
  "被写体を長押しでAE/AFロック、露出を少し下げてビーズの白飛びを防ぐ",
  "ビーズの接写はマクロ、レンズを拭く",
  "背景は白壁・木目・リネンで3色以内",
  "ガラスビーズの映り込みを角度で消す",
  "色が実物と合っているか",
  "首に着けた1枚と、長さが分かる1枚を必ず撮る",
];

export const POST_CHECKS: string[] = [
  "1枚目に人が身に着けた姿があるか",
  "色が実物に近いか",
  "長さが分かる写真があるか",
  "文字が隠れる位置にないか(上220px・下450px・右120pxを避ける)",
  "最初の2秒(1枚目)で何の投稿か分かるか",
  "文章の最初にキーワードがあるか",
  "Instagramのハッシュタグは5個以内か",
  "代替テキストを入れたか",
  "値段と買い方が書いてあるか",
  "投稿時間を記録したか",
];

// ---- 写真スライドの並べ方 ----
export const SLIDE_ORDER: string[] = [
  "1枚目:人が着けた姿+一言の文字",
  "2〜3枚目:別角度・横顔",
  "4枚目:ビーズの質感",
  "5枚目:色展開・置き撮り",
  "6枚目:長さが分かる写真",
  "最後:値段・買い方・次の予告",
];
export const SLIDE_NOTE = "5〜8枚が目安。全部同じ色味で。";

// ---- ストーリーズの型(10) ----
export const STORY_TYPES: string[] = [
  "2択アンケート(どっちの色?→結果を翌日)",
  "質問ボックス(ネックレスの悩み)",
  "クイズ(素材)",
  "カウントダウン(新作・再販・出店。リマインダー通知)",
  "作っているところの10秒",
  "今日の1本(着画+リンク、「詳細」と返信で在庫を案内)",
  "お客さんの着用シェア(許可)",
  "在庫残りわずか",
  "スライダー(今日の気分→色の提案)",
  "ハイライト整理(注文方法・サイズ・お客様の声・POP UP・新作)",
];

// ---- 季節カレンダー(2026年11月〜2027年4月) ----
export interface SeasonEvent {
  name: string;
  date: string; // 表示用(仕様書のまま)
  idea: string;
  startLabel: string; // 投稿開始(仕様書のまま)
  start: string; // 投稿開始の目安 YYYY-MM-DD(「下旬」は21日、「上旬」は1日として扱う)
  end: string; // イベントの最終日 YYYY-MM-DD
}

export const SEASON_EVENTS: SeasonEvent[] = [
  { name: "勤労感謝の日の3連休", date: "11/21〜23", idea: "ポップアップ(告知は3週間前)", startLabel: "11/1", start: "2026-11-01", end: "2026-11-23" },
  { name: "ブラックフライデー", date: "11/27", idea: "値引きはせず、ギフトセットの先行予約", startLabel: "11/16", start: "2026-11-16", end: "2026-11-27" },
  { name: "クリスマス", date: "12/24・25", idea: "ギフトセット4,000円、ラッピング、友達に贈る。発送の締切を先に決めて明示", startLabel: "11/15", start: "2026-11-15", end: "2026-12-25" },
  { name: "冬のボーナス", date: "12月上〜中旬", idea: "自分へのご褒美、大人っぽい長さ・配色", startLabel: "12/1", start: "2026-12-01", end: "2026-12-20" },
  { name: "年末年始", date: "12/28〜1/3", idea: "帰省コーデ、初売り、年末の発送休み", startLabel: "12/20", start: "2026-12-20", end: "2027-01-03" },
  { name: "成人の日", date: "2027/1/11", idea: "振袖に合う配色、前撮り。注文締切は12月中旬", startLabel: "11月下旬", start: "2026-11-21", end: "2027-01-11" },
  { name: "バレンタイン", date: "2/14", idea: "おそろいのブレスレット、赤・ピンク、自分へのご褒美", startLabel: "1月下旬", start: "2027-01-21", end: "2027-02-14" },
  { name: "卒業", date: "2〜3月", idea: "卒業祝いのギフト", startLabel: "2月上旬", start: "2027-02-01", end: "2027-03-31" },
  { name: "ホワイトデー", date: "3/14", idea: "男性が買う流れを作る", startLabel: "2月下旬", start: "2027-02-21", end: "2027-03-14" },
  { name: "春分の日の3連休", date: "3/20〜22", idea: "ポップアップ", startLabel: "3/6", start: "2027-03-06", end: "2027-03-22" },
  { name: "新生活・入学", date: "3月下旬〜4月", idea: "新生活の1本目", startLabel: "3月上旬", start: "2027-03-01", end: "2027-04-30" },
  { name: "春服・桜", date: "3月下旬〜4月上旬", idea: "桜ピンク・ミント", startLabel: "3月上旬", start: "2027-03-01", end: "2027-04-10" },
];

// ---- ナレッジ画面(カテゴリ別・検索用) ----
export interface KnowledgeItem {
  title?: string;
  body: string;
  formatId?: string; // 型カードなら「この型で作る」を出す
}

export interface KnowledgeSection {
  id: string;
  title: string;
  items: KnowledgeItem[];
}

export const KNOWLEDGE: KnowledgeSection[] = [
  {
    id: "analysis",
    title: "740NLLの分析の結論",
    items: [
      { body: "2026-10-13、自分のアカウント+同じビーズ系11アカウント" },
      { title: "TikTok 伸びる 1", body: "1枚目に「人が身に着けている姿」(服やおでかけの写真、または顔を切った首元の着用)。1枚目が物だけは伸びない。確度:中" },
      { title: "TikTok 伸びる 2", body: "写真スライド(他4アカウント137投稿で写真1.06倍・動画0.80倍)。確度:中" },
      { title: "TikTok 伸びる 3", body: "「ビーズネックレス」で検索される(伸びた投稿の検索流入の31〜50%がこの語)。タグか文章に入れる。確度:中〜低" },
      { title: "TikTok 伸びる 4", body: "保存したくなる中身(色が多い・重ね付け・着こなし)。保存率0.6%超の投稿だけが2.5万回超。確度:中" },
      { title: "TikTok 伸びる 5", body: "季節の言葉(夏・秋・冬)で約1.9倍。確度:低〜中" },
      { title: "TikTok 伸びる 6", body: "値段を1行目に(例「これ1000円台で買えます」5.2万回)。確度:低" },
      { title: "TikTok 伸びる 7", body: "友達と一緒など人の物語。確度:低" },
      { title: "TikTok 伸びる 8", body: "夕方17〜19時。確度:低" },
      {
        title: "TikTok 伸びない",
        body: "1枚目が物だけ/ブランド紹介・想い・アレルギー対応を前に出した動画(0.2〜0.3倍)/同じ文章の使い回し/販売・告知・お礼・内輪の報告が主の投稿(見られても保存されない)/作っている過程の投稿は伸びた投稿に1本も無かった",
      },
      {
        title: "Instagram 伸びる",
        body: "会場やお店のアカウントとのコラボ・メンション(7/20告知2.2万回、ストーリーズ1位も会場メンション)/リールと実況ストーリーズでフォロワー外へ/人が写った投稿はプロフィールに見に来られる/「一点もの・再入荷・数量限定」「使い心地の一文(マグネット金具で着脱簡単)」",
      },
      {
        title: "Instagram 伸びない",
        body: "商品写真のまとめ連投(届いた人数が半分)/シェアしたくなる要素がない(32投稿でシェアほぼ0)/「次は◯日」だけの予告",
      },
      {
        title: "740NLLの数字",
        body: "TikTok 1,417人、視聴者 女性66%・18〜24歳64%、検索流入23.8%、検索語「プチプラ アクセサリー」「ビーズアクセ」「ウィメンズ ネックレス」「差し色ネックレス」。Instagram 327人、閲覧の83.5%がストーリーズ。",
      },
    ],
  },
  {
    id: "formats",
    title: "型カード",
    items: FORMAT_CARDS.map((f) => ({ title: (f.star ? "★" : "") + f.name, body: f.spec, formatId: f.id })),
  },
  {
    id: "hooks",
    title: "1枚目の文字・最初の一言(40)",
    items: HOOK_CATS.map((c) => ({ title: c, body: HOOKS[c].join("/") })),
  },
  {
    id: "templates",
    title: "文章テンプレート",
    items: CAPTION_TEMPLATES.map((t) => ({ title: t.name, body: t.spec })),
  },
  {
    id: "stories",
    title: "ストーリーズの型(10)",
    items: STORY_TYPES.map((s) => ({ body: s })),
  },
  {
    id: "hashtags",
    title: "ハッシュタグとキーワード",
    items: [
      {
        body: "Instagramは1投稿5個まで(2025年12月の公式発表)。内訳の目安:大1(#ハンドメイドアクセサリー #アクセサリー #ネックレス)+中2(#ビーズネックレス #ハンドメイドネックレス #ビーズアクセサリー #ガラスビーズ)+小1(#星モチーフ #カラフルアクセ #ビーズ好き)+自社1(#740NLL)。2週間ごとに入れ替えて比べる。",
      },
      { body: "ハッシュタグでは届く範囲は増えない(分類の手がかり)。効くのは名前・プロフィール・文章・代替テキストの言葉。" },
      { body: "TikTokは文章・画面の文字・声から検索語を拾う。1投稿にキーワード1つを3か所に。詰め込みはスパム扱い。" },
      { body: "検索で実際に使われた語:ビーズネックレス(最重要)/差し色ネックレス/プチプラ アクセサリー/ビーズアクセ/ウィメンズ ネックレス" },
    ],
  },
  {
    id: "shoot",
    title: "撮る前チェック(10)",
    items: SHOOT_CHECKS.map((s) => ({ body: s })),
  },
  {
    id: "postcheck",
    title: "投稿前チェック(10)",
    items: POST_CHECKS.map((s) => ({ body: s })),
  },
  {
    id: "slides",
    title: "写真スライドの並べ方",
    items: [...SLIDE_ORDER.map((s) => ({ body: s })), { body: SLIDE_NOTE }],
  },
  {
    id: "calendar",
    title: "季節カレンダー(2026年11月〜2027年4月)",
    items: SEASON_EVENTS.map((e) => ({ title: `${e.name}(${e.date})`, body: `${e.idea} / 投稿開始:${e.startLabel}` })),
  },
  {
    id: "pillars",
    title: "投稿の柱(目安)",
    items: [
      {
        body: "着る(コーデ)40% / 買える(新作・告知)20%(告知は週1本まで、12月は30%まで)/ しおんの日常 20% / 知る(Q&A・お手入れ・長さ)20%。作っている過程はストーリーズへ。",
      },
    ],
  },
  {
    id: "donts",
    title: "やってはいけない(10)",
    items: [
      "1枚目を商品だけにする",
      "1枚目に文字を入れない",
      "検索語を入れずに雰囲気だけで書く",
      "値段・長さ・買い方・日時を書かない",
      "他ブランドを誤認させる書き方",
      "お客さんの写真を許可なく載せる",
      "著作権のある音源を商用アカウントで自由に使う(商用ライブラリで確認)",
      "「絶対似合う」など断定の診断",
      "ストーリーズを使わずフィードだけに頼る",
      "同じ文章の使い回しを量産する",
    ].map((s) => ({ body: s })),
  },
  {
    id: "routine",
    title: "毎日のルーティン(目安45分)",
    items: [
      { body: "ストーリーズ1〜2枚(5分)" },
      { body: "コメント・DM返信(10分)" },
      { body: "アイデアを1つ以上アイデア箱へ(10分)" },
      { body: "投稿日は仕上げと投稿、そうでない日は台本(15分)" },
      { body: "数字を入れる(5分)" },
      { body: "撮影は週1回まとめて(制作中に手元を撮る)。" },
      { body: "注文が入ったら「どこで知りましたか?」を聞いて、受注アプリの「どこから来た注文?」を押す。" },
    ],
  },
];
