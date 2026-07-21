const orders = [
  { customer: "大士郎", type: "ネックレス", design: "シンプルでも個性出せるお任せ", length: "", payment: "" },
  { customer: "まゆまま", type: "ネックレス", design: "赤×ネイビー", length: "", payment: "" },
  { customer: "菅", type: "ネックレス", design: "黄緑×黄色、黄色ちょこちょこ", length: "", payment: "" },
  { customer: "こうめ", type: "ネックレス", design: "ピンク×黄色（ゆうたくん）", length: "", payment: "" },
  { customer: "こうめ", type: "ネックレス", design: "赤×星（こうめ）", length: "", payment: "" },
  { customer: "あいみ", type: "ネックレス", design: "茶×ターコイズ×真ん中に二つ金", length: "", payment: "" },
  { customer: "いぶきさん", type: "ネックレス", design: "シルバーメイン真ん中渦のパーツ×色", length: "41", payment: "" },
  { customer: "いぶきさん", type: "ブレスレット", design: "小豆色メインに似合う色", length: "16.5", payment: "" },
  { customer: "オレ", type: "ネックレス", design: "黒メイン少しシルバー真ん中⭐️", length: "39", payment: "" },
  { customer: "あさひくん", type: "ネックレス", design: "黒赤黄色緑×ゴールド、dm写真あり", length: "39", payment: "" },
  { customer: "2_0nst", type: "ネックレス", design: "黒メインエンジ色真ん中星", length: "36", payment: "" },
  { customer: "りおちゃん", type: "ネックレス", design: "透明シルバー×赤", length: "36", payment: "" },
  { customer: "りおちゃん", type: "ネックレス", design: "透明シルバー×ターコイズ×青真ん中星", length: "36", payment: "" },
  { customer: "りおちゃん", type: "ブレスレット", design: "シルバー×星", length: "16", payment: "" },
  { customer: "りおちゃん", type: "ブレスレット", design: "シルバー×黒 ×2", length: "20〜21", payment: "" },
  { customer: "みゆちゃん", type: "ネックレス", design: "インスタdm", length: "", payment: "" },
  { customer: "_tiis5", type: "ネックレス", design: "透明シルバー×水色ぽい青", length: "40〜41", payment: "" },
  { customer: "たいよう", type: "ブレスレット", design: "透明茶色×ゴールド真ん中", length: "18", payment: "" },
  { customer: "bfigctvejst", type: "ネックレス", design: "黒×星", length: "37", payment: "" },
  { customer: "あやな", type: "ネックレス", design: "ピンク×ゴールド、dm写真", length: "36", payment: "" },
  { customer: "おざき", type: "ネックレス", design: "ターコイズ×星", length: "", payment: "" },
  { customer: "おざき", type: "ブレスレット", design: "", length: "40", payment: "" },
  { customer: "莉斗", type: "ネックレス", design: "黒×シルバー", length: "39", payment: "" },
];

const now = Date.now();
const result = orders.map((o, i) => ({
  id: `o_${now + i}`,
  created: now + i,
  status: "制作中",
  memo: "",
  design: "",
  adjuster: "",
  ...o,
}));

console.log(JSON.stringify(result));
