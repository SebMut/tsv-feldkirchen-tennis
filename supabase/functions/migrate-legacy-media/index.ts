import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() => new Response("Legacy media migration completed and disabled.", { status: 410 }));
