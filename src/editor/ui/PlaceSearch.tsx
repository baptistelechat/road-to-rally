"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useMap } from "@/components/ui/map";
import { StageError } from "@/geo/errors";
import {
  GEOCODE_MIN_LENGTH,
  searchPlaces,
  type GeocodeResult,
} from "@/geo/geocode";

const SEARCH_DELAY = 300;
/** Assez près pour lire les petites routes autour du lieu trouvé */
const PLACE_ZOOM = 13;

interface PendingSearch {
  timer: number;
  controller: AbortController;
}

const cancelSearch = (pending: RefObject<PendingSearch | null>) => {
  if (!pending.current) return;
  clearTimeout(pending.current.timer);
  pending.current.controller.abort();
  pending.current = null;
};

/** Déplace la carte sans poser de point. À placer dans `Map`. */
export const PlaceSearch = () => {
  const { map } = useMap();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const pending = useRef<PendingSearch | null>(null);

  useEffect(() => () => cancelSearch(pending), []);

  const search = async (text: string, controller: AbortController) => {
    setStatus("Recherche…");
    try {
      const found = await searchPlaces(text, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setResults(found);
      setActive(-1);
      setOpen(true);
      setStatus(
        found.length === 0
          ? "Aucun lieu trouvé."
          : found.length === 1
            ? "1 lieu trouvé."
            : `${found.length} lieux trouvés.`,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setResults([]);
      setStatus(
        error instanceof StageError ? error.message : "La recherche a échoué.",
      );
    }
  };

  const handleChange = (value: string) => {
    cancelSearch(pending);
    setQuery(value);
    setResults([]);
    setActive(-1);
    setStatus("");
    const text = value.trim();
    if (text.length < GEOCODE_MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void search(text, controller),
      SEARCH_DELAY,
    );
    pending.current = { timer, controller };
  };

  const pick = ({ label, position }: GeocodeResult) => {
    cancelSearch(pending);
    setQuery(label);
    setResults([]);
    setOpen(false);
    setStatus("");
    map?.flyTo({ center: [position.lon, position.lat], zoom: PLACE_ZOOM });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      const result = results[Math.max(active, 0)];
      if (result) pick(result);
      return;
    }
    if (results.length === 0) return;
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setOpen(true);
    setActive((active + step + results.length) % results.length);
  };

  const expanded = open && results.length > 0;

  return (
    <div className="absolute top-2 left-2 z-10 w-72 max-w-[calc(100%-1rem)] rounded-lg border bg-background p-2 text-sm shadow-md">
      <label htmlFor={baseId} className="mb-1 block text-xs font-medium">
        Rechercher un lieu
      </label>
      <input
        id={baseId}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        placeholder="Col de Turini, Gap…"
        value={query}
        className="w-full rounded-md border border-input bg-transparent px-2 py-1 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onChange={(event) => handleChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Lieux trouvés"
        hidden={!expanded}
        className="mt-1"
      >
        {results.map((result, index) => (
          <li
            key={`${result.label}-${index}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            className={`cursor-pointer rounded px-2 py-1 hover:bg-muted ${index === active ? "bg-muted" : ""}`}
            // Garde le focus dans le champ : son `blur` fermerait la liste avant le clic.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(result)}
          >
            {result.label}
          </li>
        ))}
      </ul>
      <p
        aria-live="polite"
        className="mt-1 text-xs text-muted-foreground empty:hidden"
      >
        {status}
      </p>
    </div>
  );
};
