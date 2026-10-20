import type { FontInfo } from "./types";

/**
 * Make the fonts bundled with the application available to the page. They
 * are downloaded from the local server only when first used.
 */
export function registerFonts(fonts: FontInfo[]): void {
  for (const font of fonts) {
    document.fonts.add(new FontFace(font.name, `url("${font.regular}")`, { weight: "400" }));
    // Fonts with a single weight are made bold by the browser when needed.
    if (font.bold) document.fonts.add(new FontFace(font.name, `url("${font.bold}")`, { weight: "700" }));
  }
}
