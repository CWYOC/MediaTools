"use client";

type Clip = {
  id: string;
  label: string;
  stored_name: string;
  sourceStart: number;
  sourceEnd: number;
  duration: number;
  timelineStart: number;
};

type TimelineProps = {
  clips: Clip[];
  onTrimClip: (clipId: string, newStart: number, newEnd: number) => void;
  onRemoveClip: (clipId: string) => void;
};

export default function Timeline({ clips, onTrimClip, onRemoveClip }: TimelineProps) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Timeline</h2>
      <div className="mt-4 space-y-4">
        {clips.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">No clips on the timeline yet.</div>
        ) : (
          clips.map((clip) => (
            <div key={clip.id} className="rounded-2xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{clip.label}</p>
                  <p className="text-xs text-gray-500">Timeline start: {clip.timelineStart.toFixed(1)}s · Duration: {clip.duration.toFixed(1)}s</p>
                </div>
                <button onClick={() => onRemoveClip(clip.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600">
                  Remove
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Source Start: {clip.sourceStart.toFixed(1)}s</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(clip.sourceEnd - 0.1, 0.1)}
                    step="0.1"
                    value={clip.sourceStart}
                    onChange={(e) => onTrimClip(clip.id, Number(e.target.value), clip.sourceEnd)}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Source End: {clip.sourceEnd.toFixed(1)}s</label>
                  <input
                    type="range"
                    min={Math.max(clip.sourceStart + 0.1, 0.1)}
                    max={Math.max(clip.sourceStart + 30, clip.sourceEnd)}
                    step="0.1"
                    value={clip.sourceEnd}
                    onChange={(e) => onTrimClip(clip.id, clip.sourceStart, Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}