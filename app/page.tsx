import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FadeInSection } from "@/components/FadeInSection";

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* Hero — 2-column on desktop */}
      <section className="bg-white py-16 sm:py-24 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left: copy */}
            <div>
              <p
                className="anim-hero text-xs tracking-[0.2em] text-gray-400 uppercase mb-8"
                style={{ animationDelay: "0ms" }}
              >
                Schedule Coordination
              </p>
              <h1
                className="anim-hero text-5xl sm:text-6xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-8"
                style={{ animationDelay: "120ms" }}
              >
                コマで見る、<br />日程調整。
              </h1>
              <p
                className="anim-hero text-sm sm:text-lg text-gray-500 mb-12 leading-relaxed"
                style={{ animationDelay: "260ms" }}
              >
                誰がいつ空いているか、コマの色で一発確認。<br />
                登録不要、URLを送るだけで使えます。
              </p>
              <div
                className="anim-hero"
                style={{ animationDelay: "400ms" }}
              >
                <Link
                  href="/create"
                  className="inline-flex items-center gap-3 bg-gray-900 text-white font-medium px-8 py-4 rounded-md hover:bg-gray-700 transition-colors text-base"
                >
                  イベントを作成する
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>

            {/* Right: demo preview — desktop only */}
            <div
              className="hidden lg:block anim-hero"
              style={{ animationDelay: "200ms" }}
            >
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
                <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2 bg-gray-50/60">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">ミーティングの日程調整</span>
                </div>
                <div className="p-5 overflow-x-auto">
                  <DemoTable />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Demo — mobile only (desktop sees it in the hero) */}
      <section className="lg:hidden bg-white py-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-xs tracking-[0.2em] text-gray-400 uppercase mb-10">Preview</p>
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">ミーティングの日程調整</span>
                </div>
                <div className="p-5 overflow-x-auto">
                  <DemoTable />
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-xs tracking-[0.2em] text-gray-400 uppercase mb-10">Features</p>
          </FadeInSection>
          <div className="grid sm:grid-cols-3 gap-12">
            {[
              { num: "01", title: "全員の都合が、ひと目でわかる", desc: "コマを参加人数で色分け。「ここが一番集まれる」が一目瞭然です。" },
              { num: "02", title: "登録不要・URL共有のみ", desc: "アカウント作成なし。URLを送るだけで回答を集められます。" },
              { num: "03", title: "カレンダー連携", desc: "確定した日程をGoogle・Yahoo・iCloudなど各カレンダーに直接追加できます。" },
            ].map((f, i) => (
              <FadeInSection key={f.num} delay={i * 100}>
                <p className="text-xs text-gray-300 font-mono mb-4">{f.num}</p>
                <h3 className="font-bold text-gray-900 text-base mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 tracking-tight">さっそく使ってみる</h2>
            <p className="text-sm sm:text-base text-gray-500 mb-8">無料・会員登録不要で今すぐ始められます。</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-3 bg-gray-900 text-white font-medium px-8 py-4 rounded-md hover:bg-gray-700 transition-colors text-base"
            >
              イベントを作成する
              <ArrowRight size={18} />
            </Link>
          </FadeInSection>
        </div>
      </section>

    </div>
  );
}

function DemoTable() {
  const cols = ["5/7(水)", "5/8(木)", "5/9(金)"];
  const rows = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
  const data = [
    [4,  8,  10],
    [7,  10, 6],
    [3,  5,  8],
    [5,  6,  10],
    [10, 7,  4],
    [3,  10, 9],
    [8,  5,  7],
  ];
  const max = 10;

  function cellColor(v: number) {
    const r = v / max;
    if (r <= 0.25) return "bg-gray-100 text-gray-600";
    if (r <= 0.5)  return "bg-gray-200 text-gray-700";
    if (r <= 0.75) return "bg-gray-400 text-white";
    if (r < 1)     return "bg-gray-600 text-white";
    return "bg-red-600 text-white";
  }

  return (
    <table className="border-collapse text-sm w-full">
      <thead>
        <tr>
          <th className="bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-400 w-14" />
          {cols.map((c) => (
            <th key={c} className="bg-gray-50 border border-gray-100 px-4 py-2 text-xs font-semibold text-gray-500 text-center">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={r}>
            <td className="bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-medium text-gray-500 whitespace-nowrap">{r}</td>
            {data[ri].map((v, ci) => (
              <td key={ci} className={`border border-gray-100 text-center font-semibold w-12 h-10 text-xs ${cellColor(v)}`}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
