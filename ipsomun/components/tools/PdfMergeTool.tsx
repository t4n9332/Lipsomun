"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * PDF 합치기 — 전부 브라우저 안에서 처리한다.
 *
 * 서버로 보내지 않는 이유는 두 가지다.
 *  ① Vercel 서버리스는 요청 본문이 4.5MB로 제한된다. 10MB짜리 PDF는 올라가지도 않는다.
 *  ② 계약서·급여명세서 같은 걸 남의 서버에 올리고 싶은 사람은 없다.
 * pdf-lib은 이 페이지에 들어왔을 때만 동적으로 불러온다. 다른 페이지 속도에는 영향이 없다.
 */

type Item = {
  id: string;
  file: File;
  pages: number | null;
  error: string | null;
};

/** 작은 파일이 전부 0.0MB로 보이면 목록이 무의미해진다 */
const size = (n: number) =>
  n >= 1024 * 1024
    ? (n / 1024 / 1024).toFixed(1) + "MB"
    : Math.max(1, Math.round(n / 1024)) + "KB";

export default function PdfMergeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<
    { url: string; size: number; pages: number } | null
  >(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  // blob URL은 직접 반납하지 않으면 새 결과를 만들 때마다 메모리에 쌓인다
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const clearResult = () => {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  /** 파일을 받자마자 페이지 수를 읽어둔다 — 합치기 전에 문제 파일을 알려주기 위해서다 */
  const addFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    clearResult();
    const incoming = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
    );
    if (incoming.length === 0) {
      setStatus("PDF 파일만 넣을 수 있습니다.");
      return;
    }
    setStatus(null);

    const staged: Item[] = incoming.map((file) => ({
      id: "f" + seq.current++,
      file,
      pages: null,
      error: null,
    }));
    setItems((prev) => [...prev, ...staged]);

    const { PDFDocument } = await import("pdf-lib");
    for (const it of staged) {
      let pages: number | null = null;
      let error: string | null = null;
      try {
        const doc = await PDFDocument.load(await it.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
        pages = doc.getPageCount();
      } catch {
        error = "열 수 없는 파일입니다 (손상되었거나 암호가 걸려 있습니다)";
      }
      setItems((prev) =>
        prev.map((p) => (p.id === it.id ? { ...p, pages, error } : p))
      );
    }
  }, []);

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
    clearResult();
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    clearResult();
  };

  const merge = async () => {
    const usable = items.filter((i) => !i.error);
    if (usable.length < 2) {
      setStatus("합치려면 PDF가 2개 이상 필요합니다.");
      return;
    }
    setBusy(true);
    setStatus("합치는 중…");
    clearResult();
    try {
      const { PDFDocument } = await import("pdf-lib");
      const out = await PDFDocument.create();
      for (const it of usable) {
        const src = await PDFDocument.load(await it.file.arrayBuffer(), {
          ignoreEncryption: true,
        });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      const bytes = await out.save();
      const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
      setResult({
        url: URL.createObjectURL(blob),
        size: blob.size,
        pages: out.getPageCount(),
      });
      setStatus(null);
    } catch {
      setStatus(
        "합치는 중 오류가 났습니다. 암호가 걸린 파일이 섞여 있는지 확인해주세요."
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setItems([]);
    clearResult();
    setStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const usableCount = items.filter((i) => !i.error).length;
  const totalPages = items.reduce((a, b) => a + (b.error ? 0 : b.pages ?? 0), 0);
  const totalSize = items.reduce((a, b) => a + (b.error ? 0 : b.file.size), 0);

  return (
    <div className="tool">
      <div
        className={dragOver ? "tool-drop over" : "tool-drop"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <span className="tool-drop-icon">📎</span>
        <b>PDF 파일을 여기에 끌어다 놓으세요</b>
        <em>또는 눌러서 고르기 · 여러 개를 한 번에 선택할 수 있습니다</em>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <>
          <ol className="tool-list">
            {items.map((it, i) => (
              <li key={it.id} className={it.error ? "bad" : undefined}>
                <span className="tool-idx">{i + 1}</span>
                <span className="tool-meta">
                  <b>{it.file.name}</b>
                  <em>
                    {it.error
                      ? it.error
                      : it.pages == null
                      ? "읽는 중…"
                      : it.pages + "쪽 · " + size(it.file.size)}
                  </em>
                </span>
                <span className="tool-btns">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || busy}
                    aria-label="위로"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1 || busy}
                    aria-label="아래로"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    disabled={busy}
                    aria-label="빼기"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>

          <p className="tool-sum">
            {usableCount}개 · {totalPages}쪽 · {size(totalSize)}
            <span className="tool-note"> · 위에서부터 순서대로 합쳐집니다</span>
          </p>

          <div className="tool-actions">
            <button
              type="button"
              className="tool-go"
              onClick={merge}
              disabled={busy || usableCount < 2}
            >
              {busy ? "합치는 중…" : "PDF 합치기"}
            </button>
            <button
              type="button"
              className="tool-reset"
              onClick={reset}
              disabled={busy}
            >
              전부 비우기
            </button>
          </div>
        </>
      )}

      {status && <p className="tool-status">{status}</p>}

      {result && (
        <div className="tool-done">
          <div className="tool-done-head">완성됐습니다</div>
          <div className="tool-done-sub">
            {result.pages}쪽 · {size(result.size)}
          </div>
          <a className="tool-download" href={result.url} download="합친문서.pdf">
            ⬇ 내려받기
          </a>
        </div>
      )}

      <p className="tool-privacy">
        🔒 <b>파일이 서버로 전송되지 않습니다.</b> 합치는 작업은 이 브라우저 안에서
        일어나고, 완성된 파일도 이 컴퓨터에서 만들어집니다. 페이지를 닫으면 아무것도
        남지 않습니다. 브라우저 개발자 도구의 네트워크 탭을 열어두고 써보시면
        확인하실 수 있습니다.
      </p>
    </div>
  );
}
