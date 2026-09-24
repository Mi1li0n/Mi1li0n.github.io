"""Read forum utterances without rewriting or reformatting their HTML."""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def closing_tag(source, start, tag):
    depth = 0
    for match in re.finditer(r'</?' + tag + r'\b[^>]*>', source[start:], re.I):
        depth += -1 if match[0].startswith('</') else 1
        if depth == 0:
            return start + match.start(), start + match.end()
    raise ValueError(f'Unclosed {tag} at {start}')


def plain(source):
    source = re.sub(r'<br\s*/?>', ' / ', source, flags=re.I)
    return html.unescape(re.sub('<[^>]+>', '', source)).strip()


def extract():
    records = []
    for path in sorted(ROOT.glob('*.html')):
        source = path.read_text(encoding='utf-8')
        users = list(re.finditer(r'<td\b[^>]*class="user-info[^>]*>', source))
        posts = list(re.finditer(r'<td\b[^>]*class="post-bg"[^>]*>', source))
        assert len(users) == len(posts), path.name
        for index, (user, post) in enumerate(zip(users, posts), 1):
            user_end, _ = closing_tag(source, user.start(), 'td')
            user_html = source[user.end():user_end]
            name = re.search(r'<div\b[^>]*>(.*?)</div>', user_html, re.S)
            div = re.search(r'<div\b[^>]*>', source[post.end():])
            start = post.end() + div.start()
            begin = post.end() + div.end()
            end, _ = closing_tag(source, start, 'div')
            if 'notice-box' in div[0]:
                # The banner is followed by the actual moderator announcement.
                _, banner_end = closing_tag(source, start, 'div')
                div = re.search(r'<div\b[^>]*>', source[banner_end:])
                start = banner_end + div.start()
                begin = banner_end + div.end()
                end, _ = closing_tag(source, start, 'div')
            floor = re.search(r'(\d+)#', source[post.end():start])
            body = source[begin:end]
            records.append({
                'id': f'{path.stem}:{index}', 'file': path.name,
                'position': index, 'floor': int(floor[1]) if floor else index,
                'name': plain(name[1]),
                'start': begin, 'end': end, 'body': body, 'text': plain(body),
                'system': 'banned-msg' in div[0], 'kind': 'forum',
            })
    # Guestbook replies are separate utterances, not part of the visitor's voice.
    for filename, entry_class, body_class, reply_class, owner in [
        ('tech-guestbook.html', 'guest-entry', 'guest-body', 'guest-reply', '技术宅'),
        ('wanderer.html', 'guest', None, 'reply', '编程浪子'),
    ]:
        source = (ROOT / filename).read_text(encoding='utf-8')
        for index, entry in enumerate(re.finditer(r'<div class="' + entry_class + '">', source), 1):
            entry_end, _ = closing_tag(source, entry.start(), 'div')
            chunk = source[entry.end():entry_end]
            if body_class:
                title = re.search(r'<div class="guest-title">(.*?)</div>', chunk, re.S)[1]
                name = plain(re.search(r'<a\b[^>]*>(.*?)</a>', title, re.S)[1])
                body = re.search(r'<div class="' + body_class + '">', chunk)
                begin = entry.end() + body.end()
                end, _ = closing_tag(source, entry.end() + body.start(), 'div')
            else:
                name = plain(re.search(r'<b>(.*?)</b>', chunk, re.S)[1])
                begin = entry.end() + re.search(r'</small><br>', chunk).end()
                end = entry_end
            reply = re.search(r'<div class="' + reply_class + '">', source[begin:end])
            reply_start = begin + reply.start() if reply else None
            if reply:
                reply_begin = begin + reply.end()
                reply_end, _ = closing_tag(source, reply_start, 'div')
                # Leave the visible attribution outside the editable content.
                reply_begin += source[reply_begin:reply_end].index('：') + 1
                records.append({'id': f'{Path(filename).stem}:reply-{index}',
                    'file': filename, 'position': index, 'floor': index,
                    'name': owner, 'start': reply_begin, 'end': reply_end,
                    'body': source[reply_begin:reply_end], 'text': plain(source[reply_begin:reply_end]),
                    'system': False, 'kind': 'guestbook-reply'})
                end = reply_start
            records.append({'id': f'{Path(filename).stem}:guest-{index}',
                'file': filename, 'position': index, 'floor': index,
                'name': name, 'start': begin, 'end': end,
                'body': source[begin:end], 'text': plain(source[begin:end]),
                'system': False, 'kind': 'guestbook'})
    return records


if __name__ == '__main__':
    import sys
    records = extract()
    if '--snapshot' in sys.argv:
        import tempfile
        target = Path(tempfile.gettempdir()) / 'passbbs-voice-snapshot.json'
        target.write_text(json.dumps(records, ensure_ascii=False), encoding='utf-8')
        print(target)
    else:
        print(json.dumps(records, ensure_ascii=False))
