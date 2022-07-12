import { describe, it, expect } from "vitest";
import { makeRefineValue, Refine } from "../src/refine";

describe("Refine", () => {
  const initialState = Object.freeze({ a: true, b: [] });

  it("constructor (no arguments)", () => {
    const refine = new Refine();
    expect(refine.state).toEqual({});
  });

  it("constructor (with initial state)", () => {
    const refine = new Refine(initialState);
    expect(refine.state).toEqual(initialState);
  });

  it("setValue", () => {
    const refine = new Refine<Record<string, any>>(initialState);
    expect(refine.setValue("b", refine.state.b)).toBe(null);

    const diffA = refine.setValue("a", false);
    expect(diffA?.oldValue).toBe(true);
    expect(diffA?.newValue).toBe(false);

    const diffC = refine.setValue("c", "c");
    expect(diffC?.oldValue).toBeUndefined();
    expect(diffC?.newValue).toBe("c");
  });

  it("replaceState", () => {
    const refine = new Refine();

    const diffs = refine.replaceState(initialState);
    expect(diffs).toBeDefined();
    expect(diffs?.a?.newValue).toBe(true);
    expect(diffs?.b?.newValue).toEqual(initialState.b);

    const diffs1 = refine.replaceState(initialState);
    expect(diffs1).toBeNull();

    const diffs2 = refine.replaceState({
      ...initialState,
      c: "g",
      a: undefined,
    });
    expect(diffs2).toBeDefined();
    expect(diffs2?.c?.oldValue).toBeUndefined();
    expect(diffs2?.c?.newValue).toBe("g");
    expect(diffs2?.a?.newValue).toBeUndefined();
    expect(refine.state).not.toHaveProperty("a");
    expect(refine.state).toEqual({ b: [], c: "g" });
  });

  it("handle reference state", () => {
    const refState = { a: makeRefineValue({ b: [] }), c: "c" };
    const refine = new Refine(refState);
    expect(refine.state.a).toBe(refState.a.v);
    expect(refine.state.c).toBe(refState.c);

    expect(refine.setValue("a", refState.a)).toBeNull();
    expect(refine.setValue("a", refState.a.v)).toBeNull();
    expect(refine.setValue("a", { ...refState.a.v })).toBeDefined();
  });
});
