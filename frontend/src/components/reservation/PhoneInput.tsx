import { formatPhoneDisplay } from "../../utils/phone";

type PhoneInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export default function PhoneInput({ label, value, onChange, error }: PhoneInputProps) {
  const displayValue = formatPhoneDisplay(value);

  return (
    <label className="block space-y-2">
      <span className="text-lg font-medium">{label}</span>
      <input
        type="tel"
        inputMode="numeric"
        className="h-12 w-full rounded-md border border-slate-300 px-4 text-lg"
        value={displayValue}
        onChange={(event) => onChange(event.target.value)}
        placeholder="+1 514 555 1234"
        autoComplete="off"
      />
      {error ? <span className="text-red-600 text-sm">{error}</span> : null}
    </label>
  );
}
