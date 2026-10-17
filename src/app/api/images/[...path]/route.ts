import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dataDir, resolveStoredPath } from "@/lib/storage";
import { decideImageAccess, type ImageViewer } from "@/lib/listings/imageAccess";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// Serves uploaded images from DATA_DIR (path-traversal guarded). Photos of a
// home that is not public yet (draft, waiting for review, rejected, taken
// down) go only to the owner, the creating agency or an admin.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const abs = resolveStoredPath(parts.join("/"));
  if (!abs) return new Response("Not found", { status: 404 });
  // Look the photo up by the path we will actually serve (normalised, with
  // any "./" or "//" tricks removed), never by the raw URL text.
  const rel = path.relative(dataDir(), abs).split(path.sep).join("/");

  const ext = abs.slice(abs.lastIndexOf("."));
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return new Response("Not found", { status: 404 });

  // Which home does this photo belong to? (null = not linked to any home)
  const image = await prisma.propertyImage.findFirst({
    where: { storagePath: rel },
    select: {
      property: {
        select: { listings: { select: { status: true, createdById: true, agencyId: true } } },
      },
    },
  });
  const listings = image ? image.property.listings : null;

  // Only look at the session when it matters (keeps public photos cacheable).
  let viewer: ImageViewer = null;
  if (listings && listings.length > 0 && !listings.some((l) => l.status === "ACTIVE")) {
    const session = await auth();
    if (session?.user?.id) {
      viewer = {
        userId: session.user.id,
        role: session.user.role,
        agencyId: session.user.agencyId,
      };
    }
  }
  const access = decideImageAccess(listings, viewer);
  if (access === "deny") return new Response("Not found", { status: 404 });

  try {
    const buf = await readFile(abs);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          access === "public" ? "public, max-age=31536000, immutable" : "private, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
