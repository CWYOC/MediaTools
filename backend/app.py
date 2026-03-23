import uuid
import subprocess
from pathlib import Path
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm", "m4v"}
MAX_FILE_SIZE_MB = 500

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_MB * 1024 * 1024
CORS(app)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/convert-video", methods=["POST"])
def convert_video():
    if "video" not in request.files:
        return jsonify({"error": "No video file uploaded."}), 400

    video = request.files["video"]
    target_format = request.form.get("format", "mp4").lower()
    quality = request.form.get("quality", "standard").lower()

    if not video.filename:
        return jsonify({"error": "Empty filename."}), 400

    if not allowed_file(video.filename):
        return jsonify({"error": "Unsupported file type."}), 400

    safe_name = secure_filename(video.filename)
    unique_id = uuid.uuid4().hex
    input_ext = safe_name.rsplit(".", 1)[1].lower()
    input_path = UPLOAD_DIR / f"{unique_id}.{input_ext}"
    output_path = OUTPUT_DIR / f"{unique_id}.{target_format}"

    try:
        video.save(input_path)
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
    finally:
        try:
            if input_path.exists():
                input_path.unlink()
        except Exception:
            pass

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)