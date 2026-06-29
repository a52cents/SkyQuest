type ErrorStateProps = {
  message: string;
  tone?: "info" | "warning" | "error";
};

export function ErrorState({ message, tone = "error" }: ErrorStateProps) {
  const color = tone === "info" ? "border-[#38d5ff]/25 bg-[#38d5ff]/10 text-[#c9f4ff]" :
    tone === "warning" ? "border-[#ffd166]/25 bg-[#ffd166]/10 text-[#ffe3a3]" :
    "border-[#ff6b8a]/25 bg-[#ff6b8a]/10 text-[#ffd2dc]";

  return <div className={`mb-4 rounded-[22px] border p-4 text-sm leading-6 ${color}`}>{message}</div>;
}
