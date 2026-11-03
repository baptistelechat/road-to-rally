import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { StageError } from "../../src/geo/errors";
import { parseGeocode, searchPlaces } from "../../src/geo/geocode";

export default async function check(): Promise<void> {
  // Réponse réelle : une adresse avec `label`, un lieu-dit qui n'a qu'un `toponym` et une liste de communes.
  const body = readFileSync("fixtures/geocode/col-de-turini.json", "utf8");
  const results = parseGeocode(body);
  assert.ok(results.length >= 2);
  assert.equal(results[0].label, "Col de Turini 06380 Moulinet");
  assert.deepEqual(results[0].position, { lat: 43.97783, lon: 7.39194 });
  const poi = results.find(({ label }) => label.includes("La Bollène-Vésubie"));
  assert.equal(poi?.label.startsWith("Col de Turini ("), true);

  // Une entrée incomplète est ignorée, une réponse illisible est une erreur affichable.
  assert.deepEqual(
    parseGeocode(
      '{"features":[{"properties":{"label":"Sans point"}},{"geometry":{"coordinates":[1,2]}}]}',
    ),
    [],
  );
  for (const unreadable of ["<html>", "{}"])
    assert.throws(
      () => parseGeocode(unreadable),
      (error) => error instanceof StageError && error.code === "service",
    );

  // La requête annulée ne touche pas au réseau et se reconnaît à son code.
  let calledUrl = "";
  const fakeFetch: typeof fetch = async (input) => {
    calledUrl = String(input);
    return new Response(body);
  };
  await searchPlaces("Col de Turini", { fetch: fakeFetch });
  const url = new URL(calledUrl);
  assert.equal(url.searchParams.get("q"), "Col de Turini");
  assert.equal(url.searchParams.get("limit"), "5");

  calledUrl = "";
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    searchPlaces("Gap", { signal: controller.signal, fetch: fakeFetch }),
    (error) => error instanceof StageError && error.code === "aborted",
  );
  assert.equal(calledUrl, "");
}
