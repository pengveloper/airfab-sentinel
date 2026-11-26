"""Writes the GitHub Pages site that forwards the old demo addresses to wavrel.com."""
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
PAGES = {
    "": "https://wavrel.com/demo/",
    "privacy/": "https://wavrel.com/privacy/",
}
TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Wavrel moved</title>
<link rel="canonical" href="{to}">
<meta http-equiv="refresh" content="0; url={to}">
<script>location.replace({to!r} + location.search + location.hash)</script>
</head>
<body>
<p>This page moved to <a href="{to}">{to}</a>.</p>
<p lang="ko">이 페이지는 <a href="{to}">{to}</a>로 옮겼습니다.</p>
</body>
</html>
"""
for path, to in PAGES.items():
    d = out / path
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(TEMPLATE.format(to=to), encoding="utf-8")
(out / "404.html").write_text(TEMPLATE.format(to="https://wavrel.com/"), encoding="utf-8")
(out / ".nojekyll").touch()
print("pages: redirects to wavrel.com written")
