import { Identifier, log, mark, nextToken, rollback, Token, token } from "./lex.js";

export type Term =
    | { kind: "SINGLETON" }
    | { kind: "ZERO" | "ONE" }
    | { kind: "UN", level: number }
    | Identifier
    | { kind: "PI", ident?: Identifier, left: Term, right: Term }
    | { kind: "ABSTRACTION", ident: Identifier, type: Term, body: Term }
    | { kind: "CALL", base: Term, arg: Term }
    | { kind: "SIGMA", ident?: Identifier, left: Term, right: Term }
    | { kind: "TUPLE", ident?: Identifier, left: Term, right: Term }
    | { kind: "PR", first: boolean, arg: Term };

export function getTerm(forbidArrow: boolean = false): Term {
    const tk = token();

    let result: Term;
    switch (tk.kind) {
        case "UN":
            result = { kind: "UN", level: tk.value };
            break;
        case "ZERO":
            result = { kind: "ZERO" };
            break;
        case "ONE":
            result = { kind: "ONE" };
            break;
        case "IDENTIFIER": {
            const value = tk.value;
            if (value.startsWith("pr")) {
                if (value.length <= 2) {
                    throw new Error("expected at least one index (1 or 2) after pr");
                }
                
                nextToken();
                let result = getTerm();
                
                for (let i = 2; i < value.length; i++) {
                    const digit = value[i];
                    if (digit !== "1" && digit !== "2") {
                        throw new Error(`expected 1 or 2, found ${digit}`);
                    }
                    result = { kind: "PR", first: digit === "1", arg: result };
                }
                
                return result;
            }
            result = { kind: "IDENTIFIER", value };
            break;
        }
        case "STAR":
            result = { kind: "SINGLETON" };
            break;
        case "LPAREN": {
            nextToken();
            const first = getTerm();
            if (token().kind === "RPAREN") {
                result = first;
            } else {
                result = getTuple(first);
            }
            break;
        }
        case "LBRACKET": {
            nextToken();
            result = getProduct(getTerm());
            break;
        }
        case "BACKSLASH":
            return getAbstraction();
        default:
            throw new Error(`cannot parse token ${tk.kind} for term`);
    }

    nextToken();

    // test for calls
    while (token().kind === "LPAREN") {
        nextToken();
        do {
            result = { kind: "CALL", base: result, arg: getTerm() };
        } while (token().kind === "COMMA" && nextToken())
        if (token().kind !== "RPAREN") {
            throw new Error("expected )");
        }
        nextToken();
    }

    console.log("starting at base", termToString(result), token())

    // test for -> and pi type
    if (!forbidArrow) {
        const peek = token();
        const p0 = mark();

        if (peek !== null) {
            try {
                return getArrowOn(result, peek);
            } catch (e) { }
        }

        rollback(p0); // unnecessary in some cases
        console.log(p0);
        console.log("rolling back to", termToString(result), token());
    }

    return result;
}

function getArrowOn(base: Term, peek: Token): Term {
    if (base.kind === "IDENTIFIER" && peek.kind === "COLON") {
        nextToken();

        const left = getTerm(true);
        if (token().kind === "ARROW") {
            nextToken();
            return {
                kind: "PI",
                ident: base,
                left,
                right: getTerm()
            };
        }
    } else if (peek.kind === "ARROW") {
        nextToken();
        return {
            kind: "PI",
            left: base,
            right: getTerm()
        };
    }

    throw false;
}

function getAbstraction(): Term {
    const ident = nextToken();
    if (ident.kind !== "IDENTIFIER") throw new Error(`malformed abstraction: expected IDENTIFIER, found ${ident.kind}`);

    if (nextToken().kind !== "COLON") throw new Error(`malformed abstraction: expected type after identifier`);
    nextToken();

    const type = getTerm();

    const dot = token();
    if (dot.kind !== "DOT") throw new Error(`malformed abstraction: expected DOT, found ${dot.kind}`);
    nextToken();

    const term = getTerm();
    return { kind: "ABSTRACTION", ident, type, body: term };
}

function getTuple(left: Term): Term {
    let ident: Identifier | undefined = undefined;
    if (token().kind === "COLONEQUAL") {
        nextToken();
        if (left.kind !== "IDENTIFIER") {
            throw new Error("expected identifier before := in tuple binding");
        }
        ident = left;
        left = getTerm();
    }
    if (token().kind === "COMMA") {
        nextToken();
        return { kind: "TUPLE", ident, left, right: getTuple(getTerm()) };
    }
    if (token().kind !== "RPAREN") {
        throw new Error("expected )");
    }
    return left;
}

function getProduct(left: Term): Term {
    let ident: Identifier | undefined = undefined;
    console.log("getProduct", token());
    if (token().kind === "COLON") {
        nextToken();
        if (left.kind !== "IDENTIFIER") {
            throw new Error("expected identifier before : in product type");
        }
        ident = left;
        left = getTerm();
    }
    if (token().kind === "COMMA") {
        nextToken();
        return { kind: "SIGMA", ident, left, right: getProduct(getTerm()) };
    }
    if (token().kind !== "RBRACKET") {
        throw new Error("expected ]");
    }
    return left;
}