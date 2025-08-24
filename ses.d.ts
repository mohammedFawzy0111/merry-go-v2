declare class Compartment {
  constructor(endowments?: Record<string, any>, modules?: Record<string, any>);
  evaluate(code: string): any;
  globalThis: any;
}
