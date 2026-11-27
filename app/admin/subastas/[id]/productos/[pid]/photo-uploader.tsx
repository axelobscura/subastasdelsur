"use client";

import { useRef, useState, useTransition } from "react";
import { uploadProductImage, type UploadResult } from "../actions";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/** Uploads the chosen photos one at a time (each request stays under the size limit). */
export function PhotoUploader({ auctionId, productId, remaining }: { auctionId: string; productId: string; remaining: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  function upload(files: File[]) {
    startTransition(async () => {
      const out: UploadResult[] = [];
      const queue = files.slice(0, remaining);
      if (files.length > queue.length) out.push({ ok: false, message: `Solo caben ${remaining} fotos más; se omitieron ${files.length - queue.length}.` });
      for (const [i, file] of queue.entries()) {
        setProgress(`Subiendo ${i + 1} de ${queue.length}…`);
        if (file.size > MAX_BYTES) {
          out.push({ ok: false, message: `${file.name}: pesa más de 10 MB.` });
          continue;
        }
        const data = new FormData();
        data.set("auctionId", auctionId);
        data.set("productId", productId);
        data.set("photo", file);
        try {
          out.push(await uploadProductImage(data));
        } catch {
          out.push({ ok: false, message: `${file.name}: no se pudo subir. Inténtalo de nuevo.` });
        }
      }
      setProgress(null);
      setResults(out);
      if (input.current) input.current.value = "";
    });
  }

  if (remaining <= 0) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Este producto ya tiene el máximo de fotos.</p>;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="photos" className="text-sm font-medium">
        Agregar fotos
      </label>
      <input
        ref={input}
        id="photos"
        type="file"
        accept={ACCEPT}
        multiple
        disabled={pending}
        onChange={(e) => upload(Array.from(e.target.files ?? []))}
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-white dark:file:bg-zinc-100 dark:file:text-zinc-900"
      />
      <p className="text-xs text-zinc-500">JPG, PNG, WebP o AVIF, hasta 10 MB cada una. Se optimizan y se les quitan los datos de ubicación.</p>
      {progress ? (
        <p role="status" className="text-sm">
          {progress}
        </p>
      ) : null}
      {results.length ? (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite" data-testid="upload-results">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700 dark:text-red-400"}>
              {r.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
