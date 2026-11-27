"use client";

import Image from "next/image";
import { useState } from "react";

export type GalleryImage = { src: string; width: number; height: number; alt: string };

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  if (!images.length) return <div className="aspect-[4/3] rounded-xl bg-zinc-100 dark:bg-zinc-900" />;
  const current = images[Math.min(index, images.length - 1)];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
        <Image src={current.src} alt={current.alt} fill priority sizes="(min-width: 1024px) 640px, 100vw" className="object-contain" />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label={`Fotos de ${title}`}>
          {images.map((image, i) => (
            <li key={image.src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                className="relative block size-20 overflow-hidden rounded-md border-2 border-transparent bg-zinc-100 aria-[current=true]:border-zinc-900 dark:bg-zinc-900 dark:aria-[current=true]:border-zinc-100"
              >
                <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
