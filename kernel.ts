import { Term } from "./term.js";
import { Identifier } from "./lex.js";

export type Judgement = { kind: "TYPE", value: Term } | { kind: "DEF", value: Term, type: Term };
export type Context = Record<string, Judgement>;
type EqContext = Record<string, Judgement | { kind: "MAYBEEQ", other: string } | { kind: "KILLED" }>

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
        case "REFL":
            return { kind: "REFL", arg: betaReduction(term.arg, name, sub) };
        case "PATH":
            return { kind: "PATH", left: betaReduction(term.left, name, sub), type: betaReduction(term.type, name, sub), right: betaReduction(term.right, name, sub) };
        case "UNIVALENCE":
            return { kind: "UNIVALENCE", inner: betaReduction(term.inner, name, sub) };
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

function whnormalize(term: Term, context: EqContext): Term {
    let prevTerm; do {
        prevTerm = term;
        if (term.kind === "IDENTIFIER") {
            const judgement = context[term.value];
            if (judgement !== undefined && judgement.kind === "DEF") {
                return judgement.value;
            }
        } else if (term.kind === "CALL") {
            const base = whnormalize(term.base, context);
            if (base.kind === "ABSTRACTION") {
                term = betaReduction(base.body, base.ident.value, term.arg);
            } else if (base.kind === "CALL") {
                const basebase = whnormalize(base.base, context);
                if (basebase.kind === "REFL") {
                    // (refl x)(P)(Px) = Px
                    term = term.arg;
                }
            }
        } else if (term.kind === "PR") {
            const arg = whnormalize(term.arg, context);
            if (arg.kind === "TUPLE") {
                // projecting a term here
                let result: Term = arg.left; // first projection is easy
                if (!term.first) {
                    if (arg.ident === undefined) {
                        // (a, b)
                        result = arg.right; // if it's not dependent, second projection is easy
                    } else {
                        // (x := a, b) where b may depend on x
                        result = betaReduction(arg.right, arg.ident.value, arg.left);
                    }
                }
                term = result;
            }
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

function equivalence(a: Term, b: Term): Term {
    // x: type -> f(g(x)) =[type] x
    const homotopyCompositionToId = (type: Term, f: Term, g: Term): Term => ({ kind: "PI", ident: { kind: "IDENTIFIER", value: "x" }, left: type, right: { kind: "PATH", left: { kind: "CALL", base: f, arg: { kind: "CALL", base: g, arg: { kind: "IDENTIFIER", value: "x" } } }, type, right: { kind: "IDENTIFIER", value: "x" }} })

    // [g: B -> A, homotopyToId(comp(f, g))]
    const ghtpy: Term = { kind: "SIGMA", ident: { kind: "IDENTIFIER", value: "g" }, left: { kind: "PI", left: b, right: a }, right: homotopyCompositionToId(b, { kind: "IDENTIFIER", value: "f" }, { kind: "IDENTIFIER", value: "g" }) }

    // [h: B -> A, homotopyToId(comp(h, f))]
    const hhtpy: Term = { kind: "SIGMA", ident: { kind: "IDENTIFIER", value: "h" }, left: { kind: "PI", left: b, right: a }, right: homotopyCompositionToId(a, { kind: "IDENTIFIER", value: "h" }, { kind: "IDENTIFIER", value: "f" }) }

    return { kind: "SIGMA", left: ghtpy, right: hhtpy };
}

export function infer(term: Term, context: Context): Term {
    switch (term.kind) {
        case "SINGLETON":
            return { kind: "ONE" };
        case "ZERO":
        case "ONE":
            return { kind: "UN", level: 0 };
        case "UN":
            return { kind: "UN", level: term.level + 1 };
        case "IDENTIFIER": {
            const judgement = context[term.value];
            if (judgement.kind === "TYPE") {
                return judgement.value;
            } else if (judgement.kind === "DEF") {
                return judgement.type;
            }
            return judgement;
        }
        case "PI": {
            // x: A -> B(x)
            return getMaxUniverseLevelFromDependentType(term, context, "pi");
        }
        case "ABSTRACTION": {
            // \x: A. B(x)
            // x: A -> typeof B(x)
            // pruning not implemented
            const normalizedKind = whnormalize(infer(term.type, context), context);
            if (normalizedKind.kind !== "UN") throw new Error("must be a type");
            const newTermContext: Context = { ...context, [term.ident.value]: { kind: "TYPE", value: term.type } };
            const returnType = infer(term.body, newTermContext);
            return { kind: "PI", ident: term.ident, left: term.type, right: returnType };
        }
        case "CALL": {
            const baseType = whnormalize(infer(term.base, context), context);
            const argType = infer(term.arg, context);

            if (baseType.kind === "PI") {
                // pi elimination
                // (f: (x: A -> B), a: A) => f(a): B[a / x]

                if (!checkEq(baseType.left, argType, {})) throw new Error("call type mismatch");
                return baseType.ident ? betaReduction(baseType.right, baseType.ident.value, term.arg) : baseType.right;
            } else if (baseType.kind === "PATH" && argType.kind === "PI") {
                // transport
                // (p: a =[A] b, P: (x: A -> U0)) => p(P): P(a) -> P(b)

                if (!checkEq(baseType.type, argType.left, {})) throw new Error("path type mismatch");
                return { kind: "PI", left: { kind: "CALL", base: term.arg, arg: baseType.left }, right: { kind: "CALL", base: term.arg, arg: baseType.right } };
            }
            throw new Error("calls only valid on functions and paths");
        }
        case "SIGMA": {
            // [x: A, B(x)], identical logic to pi
            return getMaxUniverseLevelFromDependentType(term, context, "sigma");
        }
        case "PR": {
            // sigma projection
            // p: [x: A, B] => pr1 p: A
            // p: [x: A, B] => pr2 p: B[pr1 p / x]

            const argType = infer(term.arg, context);

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
                    const sub = whnormalize({ kind: "PR", first: true, arg: term.arg }, context);
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
                const leftType = infer(term.left, context);
                const newTermContext: Context = { ...context, [term.ident.value]: { kind: "TYPE", value: leftType } };
                const rightType = infer(term.right, newTermContext);
                return { kind: "SIGMA", ident: term.ident, left: leftType, right: rightType };
            } else {
                const leftType = infer(term.left, context);
                const rightType = infer(term.right, context);
                return { kind: "SIGMA", left: leftType, right: rightType };
            }
        }
        case "REFL": 
            return { kind: "PATH", left: term.arg, type: infer(term.arg, context), right: term.arg };
        case "PATH": 
            return infer(term.type, context);
        case "UNIVALENCE": {
            const innerType = infer(term.inner, context);
            if (innerType.kind === "PATH") {
                const left = innerType.left;
                const right = innerType.right;

                if (infer(left, context).kind !== "UN" || infer(right, context).kind !== "UN") 
                    throw new Error("univalence must be between types");

                // return an equivalence
                return equivalence(left, right);
            } else if (innerType.kind === "SIGMA") {
                // Check if this is an equivalence type
                if (innerType.left.kind === "SIGMA" && 
                    innerType.left.left.kind === "PI") {
                    
                    const a = innerType.left.left.right;
                    const aType = infer(a, context);
                    if (aType.kind !== "UN") throw new Error("univalence must be between types"); // hopefully unreachable
                    const b = innerType.left.left.left;
                    const bType = infer(b, context);
                    if (bType.kind !== "UN") throw new Error("univalence must be between types");

                    // check if the equivalence is valid
                    if (checkEq(innerType, equivalence(a, b), {})) {
                        return { kind: "PATH", left: a, type: { kind: "UN", level: Math.max(aType.level, bType.level) }, right: b };
                    }
                }
            }
            throw new Error("can only do univalence on paths or equivalences");
        }
    }
}

function checkEq(left: Term, right: Term, context: EqContext) {
    left = whnormalize(left, context);
    right = whnormalize(right, context);

    function assume(left: Identifier | undefined, right: Identifier | undefined): EqContext {
        if (left !== undefined && right !== undefined) {
            // assume that the idents are equal
            return { ...context, [left.value]: { kind: "MAYBEEQ", other: right.value } };
        } else if (left !== undefined) {
            return { ...context, [left.value]: { kind: "KILLED" } };
        } else if (right !== undefined) {
            return { ...context, [right.value]: { kind: "KILLED" } };
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
    } else if (left.kind === "REFL" && right.kind === "REFL") {
        if (checkEq(left.arg, right.arg, context)) {
            return true;
        }
    } else if (left.kind === "UNIVALENCE" && right.kind === "UNIVALENCE") {
        if (checkEq(left.inner, right.inner, context)) {
            return true;
        }
    } else if (left.kind === "PATH" && right.kind === "PATH") {
        if (checkEq(left.left, right.left, context)) {
            if (checkEq(left.type, right.type, context)) {
                if (checkEq(left.right, right.right, context)) {
                    return true;
                }
            }
        }
    } else if (left.kind === "CALL" && right.kind === "CALL") {
        if (checkEq(left.base, right.base, context)) {
            if (checkEq(left.arg, right.arg, context)) {
                return true;
            }
        }
    } else if (left.kind === "IDENTIFIER" && right.kind === "IDENTIFIER") {
        const leftJudgement = context[left.value];
        const rightJudgement = context[right.value];

        
        // if they're in the same context, two of the same identifiers are equal
        if (left.value === right.value) {
            return true;
        }

        // if the identifier should go unused because one of the parents doesn't have bindings
        if ((leftJudgement && leftJudgement.kind === "KILLED") || (rightJudgement && rightJudgement.kind === "KILLED")) {
            return false;
        }

        // if the context assumes that the left is equal to the right or vice versa, then it's a valid equality
        if ((leftJudgement && leftJudgement.kind === "MAYBEEQ" && leftJudgement.other === right.value) || 
            (rightJudgement && rightJudgement.kind === "MAYBEEQ" && rightJudgement.other === left.value)) {
            return true;
        }

        // as a last resort, delta reduce
        if (leftJudgement && leftJudgement.kind === "DEF" && rightJudgement && rightJudgement.kind === "DEF") {
            if (checkEq(leftJudgement.value, rightJudgement.value, context)) {
                return true;
            }
        }
    } else if (left.kind === "IDENTIFIER") {
        const judgement = context[left.value];
        if (judgement && judgement.kind === "DEF") {
            return checkEq(judgement.value, right, context);
        }
    } else if (right.kind === "IDENTIFIER") {
        const judgement = context[right.value];
        if (judgement && judgement.kind === "DEF") {
            return checkEq(left, judgement.value, context);
        }
    }
}

export function check(term: Term, type: Term, context: Context) {
    const inferred = infer(term, context);
    if (checkEq(inferred, type, context)) {
        return true;
    }
    if (inferred.kind === "UN" && type.kind === "UN") {
        return inferred.level <= type.level;
    }
}
