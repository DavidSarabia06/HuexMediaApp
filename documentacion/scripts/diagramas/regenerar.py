"""Regenera los PNG y SVG ajustando el texto al espacio real de cada cuadro."""

from pathlib import Path
import html
import os


def install_layout(scope):
    rectangles = []
    labels = []
    original_rectangle = scope["rect"]
    draw = scope["d"]
    svg = scope["svg"]
    make_font = scope["font"]
    width, height = scope["W"], scope["H"]

    def rectangle(x, y, w, h, fill, stroke=None, r=18):
        rectangles.append((x, y, w, h))
        original_rectangle(x, y, w, h, fill, stroke, r)

    def text(x, y, value, size=26, color="#DCE7F2", bold=False):
        labels.append((x, y, [value], size, color, bold, None))

    def lines(x, y, values, size=25, color="#DCE7F2", gap=36, bold=False):
        labels.append((x, y, values, size, color, bold, gap))

    def container(x, y):
        candidates = [box for box in rectangles
                      if box[0] <= x < box[0] + box[2] and box[1] <= y < box[1] + box[3]]
        return min(candidates, key=lambda box: box[2] * box[3]) if candidates else (0, 0, width, height)

    def length(value, size, bold):
        return draw.textlength(value, font=make_font(size, bold))

    def wrap(value, size, bold, available):
        result = []
        current = ""
        for word in value.split(" "):
            candidate = (current + " " + word).strip()
            if current and length(candidate, size, bold) > available:
                result.append(current)
                current = word
            else:
                current = candidate
            # Long identifiers are split only when they cannot fit on one line.
            while length(current, size, bold) > available:
                split = len(current) - 1
                while split > 1 and length(current[:split], size, bold) > available:
                    split -= 1
                result.append(current[:split])
                current = current[split:]
        result.append(current)
        return result

    def paint(x, y, value, size, color, bold):
        face = make_font(size, bold)
        draw.text((x, y), value, font=face, fill=color)
        # Use the actual font ascent rather than the font size for the SVG baseline.
        baseline = y + face.getmetrics()[0]
        svg.append(f'<text x="{x}" y="{baseline}" font-family="Segoe UI,Arial,sans-serif" '
                   f'font-size="{size}" font-weight="{700 if bold else 400}" '
                   f'fill="{color}">{html.escape(value)}</text>')

    def render():
        adjusted = 0
        for x, y, values, requested, color, bold, gap in labels:
            box = container(x, y)
            right = box[0] + box[2] - 18
            bottom = box[1] + box[3] - (4 if gap is None else 14)
            available = right - x
            # Keep a group clear of another label directly beneath it in the same box.
            following = [item[1] for item in labels
                         if item[1] > y and abs(item[0] - x) < 8 and container(item[0], item[1]) == box]
            if following:
                bottom = min(bottom, min(following) - 8)
            selected = None
            if gap is None:
                # Titles stay on one line; shrink only when their measured width requires it.
                for size in range(requested, 11, -1):
                    bounds = draw.textbbox((x, y), values[0], font=make_font(size, bold))
                    if length(values[0], size, bold) <= available and bounds[3] <= bottom:
                        selected = (size, values, 0)
                        break
            else:
                # Prefer readable wrapped body text; reduce font size only if height requires it.
                for size in range(requested, 15, -1):
                    wrapped = []
                    for value in values:
                        wrapped.extend(wrap(value, size, bold, available))
                    line_gap = min(gap, size + 8)
                    last_y = y + (len(wrapped) - 1) * line_gap
                    bounds = draw.textbbox((x, last_y), wrapped[-1], font=make_font(size, bold))
                    if bounds[3] <= bottom:
                        selected = (size, wrapped, line_gap)
                        break
            if selected is None:
                raise ValueError(f'Texto sin espacio: {values!r} dentro de {box}')
            size, content, line_gap = selected
            if size != requested or content != values:
                adjusted += 1
            for index, value in enumerate(content):
                paint(x, y + index * line_gap, value, size, color, bold)
        return adjusted

    scope.update(rect=rectangle, text=text, lines=lines, _render_text=render)


def main():
    directory = Path(__file__).resolve().parent
    os.chdir(directory.parents[2])
    count = 0
    for source in sorted(directory.glob("draw-video*.py")):
        code = source.read_text(encoding="utf-8-sig")
        # All source diagrams define their drawing helpers before the first title.
        split = code.index("\ntext(")
        scope = {}
        exec(compile(code[:split], str(source), "exec"), scope)
        install_layout(scope)
        body = code[split:].replace("im.save(", "_render_text()\nim.save(")
        exec(compile(body, str(source), "exec"), scope)
        count += 1
    print(f"OK: {count} esquemas PNG y SVG regenerados; textos contenidos en sus cuadros.")


if __name__ == "__main__":
    main()
