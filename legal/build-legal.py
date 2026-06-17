#!/usr/bin/env python3
"""Build styled HTML legal pages from the markdown source in this folder.

The .md files are the source of truth. Run this whenever they change:

    python legal/build-legal.py

Output: terms.html, privacy.html, dpa.html, subprocessors.html,
acceptable-use.html in this same folder. Netlify serves /legal/terms.html at
/legal/terms, which matches the cross-links baked into the documents.
"""
import html
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent

# slug -> markdown file. Slug doubles as the output .html name and URL path.
PAGES = {
    "terms": "terms.md",
    "privacy": "privacy.md",
    "dpa": "dpa.md",
    "subprocessors": "subprocessors.md",
    "acceptable-use": "acceptable-use.md",
}

# Short labels for the cross-page footer nav.
NAV = [
    ("terms", "Terms of Service"),
    ("privacy", "Privacy Policy"),
    ("dpa", "Data Processing Addendum"),
    ("subprocessors", "Sub-processors"),
    ("acceptable-use", "Acceptable Use"),
]

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title} &middot; Atlas for Real Estate</title>
<link rel="icon" type="image/png" href="/favicon.png" />
<meta name="description" content="{title} for Atlas for Real Estate by Agent Atlas." />
<style>
  :root{{
    --bg:#0d0f16;--panel:#171b27;--panel-2:#1d2230;--line:#2a3040;
    --ink:#eef1f7;--muted:#a6adbd;--faint:#7d8597;
    --brand:#7c5cff;--brand-2:#2bb6b0;
    --accent-grad:linear-gradient(100deg,#7c5cff 0%,#2bb6b0 100%);
  }}
  *{{box-sizing:border-box}}
  body{{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.7;-webkit-font-smoothing:antialiased;}}
  .wrap{{max-width:780px;margin:0 auto;padding:40px 24px 96px}}
  .topbar{{display:flex;justify-content:space-between;align-items:center;gap:16px;
    padding:18px 0;border-bottom:1px solid var(--line);margin-bottom:36px;flex-wrap:wrap}}
  .brand{{font-weight:800;letter-spacing:-.01em;color:var(--ink);text-decoration:none;font-size:1.02rem}}
  .brand span{{background:var(--accent-grad);-webkit-background-clip:text;background-clip:text;color:transparent}}
  .back{{color:var(--faint);text-decoration:none;font-size:.92rem}}
  .back:hover{{color:var(--ink)}}
  h1{{font-size:clamp(1.7rem,4vw,2.3rem);line-height:1.15;margin:0 0 8px;font-weight:800;letter-spacing:-.02em}}
  h2{{font-size:1.28rem;margin:40px 0 12px;font-weight:700;letter-spacing:-.01em;
    padding-top:14px;border-top:1px solid var(--line)}}
  h3{{font-size:1.05rem;margin:26px 0 8px;font-weight:700;color:var(--ink)}}
  p{{margin:0 0 16px;color:var(--muted)}}
  a{{color:var(--brand-2)}}
  a:hover{{color:var(--brand)}}
  strong{{color:var(--ink);font-weight:700}}
  ul{{margin:0 0 16px;padding-left:22px;color:var(--muted)}}
  li{{margin:0 0 9px}}
  code{{background:#0e1018;border:1px solid var(--line);border-radius:6px;
    padding:1px 6px;font-size:.9em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#cfd6e6}}
  hr{{border:0;border-top:1px solid var(--line);margin:40px 0}}
  blockquote{{margin:0 0 28px;padding:16px 20px;background:var(--panel);
    border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:10px;color:var(--muted)}}
  blockquote p{{margin:0}}
  table{{width:100%;border-collapse:collapse;margin:0 0 22px;font-size:.93rem}}
  th,td{{text-align:left;padding:10px 12px;border:1px solid var(--line);vertical-align:top;color:var(--muted)}}
  th{{background:var(--panel-2);color:var(--ink);font-weight:700}}
  .effective{{color:var(--faint);font-size:.95rem;margin:0 0 24px}}
  footer{{margin-top:56px;padding-top:24px;border-top:1px solid var(--line);
    color:var(--faint);font-size:.9rem}}
  footer .legalnav{{display:flex;flex-wrap:wrap;gap:8px 18px;margin-bottom:14px}}
  footer a{{color:var(--faint);text-decoration:none}}
  footer a:hover{{color:var(--ink)}}
  footer a.current{{color:var(--ink);font-weight:600}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <a class="brand" href="/">Agent <span>Atlas</span></a>
      <a class="back" href="/">&larr; Back to agent-atlas.co</a>
    </div>
    {body}
    <footer>
      <div class="legalnav">{nav}</div>
      <div>&copy; 2026 Agent Atlas &middot; Richmond, Virginia, USA &middot; <a href="mailto:atlas@agent-atlas.co">atlas@agent-atlas.co</a></div>
    </footer>
  </div>
</body>
</html>
"""


def inline(text):
    """Render inline markdown (escape, code, links, bold) to HTML."""
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", lambda m: "<code>" + m.group(1) + "</code>", text)
    text = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: '<a href="' + m.group(2) + '">' + m.group(1) + "</a>",
        text,
    )
    text = re.sub(r"\*\*([^*]+)\*\*", lambda m: "<strong>" + m.group(1) + "</strong>", text)
    return text


def render(md):
    lines = md.split("\n")
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Horizontal rule (standalone, not a table separator)
        if stripped == "---":
            out.append("<hr />")
            i += 1
            continue

        # Headings
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1:
                out.append("<h1>" + inline(text) + "</h1>")
            else:
                out.append("<h{0}>{1}</h{0}>".format(level, inline(text)))
            i += 1
            continue

        # Blockquote (one or more consecutive "> " lines = one paragraph)
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            joined = " ".join(s.strip() for s in buf if s.strip())
            out.append("<blockquote><p>" + inline(joined) + "</p></blockquote>")
            continue

        # Table (consecutive lines starting with "|")
        if stripped.startswith("|"):
            tbl = []
            while i < n and lines[i].strip().startswith("|"):
                tbl.append(lines[i].strip())
                i += 1

            def cells(row):
                parts = row.strip().strip("|").split("|")
                return [c.strip() for c in parts]

            header = cells(tbl[0])
            body_rows = [r for r in tbl[2:]]  # skip header + separator
            t = ["<table>", "<thead><tr>"]
            t += ["<th>" + inline(c) + "</th>" for c in header]
            t.append("</tr></thead><tbody>")
            for r in body_rows:
                t.append("<tr>" + "".join("<td>" + inline(c) + "</td>" for c in cells(r)) + "</tr>")
            t.append("</tbody></table>")
            out.append("".join(t))
            continue

        # Unordered list (items may wrap onto indented continuation lines)
        if re.match(r"^\s*-\s+", line):
            items = []
            while i < n and (re.match(r"^\s*-\s+", lines[i]) or
                             (lines[i].startswith("  ") and lines[i].strip() and
                              not lines[i].strip().startswith("|"))):
                if re.match(r"^\s*-\s+", lines[i]):
                    items.append(re.sub(r"^\s*-\s+", "", lines[i]).rstrip())
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            li = "".join("<li>" + inline(x) + "</li>" for x in items)
            out.append("<ul>" + li + "</ul>")
            continue

        # Paragraph (consecutive plain lines joined with spaces)
        buf = []
        while i < n:
            cur = lines[i]
            s = cur.strip()
            if (not s or s == "---" or s.startswith("#") or s.startswith(">")
                    or s.startswith("|") or re.match(r"^\s*-\s+", cur)):
                break
            buf.append(s)
            i += 1
        para = " ".join(buf)
        # Render the "Effective date:" line a bit quieter.
        if para.startswith("**Effective date:") or para.startswith("**Last updated:"):
            out.append('<p class="effective">' + inline(para) + "</p>")
        else:
            out.append("<p>" + inline(para) + "</p>")

    return "\n    ".join(out)


def nav_html(current):
    bits = []
    for slug, label in NAV:
        cls = ' class="current"' if slug == current else ""
        bits.append('<a{0} href="/legal/{1}">{2}</a>'.format(cls, slug, label))
    return "".join(bits)


def main():
    for slug, fname in PAGES.items():
        md = (HERE / fname).read_text(encoding="utf-8")
        title = "Legal"
        m = re.search(r"^#\s+(.*)$", md, re.MULTILINE)
        if m:
            title = m.group(1).strip()
        body = render(md)
        page = TEMPLATE.format(title=html.escape(title), body=body, nav=nav_html(slug))
        (HERE / (slug + ".html")).write_text(page, encoding="utf-8")
        print("wrote", slug + ".html")


if __name__ == "__main__":
    main()
