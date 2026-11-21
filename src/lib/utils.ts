import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function downloadFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function shiftSRT(srt: string, offsetMs: number): string {
  if (offsetMs === 0) return srt;
  
  const timeRegex = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
  
  return srt.replace(timeRegex, (_, h, m, s, ms) => {
    let totalMs = 
      parseInt(h) * 3600000 + 
      parseInt(m) * 60000 + 
      parseInt(s) * 1000 + 
      parseInt(ms);
      
    totalMs += offsetMs;
    if (totalMs < 0) totalMs = 0;
    
    const newH = Math.floor(totalMs / 3600000);
    totalMs %= 3600000;
    const newM = Math.floor(totalMs / 60000);
    totalMs %= 60000;
    const newS = Math.floor(totalMs / 1000);
    const newMs = totalMs % 1000;
    
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(newS).padStart(2, '0')},${String(newMs).padStart(3, '0')}`;
  });
}
