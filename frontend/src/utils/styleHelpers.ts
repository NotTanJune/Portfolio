/**
 * Factory functions for common interactive style handlers.
 * Eliminates repeated onMouseEnter/onMouseLeave/onFocus/onBlur boilerplate.
 */

type StyleMap = Record<string, string>;

/**
 * Returns onMouseEnter, onMouseLeave, onFocus, onBlur handlers
 * that toggle CSS properties on the event's currentTarget.
 *
 * Usage:
 *   <button {...hoverStyleHandlers(
 *     { backgroundColor: colors.mainBg },
 *     { backgroundColor: colors.transparentBg }
 *   )}>
 */
export function hoverStyleHandlers(
  hoverStyles: StyleMap,
  defaultStyles: StyleMap
) {
  const apply = (e: React.SyntheticEvent, styles: StyleMap) => {
    const el = e.currentTarget as HTMLElement;
    for (const [key, value] of Object.entries(styles)) {
      (el.style as any)[key] = value;
    }
  };
  return {
    onMouseEnter: (e: React.MouseEvent) => apply(e, hoverStyles),
    onMouseLeave: (e: React.MouseEvent) => apply(e, defaultStyles),
    onFocus: (e: React.FocusEvent) => apply(e, hoverStyles),
    onBlur: (e: React.FocusEvent) => apply(e, defaultStyles),
  };
}

/**
 * Returns onFocus/onBlur handlers for form inputs that show a
 * focus ring (border color + box-shadow).
 *
 * Usage:
 *   <input {...inputFocusHandlers(colors.accentText, colors.accentHover, colors.borderColor)} />
 */
export function inputFocusHandlers(
  accentColor: string,
  hoverColor: string,
  borderColor: string
) {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.target.style.borderColor = accentColor;
      e.target.style.boxShadow = `0 0 0 3px ${hoverColor}`;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.target.style.borderColor = borderColor;
      e.target.style.boxShadow = 'none';
    },
  };
}
