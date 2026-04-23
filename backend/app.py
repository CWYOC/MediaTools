import json
import uuid
import subprocess
from pathlib import Path
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
PROJECT_DIR = BASE_DIR / "projects"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
PROJECT_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm", "m4v"}
EDITOR_MEDIA_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm", "m4v", "mp3", "wav", "aac", "m4a", "png", "jpg", "jpeg", "webp"}
MAX_FILE_SIZE_MB = 500

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024
CORS(app)


def file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[1].lower() if "." in filename else ""


def save_uploaded_file(file, allowed_extensions):
    if not file or not file.filename:
        raise ValueError("Empty file")

    ext = file_extension(file.filename)
    if ext not in allowed_extensions:
        raise ValueError("Unsupported file type")

    safe_name = secure_filename(file.filename)
    unique_id = uuid.uuid4().hex
    stored_name = f"{unique_id}_{safe_name}"
    file_path = UPLOAD_DIR / stored_name
    file.save(file_path)

    return {
        "file_id": unique_id,
        "original_name": safe_name,
        "stored_name": stored_name,
        "path": file_path,
        "extension": ext,
    }


def build_ffmpeg_command(input_path: Path, output_path: Path, quality: str, target_format: str):
    if target_format == "mp4":
        crf = "20" if quality == "high" else "24" if quality == "standard" else "30"
        return [
            "ffmpeg", "-y", "-i", str(input_path),
            "-c:v", "libx264", "-preset", "medium", "-crf", crf,
            "-c:a", "aac", "-b:a", "128k",
            str(output_path),
        ]

    if target_format == "webm":
        crf = "28" if quality == "high" else "34" if quality == "standard" else "40"
        return [
            "ffmpeg", "-y", "-i", str(input_path),
            "-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0",
            "-c:a", "libopus", "-b:a", "128k",
            str(output_path),
        ]

    if target_format == "mov":
        return [
            "ffmpeg", "-y", "-i", str(input_path),
            "-c:v", "mpeg4", "-q:v", "4",
            "-c:a", "aac", "-b:a", "128k",
            str(output_path),
        ]

    raise ValueError("Unsupported output format")


def build_filter_complex_for_project(project: dict):
    clips = project.get("clips", [])
    text_overlays = project.get("textOverlays", [])
    if not clips:
        raise ValueError("Project contains no clips")

    filter_parts = []
    concat_inputs = []

    for index, clip in enumerate(clips):
        start = float(clip.get("sourceStart", 0))
        end = float(clip.get("sourceEnd", 0))
        if end <= start:
            raise ValueError(f"Clip {index + 1} has invalid trim range")

        filter_parts.append(
            f"[{index}:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{index}]"
        )
        filter_parts.append(
            f"[{index}:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{index}]"
        )
        concat_inputs.append(f"[v{index}][a{index}]")

    concat_count = len(clips)
    filter_parts.append(
        "".join(concat_inputs) + f"concat=n={concat_count}:v=1:a=1[vcat][acat]"
    )

    current_video_label = "vcat"

    if text_overlays:
        drawtext_chain = current_video_label
        for idx, overlay in enumerate(text_overlays):
            text = str(overlay.get("text", "")).replace("'", r"\'").replace(":", r"\:")
            x = int(overlay.get("x", 80))
            y = int(overlay.get("y", 80))
            font_size = int(overlay.get("fontSize", 36))
            start = float(overlay.get("start", 0))
            end = float(overlay.get("end", 3))
            next_label = f"vtxt{idx}"
            filter_parts.append(
                f"[{drawtext_chain}]drawtext=text='{text}':x={x}:y={y}:fontsize={font_size}:fontcolor=white:enable='between(t,{start},{end})'[{next_label}]"
            )
            drawtext_chain = next_label
        current_video_label = drawtext_chain

    return ";".join(filter_parts), current_video_label, "acat"


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Media Tools backend is running.",
        "routes": [
            "/health",
            "/convert-video",
            "/upload-editor-media",
            "/media/<filename>",
            "/save-project",
            "/load-project/<project_id>",
            "/export-project"
        ]
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/media/<filename>", methods=["GET"])
def serve_media(filename):
    media_path = UPLOAD_DIR / filename
    if not media_path.exists():
        return jsonify({"error": "Media not found"}), 404
    return send_file(media_path)


@app.route("/convert-video", methods=["POST"])
def convert_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file uploaded."}), 400

    video = request.files["video"]
    target_format = request.form.get("format", "mp4").lower()
    quality = request.form.get("quality", "standard").lower()

    try:
        upload_info = save_uploaded_file(video, VIDEO_EXTENSIONS)
        input_path = upload_info["path"]
        output_path = OUTPUT_DIR / f"{upload_info['file_id']}.{target_format}"

        command = build_ffmpeg_command(input_path, output_path, quality, target_format)
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            return jsonify({"error": result.stderr or "FFmpeg conversion failed."}), 500

        return send_file(
            output_path,
            as_attachment=True,
            download_name=f"converted.{target_format}",
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/upload-editor-media", methods=["POST"])
def upload_editor_media():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    try:
        upload_info = save_uploaded_file(file, EDITOR_MEDIA_EXTENSIONS)
        return jsonify({
            "file_id": upload_info["file_id"],
            "original_name": upload_info["original_name"],
            "stored_name": upload_info["stored_name"],
            "url": f"/media/{upload_info['stored_name']}"
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.route("/save-project", methods=["POST"])
def save_project():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid project data"}), 400

    project_id = data.get("projectId") or uuid.uuid4().hex
    data["projectId"] = project_id

    project_path = PROJECT_DIR / f"{project_id}.json"
    project_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    return jsonify({"projectId": project_id, "message": "Project saved"})


@app.route("/load-project/<project_id>", methods=["GET"])
def load_project(project_id):
    project_path = PROJECT_DIR / f"{project_id}.json"
    if not project_path.exists():
        return jsonify({"error": "Project not found"}), 404

    data = json.loads(project_path.read_text(encoding="utf-8"))
    return jsonify(data)


@app.route("/export-project", methods=["POST"])
def export_project():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid project data"}), 400

    clips = data.get("clips", [])
    if not clips:
        return jsonify({"error": "No clips to export"}), 400

    export_id = uuid.uuid4().hex
    output_path = OUTPUT_DIR / f"editor_export_{export_id}.mp4"

    try:
        ffmpeg_inputs = []
        for clip in clips:
            stored_name = clip.get("stored_name")
            if not stored_name:
                return jsonify({"error": "Clip missing stored_name"}), 400
            input_path = UPLOAD_DIR / stored_name
            if not input_path.exists():
                return jsonify({"error": f"Missing media file: {stored_name}"}), 404
            ffmpeg_inputs.extend(["-i", str(input_path)])

        filter_complex, final_video_label, final_audio_label = build_filter_complex_for_project(data)

        command = [
            "ffmpeg", "-y",
            *ffmpeg_inputs,
            "-filter_complex", filter_complex,
            "-map", f"[{final_video_label}]",
            "-map", f"[{final_audio_label}]",
            "-c:v", "libx264",
            "-c:a", "aac",
            str(output_path),
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            return jsonify({"error": result.stderr or "Export failed"}), 500

        return send_file(
            output_path,
            as_attachment=True,
            download_name="edited_video.mp4",
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)