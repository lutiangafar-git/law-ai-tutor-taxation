"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
};

export function AnswerBox({
  value,
  onChange,
  maxLength,
  disabled,
  label = "Your answer",
  placeholder = "Type in English, Filipino, or Taglish…",
}: Props) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea
        className="min-h-32 w-full rounded-md border border-line bg-white px-3 py-2 text-base leading-relaxed text-ink outline-none ring-accent focus:ring-2"
        value={value}
        maxLength={maxLength + 50}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="block text-right text-xs text-muted">
        {value.trim().length}/{maxLength}
      </span>
    </label>
  );
}
