import { StageError } from "./errors";

export interface HttpOptions {
  signal?: AbortSignal;
  /** Remplaçable pour les vérifications sans réseau */
  fetch?: typeof fetch;
  /** Remplaçable pour ne pas attendre les reprises dans les vérifications */
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

export interface RetryPolicy {
  /** Nom du service dans les messages */
  service: string;
  retries: number;
  /** Attente avant la reprise numéro `attempt`, à partir de 0 */
  delay: (attempt: number) => number;
  timeout: number;
  shouldRetry: (status: number) => boolean;
}

const aborted = (): StageError =>
  new StageError("aborted", "Génération annulée.");

const defaultSleep = (
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(aborted());
      },
      { once: true },
    );
  });

export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw aborted();
};

/** Renvoie le corps de la réponse. Les requêtes partent une par une : les appelants les attendent toutes. */
export const requestText = async (
  url: string,
  init: RequestInit,
  policy: RetryPolicy,
  options: HttpOptions,
): Promise<string> => {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  let failure = new StageError(
    "network",
    `${policy.service} est injoignable. Vérifie ta connexion puis réessaie.`,
  );
  for (let attempt = 0; attempt <= policy.retries; attempt++) {
    if (attempt > 0) await sleep(policy.delay(attempt - 1), options.signal);
    throwIfAborted(options.signal);
    const timeout = AbortSignal.timeout(policy.timeout);
    try {
      const response = await doFetch(url, {
        ...init,
        signal: options.signal
          ? AbortSignal.any([options.signal, timeout])
          : timeout,
      });
      if (response.ok) return await response.text();
      failure = new StageError(
        "service",
        `${policy.service} a répondu par une erreur ${response.status}. Réessaie dans un moment.`,
      );
      if (!policy.shouldRetry(response.status)) throw failure;
    } catch (error) {
      throwIfAborted(options.signal);
      if (error instanceof StageError) throw error;
      failure = new StageError(
        "network",
        `${policy.service} est injoignable. Vérifie ta connexion puis réessaie.`,
      );
    }
  }
  throw failure;
};
