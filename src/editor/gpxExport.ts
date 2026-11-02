import { EDITOR_RUNOFF } from "@/geo/config";
import { assembleTrace } from "./trace";
import type { EditorTrace } from "./types";

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Même tracé, même texte au caractère près. Le seul `<desc>` est le marquage : un autre tromperait `traceFromGpx`. */
export const traceToGpx = (
  trace: Pick<EditorTrace, "name" | "segments" | "returnRoute">,
): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="rally" version="1.1">',
    " <metadata>",
    '  <copyright author="Contributeurs OpenStreetMap">',
    "   <license>https://opendatacommons.org/licenses/odbl/</license>",
    "  </copyright>",
    '  <link href="https://www.openstreetmap.org/copyright"><text>Données OpenStreetMap (ODbL), itinéraire BRouter</text></link>',
    " </metadata>",
    " <trk>",
    `  <name>${escapeXml(trace.name)}</name>`,
    `  <desc>rally-runoff=${EDITOR_RUNOFF}</desc>`,
    "  <trkseg>",
    ...assembleTrace(trace).map(
      ({ lat, lon }) =>
        `   <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"></trkpt>`,
    ),
    "  </trkseg>",
    " </trk>",
    "</gpx>",
    "",
  ].join("\n");
