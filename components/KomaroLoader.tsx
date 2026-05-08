import Image from "next/image";

const LETTERS = ["K", "O", "M", "A", "R", "O"];

export function KomaroLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Image
        src="/komaro-logo.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 object-contain opacity-70"
      />
      <div className="flex items-end gap-[1px]">
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            className="komaro-letter text-lg font-bold text-gray-700 tracking-tight select-none"
            style={{ animationDelay: `${i * 110}ms` }}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
