import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolveKey } from "@/lib/storage";

// Serves uploaded photos from UPLOAD_DIR. Keys are random and never reused, so the files can
// be cached forever. resolveKey only accepts our own key format, which blocks path traversal.
export async function GET(_request: Request, ctx: RouteContext<"/media/[...key]">) {
  const { key } = await ctx.params;
  const file = resolveKey(key.join("/"));
  if (!file) return new Response("Not found", { status: 404 });

  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
