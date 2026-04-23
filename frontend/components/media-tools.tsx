"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:5001";

type ToolKey = "image" | "video";

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function getImageExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "png";
}

function ImageConverter() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [outputFormat, setOutputFormat] = useState("image/png");
  const [quality, setQuality] = useState(92);
  const [convertedUrl, setConvertedUrl] = useState("");
  const [convertedName, setConvertedName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const resetAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    setFile(null);
    setPreviewUrl("");
    setConvertedUrl("");
    setConvertedName("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFileChange = (selectedFile?: File) => {
    setError("");
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);

    const url = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setPreviewUrl(url);
    setConvertedUrl("");
    setConvertedName("");
  };

  const handleConvert = async () => {
    if (!file || !previewUrl) return;
    setBusy(true);
    setError("");

    try {
      const image = new Image();
      image.src = previewUrl;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available.");

      ctx.drawImage(image, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => {
        const qualityValue = outputFormat === "image/png" ? undefined : quality / 100;
        canvas.toBlob(resolve, outputFormat, qualityValue);
      });

      if (!blob) throw new Error("Conversion failed.");

      const newUrl = URL.createObjectURL(blob);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const ext = getImageExtension(outputFormat);

      setConvertedUrl(newUrl);
      setConvertedName(`${baseName}.${ext}`);
    } catch {
      setError("Unable to convert this image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Image Converter</h2>
        <p className="mt-2 text-sm text-gray-600">Convert images in the browser without sending them to the backend.</p>

        <div
          className="mt-6 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFileChange(e.dataTransfer.files?.[0]);
          }}
        >
          <p className="font-medium">Drop your image here</p>
          <p className="mt-2 text-sm text-gray-500">JPG, PNG, WEBP and more</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] || undefined)}
          />
          <button onClick={() => inputRef.current?.click()} className="mt-4 rounded-xl bg-black px-4 py-2 text-white">
            Choose Image
          </button>
        </div>

        {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Output format</label>
            <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WEBP</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Quality: {quality}%</label>
            <input type="range" min="10" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={handleConvert} disabled={!file || busy} className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50">
            {busy ? "Converting..." : "Convert Image"}
          </button>
          <button onClick={resetAll} className="rounded-xl border border-gray-300 px-5 py-3">
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Image details</h3>
        {file ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-gray-50 p-3"><strong>Name:</strong> {file.name}</div>
            <div className="rounded-xl bg-gray-50 p-3"><strong>Size:</strong> {formatBytes(file.size)}</div>
            <div className="rounded-xl bg-gray-50 p-3"><strong>Type:</strong> {file.type}</div>
            {previewUrl ? (
              <div className="overflow-hidden rounded-2xl border bg-gray-50 p-3">
                <img src={previewUrl} alt="Preview" className="h-72 w-full object-contain" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed p-6 text-sm text-gray-500">No image selected yet.</div>
        )}

        {convertedUrl ? (
          <a href={convertedUrl} download={convertedName} className="mt-6 inline-block rounded-xl bg-black px-5 py-3 text-white">
            Download {convertedName}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function VideoConverter() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState("mp4");
  const [quality, setQuality] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState("");

  const onFileChange = (selectedFile?: File) => {
    setError("");
    setDownloadUrl("");
    setDownloadName("");

    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("video/")) {
      setError("Please upload a valid video file.");
      return;
    }
    setFile(selectedFile);
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please choose a video first.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("video", file);
      formData.append("format", outputFormat);
      formData.append("quality", quality);

      const response = await fetch(`${API_BASE}/convert-video`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Conversion failed.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setDownloadUrl(url);
      setDownloadName(`${baseName}.${outputFormat}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Video Converter</h2>
        <p className="mt-2 text-sm text-gray-600">Upload a video and convert it on the backend.</p>

        <div className="mt-6 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center" onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
          e.preventDefault();
          onFileChange(e.dataTransfer.files?.[0]);
        }}>
          <p className="font-medium">Drop your video here</p>
          <p className="mt-2 text-sm text-gray-500">MP4, MOV, AVI, MKV, WEBM and more</p>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] || undefined)} />
          <button onClick={() => inputRef.current?.click()} className="mt-4 rounded-xl bg-black px-4 py-2 text-white">Choose Video</button>
        </div>

        {error ? <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Output format</label>
            <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
              <option value="mp4">MP4</option>
              <option value="webm">WEBM</option>
              <option value="mov">MOV</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Quality</label>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2">
              <option value="high">High</option>
              <option value="standard">Standard</option>
              <option value="compressed">Compressed</option>
            </select>
          </div>
        </div>

        <button onClick={handleConvert} disabled={!file || loading} className="mt-6 rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50">
          {loading ? "Converting..." : "Convert Video"}
        </button>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-semibold">Video details</h3>
        {file ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-gray-50 p-3"><strong>Name:</strong> {file.name}</div>
            <div className="rounded-xl bg-gray-50 p-3"><strong>Size:</strong> {formatBytes(file.size)}</div>
            <div className="rounded-xl bg-gray-50 p-3"><strong>Type:</strong> {file.type}</div>
            <div className="rounded-xl bg-gray-50 p-3"><strong>Convert to:</strong> {outputFormat.toUpperCase()}</div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed p-6 text-sm text-gray-500">No video selected yet.</div>
        )}

        {downloadUrl ? (
          <a href={downloadUrl} download={downloadName} className="mt-6 inline-block rounded-xl bg-black px-5 py-3 text-white">
            Download {downloadName}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function MediaTools() {
  const [activeTool, setActiveTool] = useState<ToolKey>("image");

  const tabs = useMemo(() => [
    { key: "image" as ToolKey, label: "Image Converter" },
    { key: "video" as ToolKey, label: "Video Converter" },
  ], []);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Media Tools</h1>
            <p className="mt-3 text-gray-600">Image conversion, video conversion, and a timeline-based editor.</p>
          </div>
          <Link href="/editor" className="rounded-xl bg-black px-5 py-3 text-white">
            Open Video Editor
          </Link>
        </div>

        <div className="mt-8 flex gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTool(tab.key)}
              className={`rounded-xl px-4 py-2 ${activeTool === tab.key ? "bg-black text-white" : "border border-gray-300 bg-white text-black"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {activeTool === "image" ? <ImageConverter /> : <VideoConverter />}
        </div>
      </div>
    </main>
  );
}