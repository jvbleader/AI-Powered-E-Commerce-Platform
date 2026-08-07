import React, { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "./button";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Assuming Next.js app is hosted at frontend but API is at backend (e.g., localhost:8000/api)
      // We should use the same base URL mechanism the app uses. 
      // If we don't know the exact base URL setup, we can use a relative path if there's a proxy or an absolute path.
      // Assuming NEXT_PUBLIC_API_URL or similar is used, but we'll try relative to backend for now.
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const response = await fetch(`${baseUrl}/api/upload/image`, {
        method: "POST",
        body: formData,
        // Include credentials so the backend receives the auth cookie
        credentials: "include" 
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      if (data.url) {
        onChange(data.url);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Lỗi tải ảnh lên. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {value && (
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200">
            <img
              src={value}
              alt="Uploaded image"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600 focus:outline-none"
              disabled={disabled || isUploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={inputRef}
            onChange={handleUpload}
            disabled={disabled || isUploading}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải lên...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Tải ảnh mới lên
              </>
            )}
          </Button>
          <p className="mt-2 text-xs text-slate-500">
            Chấp nhận định dạng JPG, PNG. Kích thước tối đa 5MB.
          </p>
        </div>
      </div>
    </div>
  );
}
