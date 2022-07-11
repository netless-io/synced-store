declare module "white-web-sdk" {
  export function isRoom(displayer: Displayer): displayer is Room;
}

export const isObject = <O>(obj?: O): obj is O =>
  typeof obj === "object" && obj !== null;

export const ensureObject = (obj: any, method: string): void => {
  if (!isObject(obj)) {
    throw new TypeError(
      `[SyncedStore]: ${method} expects an object, got ${typeof obj}`
    );
  }
};

const objHas = Object.prototype.hasOwnProperty;

export const has = <O, K extends string>(
  obj: O,
  key: K
): obj is O & Record<K, Required<O>[Extract<K, keyof O>]> => {
  return objHas.call(obj, key);
};

export const plainObjectKeys = Object.keys as <T>(
  o: T
) => Array<Extract<keyof T, string>>;

export const toJS = <O>(obj: O): O => {
  return isObject(obj) ? JSON.parse(JSON.stringify(obj)) : obj;
};
