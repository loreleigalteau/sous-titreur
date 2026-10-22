import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A small "i" button showing an explanation in a bubble. The bubble opens on
 * hover, and also on click or keyboard focus, so it works with a touch screen
 * or without a mouse. Escape or a click elsewhere closes it.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className="infotip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="infotip-button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        // Opening only (no toggle): a click also focuses the button, which
        // already opened it. Escape or a click elsewhere closes it.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          // Close when the keyboard moves on to another element, but not when
          // the user clicks in the bubble (e.g. to select the text).
          const next = event.relatedTarget;
          if (next && !root.current?.contains(next)) setOpen(false);
        }}
      >
        i
      </button>
      <span role="tooltip" id={id} className="infotip-bubble" hidden={!open}>
        {children}
      </span>
    </span>
  );
}
