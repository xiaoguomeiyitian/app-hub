declare module 'csurf' {
  import { RequestHandler } from 'express';
  function csurf(options?: csurf.Options): RequestHandler;
  namespace csurf {
    interface Options {
      cookie?: boolean | { [key: string]: any };
      value?: (req: any) => string | undefined | null;
    }
  }
  export = csurf;
}
