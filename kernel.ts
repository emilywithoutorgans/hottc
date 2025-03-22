import { Term } from "./term.js";

type Judgement = { kind: "TYPE", value: Term };
type Context = Record<string, Judgement>;

function betaReduction(term: Term, name: string, sub: Term): Term {
    switch (term.kind) {
        case "ZERO":
        case "ONE":
        case "UN":
        case "SINGLETON":
            return term;
        case "CALL":
            return { kind: "CALL", base: betaReduction(term.base, name, sub), arg: betaReduction(term.arg, name, sub) };
        case "IDENTIFIER":
            if (term.value === name) {
                return sub;
            } else {
                return term;
            }
        case "ABSTRACTION":
            if (term.ident.value === name) {
                return term;
            } else {
                return { kind: "ABSTRACTION", ident: term.ident, body: betaReduction(term.body, name, sub) };
            }
        case "PI":
            if (term.ident?.value === name) {
                return term;
            } else {
                return { kind: "PI", ident: term.ident, left: betaReduction(term.left, name, sub), right: betaReduction(term.right, name, sub) };
            }
    }
}

function whnormalize(term: Term) {
    let prevTerm; do {
        prevTerm = term;
        if (term.kind === "CALL" && term.base.kind === "ABSTRACTION") {
            term = betaReduction(term.base.body, term.base.ident.value, term.arg);
        }
    } while (term !== prevTerm)
    return term;
}

export function infer(term: Term, termContext: Context): Term {
    switch (term.kind) {
        case "SINGLETON":
            return { kind: "ONE" };
        case "ZERO":
        case "ONE":
            return { kind: "UN", level: 0 };
        case "UN":
            return { kind: "UN", level: term.level + 1 };
        case "IDENTIFIER": {
            return termContext[term.value].value;
        }
        case "PI": {
            // x: A -> B(x)
            const a = infer(term.left, termContext);
            if (a.kind !== "UN") throw new Error("malformed pi type");
            const newTermContext: Context = term.ident ? { ...termContext, [term.ident.value]: { kind: "TYPE", value: term.left } } : termContext;
            const bx = infer(term.right, newTermContext);
            if (bx.kind !== "UN") throw new Error("malformed pi type");
            return { kind: "UN", level: Math.max(a.level, bx.level) };
        }
        case "ABSTRACTION": {
            // pruning not implemented
            if (term.type === undefined) throw new Error("type cannot be inferred");
            const normalizedKind = whnormalize(infer(term.type, termContext));
            if (normalizedKind.kind !== "UN") throw new Error("must be a type");
            const judgement: Judgement = { kind: "TYPE", value: term.type };
            const newTermContext: Context = { ...termContext, [term.ident.value]: judgement };
            const returnType = infer(term.body, newTermContext);
            return { kind: "PI", ident: term.ident, left: term.type, right: returnType };
        }
        case "CALL": {
            // pi elimination
            // (f: (x: A -> B), a: A) => f(a): B[a / x]
            const fType = whnormalize(infer(term.base, termContext));
            if (fType.kind !== "PI") throw new Error("calls only valid on functions");
            const argType = infer(term.arg, termContext);
            if (!checkEq(fType.left, argType, {})) throw new Error("call type mismatch");
            return fType.ident ? betaReduction(fType.right, fType.ident.value, term.arg) : fType.right;
        }
    }
}

export function checkEq(left: Term, right: Term, context: Record<string, string | null>) {
    if (left.kind === "ZERO" && right.kind === "ZERO") {
        return true;
    } else if (left.kind === "ONE" && right.kind === "ONE") {
        return true;
    } else if (left.kind === "SINGLETON" && right.kind === "SINGLETON") {
        return true;
    } else if (left.kind === "UN" && right.kind === "UN") {
        if (left.level === right.level) {
            return true;
        }
    } else if (left.kind === "PI" && right.kind === "PI") {
        // check the ident types
        let newContext = context;
        if (!!left.ident === !!right.ident) {
            if (left.ident !== undefined) {
                // assume that the idents are equal
                newContext = { ...context, [left.ident.value]: right.ident!.value };
            }
        } else if (left.ident !== undefined) {
            newContext = { ...context, [left.ident.value]: null };
        } else if (right.ident !== undefined) {
            newContext = { ...context, [right.ident.value]: null };
        }

        if (checkEq(left.left, right.left, context)) {
            if (checkEq(left.right, right.right, newContext)) {
                return true;
            }
        }
    } else if (left.kind === "IDENTIFIER" && right.kind === "IDENTIFIER") {
        // if the identifiers should go unused
        if (left.value === null || right.value === null) {
            return false;
        }

        // if they're in the same context, two of the same identifiers are equal
        if (left.value === right.value) {
            return true;
        }

        // if the context assumes that the left is equal to the right, then it's a valid equality
        if (context[left.value] === right.value) {
            return true;
        }
    }
}

export function check(term: Term, termContext: Context, type: Term, typeContext: Record<string, string>) {
    const inferred = infer(term, termContext);
    if (checkEq(inferred, type, typeContext)) {
        return true;
    }
    const lnormal = whnormalize(inferred);
    const rnormal = whnormalize(type);
    if (lnormal.kind === "UN" && rnormal.kind === "UN") {
        return lnormal.level <= rnormal.level;
    }
}
