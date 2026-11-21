export async function processAudioFile(
  file: File,
  onProgress: (progress: number) => void,
  modelName: string = "gemini-3-flash-preview",
  duration?: number
): Promise<string> {
  try {
    onProgress(10); // Start reading & preparing audio
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || "audio/mpeg";

    onProgress(25); // Sending to server for Gemini processing
    const response = await fetch("/api/gemini/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Data,
        mimeType,
        model: modelName,
        duration,
      }),
    });

    onProgress(90);

    let payload: { srt?: string; error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error || `Subtitle generation failed (HTTP ${response.status})`
      );
    }

    if (!payload?.srt) {
      throw new Error("No subtitle content generated");
    }

    onProgress(100);
    return payload.srt;
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = (error) => reject(error);
  });
}
