import { useEffect, useRef, useState } from "react";
import { api } from "../../api";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]);

function isImage(fileType) {
  return IMAGE_TYPES.has(fileType);
}

export default function TaskAttachments({ taskId, onCountChange }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  async function load() {
    try {
      const data = await api.listAttachments(taskId);
      setAttachments(data);
      onCountChange?.(data.length);
    } catch {}
  }

  useEffect(() => { load(); }, [taskId]);

  async function handleFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await api.uploadAttachment(taskId, file);
      }
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      onCountChange?.(attachments.length - 1);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="attachments">
      <div className="attachments__list">
        {attachments.map((att) => (
          <div key={att.id} className="attachment-item">
            {isImage(att.file_type) ? (
              <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="attachment-item__thumb-link">
                <img
                  src={att.file_path}
                  alt={att.file_name}
                  className="attachment-item__thumb"
                  loading="lazy"
                />
              </a>
            ) : (
              <a
                href={att.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="attachment-item__doc"
              >
                <span className="attachment-item__doc-icon">
                  {att.file_type === "application/pdf" ? "PDF" : "DOC"}
                </span>
                <span className="attachment-item__doc-name">{att.file_name}</span>
              </a>
            )}
            <button
              className="attachment-item__delete"
              onClick={() => handleDelete(att.id)}
              aria-label="מחק קובץ"
              title="מחק"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="attachments__actions">
        {/* Browse files / gallery */}
        <button
          className="attachment-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "מעלה..." : "+ קובץ / תמונה"}
        </button>

        {/* Camera capture — mobile only via CSS, but functional everywhere */}
        <button
          className="attachment-btn attachment-btn--camera"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          צלם
        </button>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
