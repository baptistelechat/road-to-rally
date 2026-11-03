interface RangeFieldProps {
  id: string;
  label: string;
  value: number;
  max: number;
  min?: number;
  step: number;
  readout: string;
  disabled?: boolean;
  danger?: boolean;
  onChange: (value: number) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
}

export const RangeField = ({
  id,
  label,
  readout,
  danger = false,
  onChange,
  ...input
}: RangeFieldProps) => (
  <div className="flex-1">
    <label
      htmlFor={id}
      className="mb-2 flex justify-between font-mono text-sm tabular-nums"
    >
      <span>{label}</span>
      <span>{readout}</span>
    </label>
    <input
      id={id}
      type="range"
      onChange={(event) => onChange(Number(event.target.value))}
      className={`w-full disabled:opacity-40 ${danger ? "accent-red-500" : "accent-amber-400"}`}
      {...input}
    />
  </div>
);
