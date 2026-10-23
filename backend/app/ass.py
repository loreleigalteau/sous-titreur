"""ASS export (Advanced SubStation Alpha).

Unlike SRT and VTT, an ASS file carries the style: font, size, colours,
outline or box, position. It is meant for other software (VLC, Aegisub,
video editors). Our own video export does not use it (see render.py).

Other software draws the text itself, so the result is close to the preview
but not pixel-identical, and the font must be installed on that computer.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.karaoke import subtitle_frames
from app.models import Segment, Style
from app.srt import clean_text


def format_timestamp(seconds: float) -> str:
    """ASS timestamps: H:MM:SS.cc (hundredths of a second)."""
    total_cs = max(0, round(seconds * 100))
    hours, rest = divmod(total_cs, 360_000)
    minutes, rest = divmod(rest, 6_000)
    secs, cs = divmod(rest, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"


def ass_color(hex_color: str, opacity: float = 1.0) -> str:
    """'#rrggbb' to ASS '&HAABBGGRR' (blue first; alpha 00 = opaque)."""
    red, green, blue = hex_color[1:3], hex_color[3:5], hex_color[5:7]
    alpha = round((1 - opacity) * 255)
    return f"&H{alpha:02X}{blue}{green}{red}".upper()


def escape_text(text: str) -> str:
    # Braces start style codes in ASS and a backslash starts an escape such
    # as \N: they are replaced so that the text shows as typed.
    text = text.replace("\\", "⧵").replace("{", "(").replace("}", ")")
    return text.replace("\n", "\\N")


def highlighted(words: list[str], index: int, style: Style) -> str:
    """The words of a frame, the spoken one in its colour and size.

    {\\1c…} changes the colour, {\\fscx…\\fscy…} the size, {\\r} goes back
    to the normal style for the following words.
    """
    color = ass_color(style.highlight_color)[4:]  # without the alpha: &HBBGGRR
    scale = round(style.highlight_scale * 100)
    parts = [escape_text(w) for w in words]
    if 0 <= index < len(parts):
        parts[index] = f"{{\\1c&H{color}&\\fscx{scale}\\fscy{scale}}}{parts[index]}{{\\r}}"
    return " ".join(parts)


def segments_to_ass(segments: Iterable[Segment], style: Style, width: int, height: int) -> str:
    margin = round((1 - style.max_width) / 2 * width)
    if style.background:
        # Border style 3 draws a box; ASS uses the outline colour for it.
        border_style, outline_color = 3, ass_color(style.background_color, style.background_opacity)
        outline = max(style.size * height * 0.15, 1)  # padding around the text
    else:
        border_style, outline_color = 1, ass_color(style.outline_color)
        outline = style.outline_width * height
    fields = [
        "Default", style.font, f"{style.size * height:.0f}",
        ass_color(style.text_color), ass_color(style.highlight_color), outline_color, "&H00000000",
        "-1" if style.bold else "0", "0", "0", "0", "100", "100", "0", "0",
        str(border_style), f"{outline:.1f}", "0",
        "5",  # alignment 5: the position is the center of the text
        str(margin), str(margin), "0", "1",
    ]
    position = f"{{\\an5\\pos({style.x * width:.0f},{style.y * height:.0f})}}"

    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: " + ",".join(fields),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    word_by_word = style.highlight or style.max_words > 0
    for segment in segments:
        text = clean_text(segment.text)
        if not text:
            continue
        if word_by_word:
            # One line per moment: the words on screen, the spoken one highlighted.
            for frame in subtitle_frames(segment, style):
                lines.append(
                    f"Dialogue: 0,{format_timestamp(frame.start)},{format_timestamp(frame.end)},"
                    f"Default,,0,0,0,,{position}{highlighted(frame.words, frame.highlight, style)}"
                )
            continue
        end = max(segment.end, segment.start)
        lines.append(
            f"Dialogue: 0,{format_timestamp(segment.start)},{format_timestamp(end)},"
            f"Default,,0,0,0,,{position}{escape_text(text)}"
        )
    return "\n".join(lines) + "\n"
