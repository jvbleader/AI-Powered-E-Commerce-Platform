"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = {
  label: string;
  value: string;
  count?: number;
  imageUrl?: string;
};

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  popupClassName?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "Select...", className, popupClassName }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const handleToggleOption = (e: React.MouseEvent, optionValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label);

  const displayValue = selectedLabels.length > 0 
    ? (selectedLabels.length <= 2 ? selectedLabels.join(", ") : `${selectedLabels.length} đã chọn`) 
    : placeholder;

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-panel border border-line bg-white px-3 text-sm text-ink transition hover:border-primary focus:border-primary focus:outline-none"
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className={cn("absolute z-50 mt-1 max-h-[400px] overflow-hidden rounded-md border border-line bg-white shadow-lg flex flex-col", popupClassName || "w-full min-w-[200px]")}>
          <div className="p-2 border-b border-line shrink-0">
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-line rounded-md focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted">Không có lựa chọn</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={(e) => handleToggleOption(e, option.value)}
                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0 py-0.5">
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors mt-1",
                        isSelected ? "border-primary bg-primary text-white" : "border-line bg-white"
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      {option.imageUrl && (
                        <img src={option.imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-line shrink-0" />
                      )}
                      <span className="text-ink line-clamp-2 text-left text-sm leading-relaxed">{option.label}</span>
                    </div>
                    {option.count !== undefined && (
                      <span className="text-xs text-muted">{option.count}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
