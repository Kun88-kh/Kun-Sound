export type FileStatus = "idle" | "reading" | "processing" | "completed" | "error";

export interface AudioFile {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  duration?: number;
  result?: string;
  error?: string;
}

export interface SubtitleChunk {
  startTime: string;
  endTime: string;
  text: string;
}
