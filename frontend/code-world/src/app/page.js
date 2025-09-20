"use client";

import { useEffect, useState } from "react";

const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size < 10 && unitIndex > 0 ? 1 : 0;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Cleanup preview URLs when the component unmounts.
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setMessage("");
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      if (selectedFile && selectedFile.type.startsWith("image/")) {
        return URL.createObjectURL(selectedFile);
      }
      return null;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setMessage("Please choose a file to upload.");
      return;
    }

    const endpoint = process.env.NEXT_PUBLIC_UPLOAD_ENDPOINT ?? "/api/upload";
    const formData = new FormData();
    formData.append("file", file);

    setMessage("Uploading...");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      let payload;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch (error) {
        payload = responseText;
      }

      if (!response.ok) {
        const errorMessage =
          typeof payload === "string"
            ? payload || "Upload failed."
            : payload?.error || payload?.message || "Upload failed.";
        throw new Error(errorMessage);
      }

      const successMessage =
        typeof payload === "string"
          ? payload || `Uploaded "${file.name}" (${formatFileSize(file.size)}).`
          : payload?.message ||
            payload?.detail ||
            `Uploaded "${file.name}" (${formatFileSize(file.size)}).`;

      setMessage(successMessage);
      setFile(null);
      setPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return null;
      });
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 flex items-center justify-center p-6">
      <main className="w-full max-w-xl space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Upload a file</h1>
          <p className="text-sm text-slate-300">
            Select a file from your device and submit it to start the upload process.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <label
            htmlFor="file-input"
            className="relative flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-slate-500 bg-slate-800/40 p-8 text-center transition hover:border-slate-300 hover:bg-slate-800/60"
          >
            <span className="text-sm font-medium text-slate-200">
              Drag & drop your file here
            </span>
            <span className="mt-1 text-xs text-slate-400">or click to browse</span>
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>

          {file && (
            <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left">
              <p className="text-sm font-semibold text-slate-100">Selected file</p>
              <p className="text-sm text-slate-300">
                {file.name} · {formatFileSize(file.size)}
              </p>
              {previewUrl && (
                <div className="overflow-hidden rounded-xl border border-slate-700">
                  <img
                    src={previewUrl}
                    alt="File preview"
                    className="h-48 w-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-full bg-emerald-500 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            Upload file
          </button>
        </form>

        {message && (
          <p className="text-center text-sm text-emerald-200">{message}</p>
        )}
      </main>
    </div>
  );
}
