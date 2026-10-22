import type { CSSProperties } from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}

/**
 * Slider with the application's look (see `.slider` in styles.css).
 *
 * Browsers draw their default slider differently, and Chrome's leaves a
 * coloured part even at the minimum, which looks like the video has already
 * started. Here the coloured part is exactly the value: none at the start.
 */
export function Slider({ value, min, max, step, onChange, ...rest }: Props) {
  const fraction = max > min ? (value - min) / (max - min) : 0;
  const style = { "--fill": `${Math.min(1, Math.max(0, fraction)) * 100}%` } as CSSProperties;
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      step={step}
      value={value}
      style={style}
      onChange={(event) => onChange(Number(event.target.value))}
      {...rest}
    />
  );
}
