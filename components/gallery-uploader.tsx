"use client";
import { useState } from "react";
import { resizeToWebp } from "@/utils/img";
import { supabase } from "@/lib/supabaseClient";

interface GalleryUploaderProps {
  onUploadSuccess?: () => void;
}

export default function GalleryUploader({ onUploadSuccess }: GalleryUploaderProps) {
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  async function handleFile(file: File) {
    setMsg(null);
    setProgress(1);
    setPreview(null);

    try {
      if (!/^image\//.test(file.type)) throw new Error("Selecciona una imagen.");
      if (file.size > 1 * 1024 * 1024) throw new Error("Máx 1MB.");

      // 1) Convertir + redimensionar a WebP (1000px)
      const { webp, width, height, bytes, mime } = await resizeToWebp(file, 1000, 0.86);

      // 2) Pedir URL firmada
      const r = await fetch("/api/gallery/signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext: "webp" })
      });
      const { path, token, publicUrl, error } = await r.json();
      if (error) throw new Error(error);
      if (!path || !token || !publicUrl) throw new Error("Firma inválida.");

      // 3) Subir usando el método de Supabase con progreso simulado
      setProgress(10);
      
      const { error: uploadError } = await supabase.storage
        .from('gallery')
        .uploadToSignedUrl(path, token, webp, {
          cacheControl: '31536000',
          contentType: 'image/webp'
        });

      if (uploadError) throw new Error(uploadError.message);
      
      setProgress(90);

      // 4) Finalizar: guardar metadata en tabla
      const fin = await fetch("/api/gallery/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, url: publicUrl, width, height, bytes, mime })
      });
      const finJson = await fin.json();
      if (!fin.ok) throw new Error(finJson.error || "Error guardando metadata");

      setProgress(100);
      setMsg("¡Imagen subida y guardada!");
      setPreview(null); // Remove preview since Gallery will show the updated list
      
      // Trigger gallery refresh
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setMsg(err.message || "Error subiendo");
    } finally {
      setTimeout(() => setProgress(0), 800);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleFile(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      await handleFile(imageFile);
    }
  }

  return (
    <div className="space-y-4 mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${progress > 0 ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">Arrastra tu archivo para subirlo</p>
            <p className="text-sm text-gray-500 mt-1">ó</p>
            <button
              type="button"
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById('file-input')?.click();
              }}
            >
              Escoger archivo
            </button>
          </div>
          
          <p className="text-xs text-gray-500">
            Se convertirá a WebP y se limitará a 1000px de ancho. Tamaño máximo de archivo: 1MB.
          </p>
        </div>
      </div>

      {progress > 0 && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-600 transition-all duration-300 ease-out rounded-full" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}
      
      {msg && (
        <div className={`p-3 rounded-md text-sm ${
          msg.includes('Error') || msg.includes('Máx') 
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {msg}
        </div>
      )}
      
    </div>
  );
}
