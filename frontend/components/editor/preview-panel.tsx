"use client";

type PreviewClip = {
  id: string;
  label: string;
  url: string;
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

type PreviewPanelProps = {
  activeClip?: PreviewClip;
  textOverlays: TextOverlay[];
};

export default function PreviewPanel({ activeClip, textOverlays }: PreviewPanelProps) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Preview</h2>
      <div className="mt-4 rounded-2xl bg-black p-4">
        {activeClip ? (
          <div className="relative">
            <video src={activeClip.url} controls className="h-[320px] w-full rounded-xl object-contain" />
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="pointer-events-none absolute text-white"
                style={{ left: overlay.x, top: overlay.y, fontSize: `${overlay.fontSize}px` }}
              >
                {overlay.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[320px] items-center justify-center text-sm text-gray-300">Upload media and add a clip to preview it.</div>
        )}
      </div>
    </div>
  );
}