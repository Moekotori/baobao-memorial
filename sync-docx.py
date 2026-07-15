#!/usr/bin/env python3
"""Watch docx file and remind to update content.json. Run: python sync-docx.py"""

import json
import time
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(__file__).parent
DOCX = ROOT.parent / "爆爆爆爆.docx"
JSON = ROOT / "data" / "content.json"
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def extract_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    lines = []
    for p in root.iter(f"{W_NS}p"):
        parts = []
        for t in p.iter(f"{W_NS}t"):
            if t.text:
                parts.append(t.text)
            if t.tail:
                parts.append(t.tail)
        if parts:
            lines.append("".join(parts))
    return "\n".join(lines)


def update_timestamp():
    data = json.loads(JSON.read_text(encoding="utf-8"))
    tz = timezone(timedelta(hours=8))
    data["meta"]["lastUpdated"] = datetime.now(tz).isoformat()
    JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[sync] 已更新 lastUpdated → {data['meta']['lastUpdated']}")


def main():
    if not DOCX.exists():
        print(f"未找到文档: {DOCX}")
        return

    print(f"监听文档: {DOCX}")
    print(f"内容文件: {JSON}")
    print("修改 Word 文档后，请同步编辑 data/content.json 中的结构化内容")
    print("本脚本会在文档变更时自动刷新时间戳，触发网页热更新\n")

    mtime = DOCX.stat().st_mtime
    while True:
        try:
            current = DOCX.stat().st_mtime
            if current != mtime:
                mtime = current
                text = extract_docx_text(DOCX)
                preview = text[:120].replace("\n", " ")
                print(f"\n[detected] 文档已更新")
                print(f"  预览: {preview}…")
                update_timestamp()
                print("  → 请编辑 data/content.json 同步正文内容")
        except KeyboardInterrupt:
            print("\n已停止监听")
            break
        time.sleep(2)


if __name__ == "__main__":
    main()