"""Add layout hooks without reserializing the legacy HTML or changing its copy."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


class Tables(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = [0]
        for m in re.finditer('\n', source):
            self.lines.append(m.end())
        self.stack = []
        self.tables = []

    def handle_starttag(self, tag, attrs):
        offset = self.lines[self.getpos()[0] - 1] + self.getpos()[1]
        if tag == 'table':
            table = {'start': offset, 'tag': self.get_starttag_text(),
                     'attrs': dict(attrs), 'rows': [], 'root': not self.stack}
            self.tables.append(table)
            self.stack.append(table)
        elif tag == 'tr' and self.stack:
            self.stack[-1]['rows'].append({'start': offset, 'cells': []})
        elif tag in ('td', 'th') and self.stack and self.stack[-1]['rows']:
            self.stack[-1]['rows'][-1]['cells'].append(dict(attrs))

    def handle_endtag(self, tag):
        if tag == 'table' and self.stack:
            table = self.stack.pop()
            table['end'] = self.lines[self.getpos()[0] - 1] + self.getpos()[1] + len('</table>')


def add_class(tag, classes):
    match = re.search(r'class="([^"]*)"', tag)
    existing = match[1].split() if match else []
    combined = ' '.join(existing + [c for c in classes if c not in existing])
    if match:
        return tag[:match.start(1)] + combined + tag[match.end(1):]
    return tag[:-1] + ' class="' + combined + '">'


def adapt(path):
    raw = path.read_bytes()
    source = raw.decode('utf-8').replace('\r\n', '\n')
    if path.stem in ('index', 'wap'):
        return False
    special = path.stem in ('pop', 'qp', 'sgd')
    if not special:
        parser = Tables(source)
        parser.feed(source)
        changes = []
        for table in parser.tables:
            if not table['root'] or 'end' not in table:
                continue
            body = source[table['start']:table['end']]
            attrs = table['attrs']
            rows = table['rows']
            cells = rows[0]['cells'] if rows else []
            classes = ['m-fluid']
            if 'class="user-info' in body:
                classes.append('m-post')
            elif 'LongTeng BBS' in body and 'height="80"' in body:
                classes.append('m-masthead')
            elif len(cells) == 9 and '短信箱' in body:
                classes.append('m-nav')
            elif 'Guest' in body and '<marquee' in body:
                classes.append('m-welcome')
            elif len(cells) == 6 and '文章标题' in body:
                classes.append('m-topic-list')
            elif 'class="menu-box"' in body:
                classes.append('m-profile')
            elif path.stem == 'forum' and 'section' in attrs.get('class', ''):
                classes.append('m-forums')
            elif path.stem == 'archive' and 'section' in attrs.get('class', ''):
                classes.append('m-archive')
            elif len(rows) == 1 and len(cells) == 2 and attrs.get('width') == '980':
                classes.append('m-tools')
            new = add_class(table['tag'], classes)
            changes.append((table['start'], table['start'] + len(table['tag']), new))
        for start, end, replacement in reversed(changes):
            source = source[:start] + replacement + source[end:]
        body = re.search(r'<body\b[^>]*>', source)
        kind = 'page-home' if path.stem == '27' or path.stem == 'wanderer' or path.stem.startswith('tech-') else 'page-login' if path.stem == 'login' else 'page-forum'
        source = source[:body.start()] + add_class(body[0], ['retro-page', kind]) + source[body.end():]
        if 'href="mobile.css"' not in source:
            source = source.replace('</head>', '<link rel="stylesheet" href="mobile.css">\n</head>', 1)
    if not re.search(r'<meta\b[^>]*name=[\'\"]viewport[\'\"]', source, re.I):
        source = source.replace('</head>', '<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>', 1)
    if b'\r\n' in raw and raw.count(b'\r\n') == raw.count(b'\n'):
        source = source.replace('\n', '\r\n')
    if source.encode('utf-8') == raw:
        return False
    path.write_bytes(source.encode('utf-8'))
    return True


if __name__ == '__main__':
    print('Applied mobile layout to', sum(adapt(p) for p in ROOT.glob('*.html')), 'pages.')
