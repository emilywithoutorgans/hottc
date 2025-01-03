import { Term, Type, un } from "./ast.js";
import { nextToken, mark, rollback, EOF } from "./lex.js";
import { Scope, SymbolTable } from "./scope.js";
import { getTerm } from "./term.js";
import { tryGetType } from "./type.js";

type Judgement = { kind: "TYPE", value: Type };
type Context = Record<string, Judgement>;

// check that a term has a type
function check(term: Term, type: Type, context: Context): true | void {
    if (term.kind === "IDENTIFIER") {
        const assumption = context[term.value];
        if (assumption !== undefined) {
            if (assumption.kind === "TYPE") {
                // we have x: A, we want to check if x: B
                // check if A and B are equal
                if (checkEq(assumption.value, type, {})) {
                    return true;
                }
            } else if (assumption.kind === "EQUALITY") {
                // unwrap the definition
            }
        }
    }

    if (type.kind === "ONE") {
        if (term.kind === "SINGLETON") {
            // one introduction
            // *: 1
            console.log("used one introduction");
            return true;
        }
    }

    if (term.kind === "ABSTRACTION") {
        // bug: variable leaks into type scope in function
        // \x. x: U1 -> x
        if (type.kind === "PI") {
            // pi introduction
            // (x: A => b: B) => \x. b: x: A -> B
            console.log("used pi introduction");

            let newContext = context;
            if (term.ident !== null) {
                newContext = { ...context, [term.ident.value]: { kind: "TYPE", value: type.left } };
            }

            return check(term.body, type.right, newContext);
        }
    }

    if (term.kind === "UN" && type.kind === "UN") {
        // universe introduction
        // U_i: U_(i+1)
        if (term.level + 1 === type.level) {
            console.log("used universe introduction");
            return true;
        }
    }

    if (type.kind === "UN") {
        if (term.kind === "ZERO") {
            // zero former
            // 0: U_i
            console.log("used zero former");
            return true;
        } else if (term.kind === "ONE") {
            // one former
            // 1: U_i
            console.log("used one former");
            return true;
        } else if (term.kind === "PI") {
            // pi former
            // (A: U_i, x: A => B: U_i) => (x: A -> B): U_i
            console.log("used pi former");

            // check that A's type universe is equal to the pi type universe
            if (check(term.left, type, context)) {
                // add x: A to the context, if it exists
                let newContext: Context = context;
                if (term.ident !== null) {
                    newContext = { ...context, [term.ident.value]: { kind: "TYPE", value: term.left } };
                }

                // check that B's type universe is equal to the pi type universe
                if (check(term.right, type, newContext)) {
                    return true;
                }
            }
        }


        if (type.level === 0) {
            // small types
        } else {
            // big types
            // universe cumulativity
            // A: U_i => A: U_(i+1)
            if (check(term, un(type.level - 1), context)) {
                console.log("used universe cumulativity");
                return true;
            }
        }
    }
}

function checkEq(left: Term, right: Term, context: Record<string, string>) {
    if (left.kind === "ZERO" && right.kind === "ZERO") {
        return true;
    } else if (left.kind === "ONE" && right.kind === "ONE") {
        return true;
    } else if (left.kind === "SINGLETON" && right.kind === "SINGLETON") {
        return true;
    } else if (left.kind === "UN" && right.kind === "UN") {
        if (left.level === right.level) {
            // primitive constant
            return true;
        }
    } else if (left.kind === "CALL" && right.kind === "CALL") {
        if (checkEq(left.base, right.base, context) && checkEq(left.arg, right.arg, context)) {
            return true;
        }
    } else if (left.kind === "PI" && right.kind === "PI") {
        // check the ident types
        if (checkEq(left.left, right.left, context)) {
            // assume that the idents are equal, if they exist
            let newContext = context;
            if (left.ident !== null && right.ident !== null) {
                newContext = { ...context, [left.ident.value]: right.ident.value };
            }

            if (checkEq(left.right, right.right, newContext)) {
                return true;
            }
        }
    } else if (left.kind === "IDENTIFIER" && right.kind === "IDENTIFIER") {
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

function judgement() {
    // check if the start is null
    const start = nextToken();
    if (start === EOF) {
        return false;
    }

    // get the term
    const termScope: SymbolTable = new SymbolTable();
    const term = getTerm(termScope, start);

    // get the operator after the term
    const token = nextToken();
    if (token === null) {
        return false;
    } else if (token.kind === "COLON") {
        const typeScope: SymbolTable = new SymbolTable();
        const type = tryGetType(typeScope);
        if (type === null) {
            throw new Error("malformed judgement, invalid type after :");
        }

        // check the judgement
        if (check(term, type, {})) {
            console.log("ok");
            console.log(term, type);
        } else {
            console.log(term, type);
            throw new Error("fail");
        }
    } else {
        throw new Error(`malformed judgement, got ${token.kind}`);
    }

    // check that it ends with a dot
    const dot = nextToken();
    if (dot === null) {
        return false;
    } else if (dot.kind !== "DOT") {
        throw new Error(`expected DOT, got ${dot.kind}`);
    }

    return true;
}

while (judgement());



