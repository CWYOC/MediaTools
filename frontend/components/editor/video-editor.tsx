"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import MediaLibrary, { EditorMediaItem } from "./media-library";
import Timeline from "./timeline";
import PreviewPanel from "./preview-panel";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5001";

type Clip = {
  id: string;
  label: string;
  stored_name: string;
  url: string;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
  timelineStart: number;
};

type TextOverlay = {
  id: string;
  text: string;
  start: number;
  end: number;
  x: number;
  y: number;
  fontSize: number;
};

export default function VideoEditor() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [libraryItems, setLibraryItems] = useState<EditorMediaItem[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activeClip = useMemo(() => clips[0], [clips]);

  const handleUpload = async (file?: File) => {
    if (!file) return;

    try {
      setBusy(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE}/upload-editor-media`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");

      const newItem: EditorMediaItem = {
        file_id: data.file_id,
        original_name: data.original_name,
        stored_name: data.stored_name,
        url: `${API_BASE}${data.url}`,
      };

      setLibraryItems((prev) => [newItem, ...prev]);
      setMessage("Media uploaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const addClipToTimeline = (item: EditorMediaItem) => {
    setClips((prev) => {
      const last = prev[prev.length - 1];
      const timelineStart = last ? last.timelineStart + last.duration : 0;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          label: item.original_name,
          stored_name: item.stored_name,
          url: item.url,
          sourceStart: 0,
          sourceEnd: 10,
          duration: 10,
          timelineStart,
        },
      ];
    });
  };

  const trimClip = (clipId: string, newStart: number, newEnd: number) => {
    setClips((prev) =>
      prev.map((clip) => {
        if (clip.id !== clipId) return clip;
        const safeEnd = Math.max(newEnd, newStart + 0.1);
        return {
          ...clip,
          sourceStart: newStart,
          sourceEnd: safeEnd,
          duration: Number((safeEnd - newStart).toFixed(2)),
        };
      })
    );
  };

  const removeClip = (clipId: string) => {
    setClips((prev) => prev.filter((clip) => clip.id !== clipId).map((clip, index, arr) => {
      const previous = arr[index - 1];
      return {
        ...clip,
        timelineStart: previous ? previous.timelineStart + previous.duration : 0,
      };
    }));
  };

  const addTextOverlay = () => {
    setTextOverlays((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: "Sample Text",
        start: 0,
        end: 3,
        x: 80,
        y: 80,
        fontSize: 36,
      },
    ]);
  };

  const saveProject = async () => {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      const payload = {
        projectId,
        clips: clips.map((clip) => ({
          stored_name: clip.stored_name,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceEnd,
          timelineStart: clip.timelineStart,
          duration: clip.duration,
        })),
        textOverlays,
      };

      const response = await fetch(`${API_BASE}/save-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");

      setProjectId(data.projectId);
      setMessage(`Project saved: ${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const exportProject = async () => {
    try {
      setBusy(true);
      setError("");
      setMessage("");

      const payload = {
        projectId,
        clips: clips.map((clip) => ({
          stored_name: clip.stored_name,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceEnd,
          timelineStart: clip.timelineStart,
          duration: clip.duration,
        })),
        textOverlays,
      };

      const response = await fetch(`${API_BASE}/export-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "edited_video.mp4";
      a.click();
      window.URL.revokeObjectURL(url);
      setMessage("Export completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Video Editor</h1>
            <p className="mt-2 text-gray-600">Premiere-lite editor with shared media upload, timeline clips, text overlays, save, and export.</p>
          </div>
          <Link href="/" className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-black">
            Back to Tools
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <input ref={inputRef} type="file" accept="video/*,audio/*,image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] || undefined)} />
          <button onClick={() => inputRef.current?.click()} className="rounded-xl bg-black px-5 py-3 text-white">{busy ? "Working..." : "Upload Media"}</button>
          <button onClick={addTextOverlay} className="rounded-xl border border-gray-300 bg-white px-5 py-3">Add Text Overlay</button>
          <button onClick={saveProject} className="rounded-xl border border-gray-300 bg-white px-5 py-3">Save Project</button>
          <button onClick={exportProject} className="rounded-xl bg-black px-5 py-3 text-white">Export MP4</button>
        </div>

        {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <MediaLibrary items={libraryItems} onAddClip={addClipToTimeline} />
          <div className="space-y-6">
            <PreviewPanel activeClip={activeClip} textOverlays={textOverlays} />
            <Timeline clips={clips} onTrimClip={trimClip} onRemoveClip={removeClip} />
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Project Info</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3"><strong>Project ID:</strong> {projectId || "Not saved yet"}</div>
              <div className="rounded-xl bg-gray-50 p-3"><strong>Clips:</strong> {clips.length}</div>
              <div className="rounded-xl bg-gray-50 p-3"><strong>Text overlays:</strong> {textOverlays.length}</div>
              <div className="rounded-xl bg-gray-50 p-3"><strong>Export:</strong> MP4 via backend FFmpeg</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}