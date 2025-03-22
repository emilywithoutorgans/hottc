import { andMove, Identifier, mark, nextToken, rollback, Token, token } from "./lex.js";

export type Term = { kind: "ZERO" | "ONE" } | { kind: "UN", level: number } | Identifier | { kind: "PI", ident?: Identifier, left: Term, right: Term } | { kind: "SINGLETON" } | { kind: "ABSTRACTION", ident: Identifier, type?: Term, body: Term } | { kind: "CALL", base: Term, arg: Term };

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
        case "IDENTIFIER":
            result = { kind: "IDENTIFIER", value: tk.value };
            break;
        case "STAR":
            result = { kind: "SINGLETON" };
            break;
        case "LPAREN": {
            nextToken();
            const term = getTerm();
            if (token().kind !== "RPAREN") {
                throw new Error("expected )");
            }
            result = term;
            break;
        }
        case "BACKSLASH":
            return getAbstraction();
        default:
            throw new Error(`cannot parse token ${tk.kind} for term`);
    }

    nextToken();

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
    }

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

    let type: Term | undefined = undefined;

    if (nextToken().kind === "COLON") {
        nextToken();
        type = getTerm();
    }

    const dot = token();
    if (dot.kind !== "DOT") throw new Error(`malformed abstraction: expected DOT, found ${dot.kind}`);
    nextToken();

    const term = getTerm();
    return { kind: "ABSTRACTION", ident, type, body: term };
}

