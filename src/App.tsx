import { useState, useRef, useCallback } from "react";
import { 
  Upload, 
  FileAudio, 
  FileStack, 
  Download, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus,
  Files,
  Eye,
  X,
  Save,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { cn, downloadFile, formatFileSize, shiftSRT } from "./lib/utils";
import { processAudioFile } from "./lib/gemini";
import type { AudioFile, FileStatus } from "./types";
import { 
  Settings2,
  ChevronRight,
  History,
  Timer,
  RotateCcw,
  Zap
} from "lucide-react";

interface EditModalState {
  id: string;
  content: string;
  name: string;
}

export default function App() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalOffset, setGlobalOffset] = useState<number>(0);
  const [useProModel, setUseProModel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFile, setEditingFile] = useState<EditModalState | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const type = file.type || "";
      if (type.startsWith("audio/") || type.startsWith("video/")) {
        const media = document.createElement(type.startsWith("video/") ? "video" : "audio");
        media.preload = "metadata";
        media.src = URL.createObjectURL(file);
        media.onloadedmetadata = () => {
          URL.revokeObjectURL(media.src);
          resolve(media.duration);
        };
        media.onerror = () => {
          URL.revokeObjectURL(media.src);
          resolve(0);
        };
      } else {
        resolve(0);
      }
    });
  };

  const addFiles = async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    const newFiles: AudioFile[] = await Promise.all(fileArray.map(async (file) => {
      const duration = await getDuration(file);
      return {
        id: Math.random().toString(36).substring(7),
        file,
        status: "idle",
        progress: 0,
        duration,
      };
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== "completed"));
  };

  const updateFileStatus = (id: string, updates: Partial<AudioFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const processFile = async (audioFile: AudioFile) => {
    try {
      updateFileStatus(audioFile.id, { status: "processing", progress: 5, error: undefined });
      const model = useProModel ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      const result = await processAudioFile(audioFile.file, (progress) => {
        updateFileStatus(audioFile.id, { progress });
      }, model, audioFile.duration);
      updateFileStatus(audioFile.id, { 
        status: "completed", 
        progress: 100, 
        result 
      });
    } catch (err) {
      updateFileStatus(audioFile.id, { 
        status: "error", 
        error: (err as Error).message || "Processing failed" 
      });
    }
  };

  const startEditing = (id: string, content: string, name: string) => {
    setEditingFile({ id, content, name });
    setHistory([]);
  };

  const updateEditorContent = (newContent: string) => {
    if (!editingFile) return;
    setHistory(prev => [editingFile.content, ...prev].slice(0, 50));
    setEditingFile({ ...editingFile, content: newContent });
  };

  const handleUndo = () => {
    if (history.length === 0 || !editingFile) return;
    const [prev, ...rest] = history;
    setEditingFile({ ...editingFile, content: prev });
    setHistory(rest);
  };

  const handleManualShift = (offset: number) => {
    if (!editingFile) return;
    const shifted = shiftSRT(editingFile.content, offset);
    updateEditorContent(shifted);
  };

  const processAll = async () => {
    const idleFiles = files.filter((f) => f.status === "idle" || f.status === "error");
    if (idleFiles.length === 0) return;

    setIsProcessing(true);
    await Promise.all(idleFiles.map(f => processFile(f)));
    setIsProcessing(false);
  };

  const handleSaveEdit = () => {
    if (!editingFile) return;
    updateFileStatus(editingFile.id, { result: editingFile.content });
    setEditingFile(null);
  };

  const downloadZip = async () => {
    const completedFiles = files.filter((f) => f.status === "completed" && f.result);
    if (completedFiles.length === 0) return;

    const zip = new JSZip();
    completedFiles.forEach((f) => {
      const fileName = f.file.name.replace(/\.[^/.]+$/, "") + ".srt";
      const finalContent = globalOffset !== 0 ? shiftSRT(f.result!, globalOffset) : f.result!;
      zip.file(fileName, finalContent);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "khmer_subtitles_offset_" + globalOffset + "ms.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-orange-500 selection:text-white">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <main className="relative max-w-5xl mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-16 text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center md:justify-start gap-3 mb-4"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20">
              <FileAudio className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">KHMER SUBTITLE PRO</h1>
          </motion.div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-gray-400 max-w-2xl text-lg leading-relaxed"
            >
              Convert any audio into natural Khmer subtitles with AI. 
              Transcribe, translate, and generate .srt files instantly.
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                showSettings 
                  ? "bg-orange-600/10 border-orange-500 text-orange-500" 
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
              )}
            >
              <Settings2 className="w-4 h-4" />
              Sync Settings
            </motion.button>
          </div>
        </header>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Timer className="w-5 h-5 text-orange-500" />
                      Global Timing Offset
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Adjust all timestamps if subtitles consistently appear too early or too late.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setGlobalOffset(0)}
                      className="p-2 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                      title="Reset to 0"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <div className="px-4 py-2 bg-black rounded-xl border border-white/10 font-mono text-orange-500 min-w-[100px] text-center">
                      {globalOffset > 0 ? '+' : ''}{globalOffset}ms
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <input
                    type="range"
                    min="-2000"
                    max="2000"
                    step="50"
                    value={globalOffset}
                    onChange={(e) => setGlobalOffset(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                  />
                  <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-gray-600">
                    <span>-2.0s (Earlier)</span>
                    <span>0.0s (Original)</span>
                    <span>+2.0s (Later)</span>
                  </div>
                </div>

                <div className="p-4 bg-orange-600/5 rounded-2xl border border-orange-500/20 text-sm text-orange-200/80">
                  Tip: Use negative values if subtitles are lagging behind the speech, and positive values if they are appearing too soon.
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div>
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-500" />
                      Advanced Accuracy (Pro)
                    </h4>
                    <p className="text-xs text-gray-500">Best for noisy files. Ensures verbatim word-for-word extraction and precise timing.</p>
                  </div>
                  <button
                    onClick={() => setUseProModel(!useProModel)}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-all duration-300",
                      useProModel ? "bg-orange-600" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                      useProModel ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Subtitle Optimization Tips</h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {[
                      "For missing endings, enable 'High Accuracy Mode'.",
                      "Ensure the audio doesn't fade out too abruptly.",
                      "Small offsets (100-300ms) often fix 'vibe' issues.",
                      "Batch processing handles up to 8 files at once."
                    ].map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <div className="mt-1 w-1 h-1 rounded-full bg-orange-500 shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-12 space-y-8">
            {/* Upload Area */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className={cn(
                "relative group cursor-pointer border-2 border-dashed rounded-3xl p-12 transition-all duration-300",
                "border-white/10 hover:border-orange-500/50 hover:bg-white/5",
                isProcessing ? "opacity-50 pointer-events-none" : ""
              )}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="audio/*,video/*"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-orange-500" />
                </div>
                <div>
                  <p className="text-xl font-medium mb-1">Drop audio files here</p>
                  <p className="text-gray-500">or click to browse from device</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {['MP3', 'WAV', 'M4A', 'MP4'].map(ext => (
                    <span key={ext} className="px-3 py-1 bg-white/5 rounded-full text-xs font-mono text-gray-400">
                      .{ext}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Actions Bar */}
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white/5 rounded-2xl border border-white/10"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <Files className="w-4 h-4" />
                    {files.length} {files.length === 1 ? 'File' : 'Files'} Selected
                  </span>
                  {files.some(f => f.status === 'completed') && (
                    <button 
                      onClick={clearCompleted}
                      className="text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Clear Completed
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    disabled={isProcessing || !files.some(f => f.status === 'idle')}
                    onClick={processAll}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all",
                      "bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:hover:bg-orange-600"
                    )}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Start Batch Process
                      </>
                    )}
                  </button>
                  {files.filter(f => f.status === 'completed').length > 1 && (
                    <button
                      onClick={downloadZip}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Download ZIP
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Queue List */}
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group relative flex items-center gap-4 p-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-600/10 flex items-center justify-center shrink-0">
                      <FileAudio className="w-6 h-6 text-orange-500" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex flex-col">
                          <h3 className="font-medium truncate pr-8">{file.file.name}</h3>
                          {file.duration ? (
                            <span className="text-[10px] text-gray-500 font-mono">
                              Duration: {Math.floor(file.duration / 60)}:{(file.duration % 60).toFixed(0).padStart(2, '0')}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 font-mono">
                          {formatFileSize(file.file.size)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${file.progress}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-300",
                              file.status === 'error' ? 'bg-red-500' : 'bg-orange-500'
                            )}
                          />
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                          file.status === 'completed' && "bg-green-500/10 text-green-500",
                          file.status === 'processing' && "bg-blue-500/10 text-blue-500",
                          file.status === 'error' && "bg-red-500/10 text-red-500",
                          file.status === 'idle' && "bg-white/10 text-gray-500"
                        )}>
                          {file.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {file.status === 'completed' && file.result && (
                        <>
                          <button
                            onClick={() => startEditing(file.id, file.result!, file.file.name)}
                            className="p-2 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
                            title="Edit / Review SRT"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              const finalContent = globalOffset !== 0 ? shiftSRT(file.result!, globalOffset) : file.result!;
                              downloadFile(finalContent, file.file.name.replace(/\.[^/.]+$/, "") + ".srt");
                            }}
                            className="p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-all"
                            title="Download SRT"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {file.status === 'error' && (
                        <button
                          onClick={() => processFile(file)}
                          className="p-2 rounded-lg bg-orange-500/20 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
                          title="Retry"
                        >
                          <History className="w-5 h-5" />
                        </button>
                      )}
                      {file.status !== 'processing' && (
                        <button
                          onClick={() => removeFile(file.id)}
                          className="p-2 rounded-lg bg-white/0 text-gray-500 hover:bg-red-500/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {files.length === 0 && (
                <div className="text-center py-12 opacity-30">
                  <FileStack className="w-12 h-12 mx-auto mb-4" />
                  <p>Queue is empty. Ready to process subtitles.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* SRT Editor Modal */}
      <AnimatePresence>
        {editingFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingFile(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl h-[80vh] flex flex-col bg-[#121212] rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center">
                    <Settings2 className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg truncate max-w-[200px] md:max-w-md">Edit: {editingFile.name}</h3>
                    <p className="text-xs text-gray-500">Modify timestamps or text manually</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingFile(null)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden p-6 relative flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUndo}
                      disabled={history.length === 0}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium disabled:opacity-30 disabled:pointer-events-none transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Undo
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Shift Timing</span>
                    <button
                      onClick={() => handleManualShift(-100)}
                      className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded text-[10px] font-bold border border-red-500/20"
                    >
                      -100ms
                    </button>
                    <button
                      onClick={() => handleManualShift(100)}
                      className="px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded text-[10px] font-bold border border-green-500/20"
                    >
                      +100ms
                    </button>
                  </div>
                  
                  <div className="px-3 py-1.5 bg-orange-600/20 border border-orange-500/30 rounded-lg text-xs font-mono text-orange-500 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Global Sync: {globalOffset}ms
                  </div>
                </div>

                <textarea
                  value={editingFile.content}
                  onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                  onBlur={() => {
                    // Only save to history if content actually changed
                    const lastHistory = history[0];
                    if (editingFile.content !== lastHistory) {
                      setHistory(prev => [editingFile.content, ...prev].slice(0, 50));
                    }
                  }}
                  spellCheck={false}
                  className={cn(
                    "w-full h-full bg-black/50 rounded-2xl p-6 font-mono text-sm leading-relaxed",
                    "border border-white/5 focus:border-orange-500/50 outline-none transition-colors",
                    "resize-none overflow-y-auto custom-scrollbar"
                  )}
                  placeholder="Paste or edit SRT content here..."
                />
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-white/5 border-t border-white/5 flex items-center justify-between gap-4">
                <div className="hidden md:block text-xs text-gray-500">
                  Tip: Timestamps use HH:MM:SS,mmm format.
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => setEditingFile(null)}
                    className="flex-1 md:flex-none px-6 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl font-semibold bg-orange-600 hover:bg-orange-500 transition-all text-sm shadow-lg shadow-orange-600/20"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center text-sm text-gray-600">
        <p>© {new Date().getFullYear()} Khmer Subtitle Pro. Powered by Gemini AI.</p>
      </footer>
    </div>
  );
}
