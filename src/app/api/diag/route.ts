import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_BYTES = 16 * 1024 * 1024;

/** Écrit une capture de diagnostic dans `diag/`, pour l'analyser depuis le projet. Développement seulement. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development")
    return new Response(null, { status: 404 });

  // Le serveur de dev écoute le réseau local : seule la page du jeu peut écrire.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    return new Response(null, { status: 403 });

  const body = await request.text();
  if (body.length > MAX_BYTES) return new Response(null, { status: 413 });
  try {
    JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }

  const directory = join(process.cwd(), "diag");
  await mkdir(directory, { recursive: true });
  const file = `diag-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(join(directory, file), body);
  return Response.json({ file });
}
