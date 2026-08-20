"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export interface PDFInPageHighlighterProps {
  fileUrl: string;
  initialPage?: number;
  excerpt?: string;
  className?: string;
}

interface HighlightBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

function normalizeForSearch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean any chunk metadata prefixes like "[01 chinh sach - Trang 2]" */
function cleanExcerptText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^\[.*?\]\s*/g, "")
    .replace(/\[Trang\s*\d+\]\s*/gi, "")
    .trim();
}

export function PDFInPageHighlighter({
  fileUrl,
  initialPage = 1,
  excerpt = "",
  className,
}: PDFInPageHighlighterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<HighlightBox[]>([]);

  // Clean excerpt from RAG
  const cleanedExcerpt = useMemo(() => cleanExcerptText(excerpt), [excerpt]);

  // Sync initialPage from props
  useEffect(() => {
    if (initialPage && initialPage >= 1) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  // Load PDF.js library dynamically from CDN
  const ensurePdfJsLoaded = useCallback(async (): Promise<any> => {
    if (window.pdfjsLib) return window.pdfjsLib;

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById("pdfjs-cdn-script");
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            resolve(window.pdfjsLib);
          } else {
            reject(new Error("Không tải được PDF.js"));
          }
        });
        existingScript.addEventListener("error", () => reject(new Error("Lỗi mạng tải PDF.js")));
        return;
      }

      const script = document.createElement("script");
      script.id = "pdfjs-cdn-script";
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("Không tải được PDF.js"));
        }
      };
      script.onerror = () => reject(new Error("Lỗi khi tải thư viện PDF.js"));
      document.head.appendChild(script);
    });
  }, []);

  // Fetch document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setLoadError(null);

    async function loadDocument() {
      try {
        const pdfjs = await ensurePdfJsLoaded();
        if (isCancelled) return;

        const loadingTask = pdfjs.getDocument({
          url: fileUrl,
          withCredentials: false,
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err: any) {
        if (isCancelled) return;
        setLoadError(err?.message || "Không thể nạp dữ liệu file PDF.");
        setIsLoading(false);
      }
    }

    if (fileUrl) {
      loadDocument();
    }

    return () => {
      isCancelled = true;
    };
  }, [fileUrl, ensurePdfJsLoaded]);

  // Extract all sentences from the exact RAG chunk
  const targetSearchPhrases = useMemo(() => {
    const phrases: string[] = [];

    if (cleanedExcerpt && cleanedExcerpt.length >= 6) {
      const lines = cleanedExcerpt
        .split(/\r?\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 6);

      lines.forEach((line) => {
        if (line.length <= 150) {
          phrases.push(line);
        } else {
          const subSentences = line
            .split(/(?<=[.!?;\u2026])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 8);

          if (subSentences.length > 0) {
            subSentences.forEach((s) => phrases.push(s));
          } else {
            const words = line.split(/\s+/);
            for (let i = 0; i < words.length; i += 6) {
              const chunk = words.slice(i, i + 8).join(" ");
              if (chunk.length >= 8) phrases.push(chunk);
            }
          }
        }
      });
    }

    return phrases;
  }, [cleanedExcerpt]);

  // Render Page & Precise Sequence Matcher
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    setIsRendering(true);
    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Extract text content & map exact character sequence
      const textContent = await page.getTextContent();
      const newHighlights: HighlightBox[] = [];

      if (targetSearchPhrases.length > 0 && textContent.items && textContent.items.length > 0) {
        interface ItemMap {
          item: any;
          index: number;
          startChar: number;
          endChar: number;
          text: string;
        }

        let fullAccumulated = "";
        const itemMaps: ItemMap[] = [];

        textContent.items.forEach((item: any, idx: number) => {
          const str = item.str || "";
          if (!str) return;

          const startChar = fullAccumulated.length;
          fullAccumulated += (fullAccumulated.length > 0 && !fullAccumulated.endsWith(" ") && !str.startsWith(" ") ? " " : "") + str;
          const endChar = fullAccumulated.length;

          itemMaps.push({
            item,
            index: idx,
            startChar,
            endChar,
            text: str,
          });
        });

        const normFullText = normalizeForSearch(fullAccumulated);

        // Search for each target RAG sentence in continuous text
        targetSearchPhrases.forEach((phrase) => {
          const normPhrase = normalizeForSearch(phrase);
          if (normPhrase.length < 3) return;

          let searchStart = 0;
          while (searchStart < normFullText.length) {
            const matchIndex = normFullText.indexOf(normPhrase, searchStart);
            if (matchIndex === -1) break;

            const matchEnd = matchIndex + normPhrase.length;

            const matchedItems = itemMaps.filter(
              (m) => m.endChar > matchIndex && m.startChar < matchEnd
            );

            matchedItems.forEach((m) => {
              const item = m.item;
              const tx = item.transform[4];
              const ty = item.transform[5];
              const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
              const fontHeight = Math.hypot(item.transform[2], item.transform[3]) * scale;
              const itemWidth = (item.width || 10) * scale;

              const boxId = `hl-${currentPage}-${m.index}-${matchIndex}`;
              if (!newHighlights.some((h) => h.id === boxId)) {
                newHighlights.push({
                  id: boxId,
                  left: Math.max(0, vx),
                  top: Math.max(0, vy - fontHeight * 0.95),
                  width: Math.max(itemWidth, 12),
                  height: Math.max(fontHeight * 1.18, 14),
                  text: m.text,
                });
              }
            });

            searchStart = matchIndex + Math.max(1, normPhrase.length);
          }
        });
      }

      setHighlights(newHighlights);

      // Auto-scroll to first highlight on load
      if (newHighlights.length > 0 && containerRef.current) {
        const minTop = Math.min(...newHighlights.map((h) => h.top));
        containerRef.current.scrollTo({
          top: Math.max(0, minTop - 120),
          behavior: "smooth",
        });
      }
    } catch (err) {
      console.error("Lỗi khi render trang PDF:", err);
    } finally {
      setIsRendering(false);
    }
  }, [pdfDoc, currentPage, scale, targetSearchPhrases]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Jump to highlight button
  const handleScrollToHighlight = () => {
    if (highlights.length > 0 && containerRef.current) {
      const minTop = Math.min(...highlights.map((h) => h.top));
      containerRef.current.scrollTo({
        top: Math.max(0, minTop - 120),
        behavior: "smooth",
      });
    }
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(2.5, Math.max(0.75, +(prev + delta).toFixed(2))));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((p) => p + 1);
  };

  return (
    <div className={cn("flex flex-col h-full bg-slate-900 select-none overflow-hidden font-body-tech", className)}>
      {/* Clean Control Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-slate-800 border-b border-slate-700 text-white shrink-0">
        {/* Page Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isRendering}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700 transition-colors cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold px-1 text-slate-200">
            Trang {currentPage} / {numPages}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isRendering}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700 transition-colors cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Scroll to Highlight Controls */}
        <div className="flex items-center gap-2">
          {highlights.length > 0 && (
            <button
              type="button"
              onClick={handleScrollToHighlight}
              className="px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cuộn tới vị trí đoạn trích dẫn được bôi vàng"
            >
              <Target className="w-3.5 h-3.5 text-yellow-400" />
              <span>Tới đoạn trích dẫn</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => handleZoom(-0.2)}
              disabled={scale <= 0.75}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700 transition-colors cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-slate-300 w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom(0.2)}
              disabled={scale >= 2.5}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700 transition-colors cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-6 flex items-start justify-center relative scroll-smooth"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            <p className="text-xs font-semibold">Đang tải và xử lý văn bản PDF...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-rose-400 space-y-2 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <p className="text-sm font-bold text-rose-300">Không thể hiển thị PDF trực tiếp</p>
            <p className="text-xs text-slate-400 max-w-sm">{loadError}</p>
          </div>
        ) : (
          <div className="relative shadow-2xl rounded-sm bg-white overflow-hidden transition-transform">
            {/* Canvas Rendering Layer */}
            <canvas ref={canvasRef} className="block" />

            {/* In-Page Precise Highlight Overlay */}
            {highlights.map((hl) => (
              <div
                key={hl.id}
                style={{
                  position: "absolute",
                  left: `${hl.left}px`,
                  top: `${hl.top}px`,
                  width: `${hl.width}px`,
                  height: `${hl.height}px`,
                }}
                title={hl.text}
                className="bg-yellow-300/45 border-b-2 border-amber-500 rounded-2xs pointer-events-none transition-all shadow-2xs"
              />
            ))}

            {/* Match Indicator Pill */}
            {highlights.length > 0 && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-400 text-slate-950 text-[11px] font-bold shadow-md border border-yellow-500 animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>Đoạn trích dẫn ({highlights.length} dòng)</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
