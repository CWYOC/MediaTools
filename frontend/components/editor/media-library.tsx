"use client";

export type EditorMediaItem = {
  file_id: string;
  original_name: string;
  stored_name: string;
  url: string;
};

type MediaLibraryProps = {
  items: EditorMediaItem[];
  onAddClip: (item: EditorMediaItem) => void;
};

export default function MediaLibrary({ items, onAddClip }: MediaLibraryProps) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Media Library</h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-gray-500">No uploaded media yet.</div>
        ) : (
          items.map((item) => (
            <div key={item.file_id} className="rounded-xl border p-3">
              <p className="truncate text-sm font-medium">{item.original_name}</p>
              <button onClick={() => onAddClip(item)} className="mt-3 rounded-lg bg-black px-3 py-2 text-sm text-white">
                Add to Timeline
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}