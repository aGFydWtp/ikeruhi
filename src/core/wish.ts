// 要望（自由記述）から好きな曜日だけを拾う。MVPは単語の一致だけ。
const WORDS: Array<[RegExp, number[]]> = [
  [/週末|土日/, [0, 6]],
  [/平日/, [1, 2, 3, 4, 5]],
  [/日曜|日よう|(?<![0-9０-９月])日(?=[、,・／/ ]|曜|$)/, [0]],
  [/月曜|月よう/, [1]],
  [/火曜|火よう|火(?=[、,・／/ ]|$)/, [2]],
  [/水曜|水よう|水(?=[、,・／/ ]|$)/, [3]],
  [/木曜|木よう|木(?=[、,・／/ ]|$)/, [4]],
  [/金曜|金よう|花金|金(?=[、,・／/ ]|$)/, [5]],
  [/土曜|土よう|土(?=[、,・／/ ]|$)/, [6]],
];

export function preferredWeekdays(text: string | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!text) return out;
  for (const [re, days] of WORDS) {
    if (re.test(text)) days.forEach((d) => out.add(d));
  }
  return out;
}
