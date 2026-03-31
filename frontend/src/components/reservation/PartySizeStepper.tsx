import { useState, useEffect } from "react";

type PartySizeStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export default function PartySizeStepper({
  value,
  onChange,
  min = 1,
  max = 50,
}: PartySizeStepperProps) {
  // Use a local string state to allow users to clear the input while typing (e.g. to type "23" instead of "1")
  const [inputValue, setInputValue] = useState(value.toString());

  // Sync with parent value if it changes externally
  useEffect(() => {
    if (parseInt(inputValue) !== value) {
      setInputValue(value.toString());
    }
  }, [value]);

  const handleManualChange = (valStr: string) => {
    // Only allow digits
    const cleaned = valStr.replace(/\D/g, "");
    setInputValue(cleaned);

    if (cleaned !== "") {
      const parsed = parseInt(cleaned);
      if (parsed >= 1 && parsed <= max) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    let parsed = parseInt(inputValue);
    if (isNaN(parsed) || parsed < min) {
      parsed = min;
    } else if (parsed > max) {
      parsed = max;
    }
    setInputValue(parsed.toString());
    onChange(parsed);
  };

  const decrement = () => {
    const next = Math.max(min, value - 1);
    setInputValue(next.toString());
    onChange(next);
  };

  const increment = () => {
    const next = Math.min(max, value + 1);
    setInputValue(next.toString());
    onChange(next);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className="h-12 w-12 rounded-xl bg-slate-100 text-slate-900 border border-slate-200 text-2xl font-light hover:bg-slate-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        onClick={decrement}
        disabled={value <= min}
      >
        −
      </button>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="text-3xl font-bold w-20 text-center bg-transparent border-b-2 border-slate-300 focus:border-slate-900 outline-none transition-all mx-1 h-12"
          value={inputValue}
          onChange={(e) => handleManualChange(e.target.value)}
          onBlur={handleBlur}
        />
      </div>
      <button
        type="button"
        className="h-12 w-12 rounded-xl bg-slate-900 text-white text-2xl font-light hover:bg-slate-800 transition-colors shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
        onClick={increment}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
