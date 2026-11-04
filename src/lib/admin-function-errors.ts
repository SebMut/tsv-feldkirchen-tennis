import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/supabase-js';

/** Display only user-actionable errors; HTTP failures may have a JSON response body. */
export async function explainAdminFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    try {
      const details: unknown = await error.context.clone().json();
      if (details && typeof details === 'object' && !Array.isArray(details)) {
        const message = (details as Record<string, unknown>).error;
        if (typeof message === 'string' && message.trim()) return message.trim();
      }
    } catch {
      // Network/proxy errors may not supply JSON.
    }
    if (status === 401) return 'Die Anmeldung ist abgelaufen. Bitte erneut anmelden.';
    if (status === 403) return 'Dein Konto hat keine Berechtigung für diese Aktion.';
    return 'Der Server meldet HTTP ' + status + '.';
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return 'Supabase ist derzeit über das Netzwerk nicht erreichbar.';
  }
  return error instanceof Error ? error.message : 'Unbekannter Serverfehler.';
}
