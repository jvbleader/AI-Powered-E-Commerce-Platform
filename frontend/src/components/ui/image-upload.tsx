import React, { useRef, useState } from "react";
import { Upload, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { uploadImage } from "@/services/upload-api";

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
    
    try {
      const url = await uploadImage(file);
      if (url) {
        onChange(url);
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

export interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function MultiImageUpload({ value, onChange, disabled }: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const url = await uploadImage(file);
        return url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter(Boolean);
      onChange([...value, ...validUrls]);
      
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

  const removeImage = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const moveLeft = (index: number) => {
    if (index === 0) return;
    const newValue = [...value];
    [newValue[index - 1], newValue[index]] = [newValue[index], newValue[index - 1]];
    onChange(newValue);
  };

  const moveRight = (index: number) => {
    if (index === value.length - 1) return;
    const newValue = [...value];
    [newValue[index], newValue[index + 1]] = [newValue[index + 1], newValue[index]];
    onChange(newValue);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {value.map((url, index) => (
          <div key={index} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-md border border-slate-200 group">
            <img src={url} alt="Uploaded" className="h-full w-full object-cover" />
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
               {index > 0 && (
                 <button 
                   type="button"
                   onClick={() => moveLeft(index)} 
                   className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm"
                 >
                   <ChevronLeft className="h-5 w-5" />
                 </button>
               )}
               {index < value.length - 1 && (
                 <button 
                   type="button"
                   onClick={() => moveRight(index)} 
                   className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-sm"
                 >
                   <ChevronRight className="h-5 w-5" />
                 </button>
               )}
            </div>

            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600 focus:outline-none z-10"
              disabled={disabled || isUploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        
        <div className="flex flex-col justify-center h-32 w-32">
          <input
            type="file"
            accept="image/*"
            multiple
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
            className="h-full w-full flex-col gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">Đang tải...</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="text-xs text-center text-wrap">Tải ảnh lên<br/>(Chọn nhiều)</span>
              </>
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Chấp nhận định dạng JPG, PNG. Kích thước tối đa 5MB. Có thể chọn nhiều ảnh.
      </p>
    </div>
  );
}
