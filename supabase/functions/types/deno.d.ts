/// Deno types for Supabase Edge Functions (IDE only; runtime provides Deno).
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};
