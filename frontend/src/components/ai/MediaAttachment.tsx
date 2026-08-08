"use client";

import React, { useEffect, useState } from "react";
import { Image as ImageIcon, Play, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MediaAttachment({
  type,
  url,
  overlay,
  className,
}: {
  type: "IMAGE" | "VIDEO";
  url: string;
  overlay?: React.ReactNode;
  className?: string;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className={cn(
          "relative block max-w-[280px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 text-left cursor-pointer",
          className
        )}
        aria-label={type === "IMAGE" ? "Xem ảnh phóng to" : "Xem video phóng to"}
      >
        {type === "IMAGE" ? (
          <img
            src={url}
            alt="Hình ảnh đính kèm"
            className="max-h-[320px] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="relative bg-black">
            <video
              src={url}
              muted
              playsInline
              preload="metadata"
              className="max-h-[320px] w-full object-cover pointer-events-none"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center shadow-lg">
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {overlay ? (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px] leading-none backdrop-blur-[2px] pointer-events-none">
            {overlay}
          </div>
        ) : null}
      </button>

      {lightboxOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="max-w-[min(96vw,1200px)] max-h-[90vh] w-full flex items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            {type === "IMAGE" ? (
              <img
                src={url}
                alt="Hình ảnh phóng to"
                className="max-h-[90vh] max-w-full object-contain rounded-lg"
              />
            ) : (
              <video
                src={url}
                controls
                autoPlay
                playsInline
                className="max-h-[90vh] max-w-full rounded-lg bg-black"
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function MediaAttachmentFallback({ type }: { type: "IMAGE" | "VIDEO" }) {
  const Icon = type === "IMAGE" ? ImageIcon : Video;
  return (
    <div className="rounded-lg overflow-hidden border border-slate-200/50 bg-slate-100 flex items-center justify-center min-h-[120px] min-w-[180px] gap-2 px-4">
      <Icon className="w-8 h-8 text-slate-400" />
      <span className="text-xs text-slate-500">
        {type === "IMAGE" ? "Không tải được ảnh" : "Không tải được video"}
      </span>
    </div>
  );
}
