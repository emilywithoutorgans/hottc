import { andMove, Identifier, nextToken, token } from "./lex.js";
import { tryGetType, Type } from "./type.js";

export type Term = Type | { kind: "SINGLETON" } | { kind: "ABSTRACTION", ident: Identifier, body: Term } | { kind: "CALL", base: Term, arg: Term };

function getPrefixTerm(): Term {
    const type = tryGetType();
    if (type !== null) {
        return type;
    }

    const tk = token();
    if (tk.kind === "STAR") {
        return andMove({ kind: "SINGLETON" });
    } else if (tk.kind === "BACKSLASH") {
        return getAbstraction();
    }
    throw new Error(`cannot parse token ${tk.kind} for term`);
}

function getAbstraction(): Term {
    const ident = nextToken();
    if (ident.kind !== "IDENTIFIER") throw new Error(`malformed abstraction: expected IDENTIFIER, found ${ident.kind}`);

    const dot = nextToken();
    if (dot.kind !== "DOT") throw new Error(`malformed abstraction: expected DOT, found ${dot.kind}`);
    nextToken();

    const term = getTerm();
    return andMove({ kind: "ABSTRACTION", ident, body: term });
}

export function getTerm(): Term {
    let lhs = getPrefixTerm();
    if (!checkCall(lhs)) {
        return lhs;
    }
    while (token().kind === "LPAREN") {
        nextToken();
        do {
            lhs = { kind: "CALL", base: lhs, arg: getTerm() };
        } while (token().kind === "COMMA" && nextToken())
        if (token().kind !== "RPAREN") {
            throw new Error("expected )");
        }
        nextToken();
    }
    return lhs;
}

function checkCall(base: Term): boolean {
    switch (base.kind) {
        case "ZERO":
        case "ONE":
        case "UN":
        case "IDENTIFIER":
        case "SINGLETON":
        case "CALL":
            return true;
        case "ABSTRACTION":
        case "PI":
            return false;
    }
}

