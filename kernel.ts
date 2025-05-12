import { Term } from "./term.js";
import { Identifier } from "./lex.js";

type Judgement = { kind: "TYPE", value: Term };
type Context = Record<string, Judgement>;

// normalize calls
function betaReduction(term: Term, name: string, sub: Term): Term {
    switch (term.kind) {
        case "ZERO":
        case "ONE":
        case "UN":
        case "SINGLETON":
            return term;
        case "IDENTIFIER":
            if (term.value === name) {
                return sub;
            } else {
                return term;
            }
        case "CALL":
            return { kind: "CALL", base: betaReduction(term.base, name, sub), arg: betaReduction(term.arg, name, sub) };
        case "PR":
            return { kind: "PR", first: term.first, arg: betaReduction(term.arg, name, sub) };
        case "PI": {
            let right;
            if (term.ident?.value === name) {
                right = term.right;
            } else {
                right = betaReduction(term.right, name, sub);
            }
            return { kind: "PI", ident: term.ident, left: betaReduction(term.left, name, sub), right };
        }
        case "ABSTRACTION": {
            let body;
            if (term.ident.value === name) {
                body = term.body;
            } else {
                body = betaReduction(term.body, name, sub);
            }
            return { kind: "ABSTRACTION", ident: term.ident, type: betaReduction(term.type, name, sub), body };
        }
        case "SIGMA": {
            let right;
            if (term.ident?.value === name) {
                right = term.right;
            } else {
                right = betaReduction(term.right, name, sub);
            }
            return { kind: "SIGMA", ident: term.ident, left: betaReduction(term.left, name, sub), right };
        }
        case "TUPLE": {
            let right;
            if (term.ident?.value === name) {
                right = term.right;
            } else {
                right = betaReduction(term.right, name, sub);
            }
            return { kind: "TUPLE", ident: term.ident, left: betaReduction(term.left, name, sub), right };
        }
    }
}

function whnormalize(term: Term) {
    let prevTerm; do {
        prevTerm = term;
        if (term.kind === "CALL" && term.base.kind === "ABSTRACTION") {
            term = betaReduction(term.base.body, term.base.ident.value, term.arg);
        } else if (term.kind === "PR" && term.arg.kind === "TUPLE") {
            // projecting a term here
            let result: Term = term.arg.left; // first projection is easy
            if (!term.first) {
                if (term.arg.ident === undefined) {
                    // (a, b)
                    result = term.arg.right; // if it's not dependent, second projection is easy
                } else {
                    // (x := a, b) where b may depend on x
                    result = betaReduction(term.arg.right, term.arg.ident.value, term.arg.left);
                }
            }
            term = result;
        }
    } while (term !== prevTerm)
    return term;
}

function getMaxUniverseLevelFromDependentType(term: { left: Term, right: Term, ident?: Identifier }, termContext: Context, typeName: string): Term {
    const a = infer(term.left, termContext);
    if (a.kind !== "UN") throw new Error(`malformed ${typeName} type`);
    const newTermContext: Context = term.ident ? { ...termContext, [term.ident.value]: { kind: "TYPE", value: term.left } } : termContext;
    const bx = infer(term.right, newTermContext);
    if (bx.kind !== "UN") throw new Error(`malformed ${typeName} type`);
    return { kind: "UN", level: Math.max(a.level, bx.level) };
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
            return getMaxUniverseLevelFromDependentType(term, termContext, "pi");
        }
        case "ABSTRACTION": {
            // \x: A. B(x)
            // x: A -> typeof B(x)
            // pruning not implemented
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
            if (!checkEq(fType.left, argType, {})) throw new Error(`call type mismatch: ${termToString(fType.left)} != ${termToString(argType)}`);
            return fType.ident ? betaReduction(fType.right, fType.ident.value, term.arg) : fType.right;
        }
        case "SIGMA": {
            // [x: A, B(x)], identical logic to pi
            return getMaxUniverseLevelFromDependentType(term, termContext, "sigma");
        }
        case "PR": {
            // sigma projection
            // p: [x: A, B] => pr1 p: A
            // p: [x: A, B] => pr2 p: B[pr1 p / x]

            const argType = infer(term.arg, termContext);

            // we're projecting sigma types here

            if (argType.kind !== "SIGMA") throw new Error("can only project tuples");

            let result: Term = argType.left; // first projection is easy
            if (!term.first) {
                if (argType.ident === undefined) {
                    result = argType.right; // if it's not dependent, second projection is easy
                } else {
                    // pr1 arg
                    // [x: A, B(x)]
                    // replace x with pr1(arg)
                    const sub = whnormalize({ kind: "PR", first: true, arg: term.arg });
                    result = betaReduction(argType.right, argType.ident.value, sub);
                }
            }

            return result;
        }
        case "TUPLE": {
            if (term.ident !== undefined) {
                // given y: A,
                // (x := y, B(x))
                // [x: A, B(x)]
                // identical to abstraction logic
                const leftType = infer(term.left, termContext);
                const judgement: Judgement = { kind: "TYPE", value: leftType };
                const newTermContext: Context = { ...termContext, [term.ident.value]: judgement };
                const rightType = infer(term.right, newTermContext);
                return { kind: "SIGMA", ident: term.ident, left: leftType, right: rightType };
            } else {
                const leftType = infer(term.left, termContext);
                const rightType = infer(term.right, termContext);
                return { kind: "SIGMA", left: leftType, right: rightType };
            }
        }
    }
}

export function checkEq(left: Term, right: Term, context: Record<string, string | null>) {
    function assume(left: Identifier | undefined, right: Identifier | undefined) {
        if (left !== undefined && right !== undefined) {
            // assume that the idents are equal
            return { ...context, [left.value]: right.value };
        } else if (left !== undefined) {
            return { ...context, [left.value]: null };
        } else if (right !== undefined) {
            return { ...context, [right.value]: null };
        }
        return context;
    }


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
        if (checkEq(left.left, right.left, context)) {
            const newContext = assume(left.ident, right.ident);
            if (checkEq(left.right, right.right, newContext)) {
                return true;
            }
        }
    } else if (left.kind === "ABSTRACTION" && right.kind === "ABSTRACTION") {
        if (checkEq(left.type, right.type, context)) {
            const newContext = assume(left.ident, right.ident);
            if (checkEq(left.body, right.body, newContext)) {
                return true;
            }
        }
    } else if (left.kind === "SIGMA" && right.kind === "SIGMA") {
        if (checkEq(left.left, right.left, context)) {
            const newContext = assume(left.ident, right.ident);
            if (checkEq(left.right, right.right, newContext)) {
                return true;
            }
        }
    } else if (left.kind === "TUPLE" && right.kind === "TUPLE") {
        if (checkEq(left.left, right.left, context)) {
            const newContext = assume(left.ident, right.ident);
            if (checkEq(left.right, right.right, newContext)) {
                return true;
            }
        }
    } else if (left.kind === "PR" && right.kind === "PR") {
        if (left.first === right.first) {
            if (checkEq(left.arg, right.arg, context)) {
                return true;
            }
        }
    } else if (left.kind === "CALL" && right.kind === "CALL") {
        if (checkEq(left.base, right.base, context)) {
            if (checkEq(left.arg, right.arg, context)) {
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
