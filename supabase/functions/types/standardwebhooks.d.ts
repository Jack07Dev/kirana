/** IDE types for Send SMS hook signature verification (Deno resolves via import map). */
declare module 'standardwebhooks' {
  export class Webhook {
    constructor(secret: string);
    verify(payload: string, headers: Record<string, string>): unknown;
  }
}

declare module 'https://esm.sh/standardwebhooks@1.0.0?target=deno' {
  export class Webhook {
    constructor(secret: string);
    verify(payload: string, headers: Record<string, string>): unknown;
  }
}
