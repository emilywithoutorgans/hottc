import { Identifier, nextToken } from "./lex.js";
import { tryGetType, Type } from "./type.js";

export type Term = Type | { kind: "SINGLETON" } | { kind: "ABSTRACTION", ident: Identifier, body: Term };

export function getTerm(token = nextToken()): Term {
    const type = tryGetType(token);
    if (type !== null) {
        return type;
    }

    if (token.kind === "STAR") {
        return { kind: "SINGLETON" };
    } else if (token.kind === "BACKSLASH") {
        return getAbstraction();
    }
    throw new Error(`cannot parse token ${token.kind} for term`)
}

function getAbstraction(): Term {
    const ident = nextToken();
    if (ident.kind !== "IDENTIFIER") throw new Error(`malformed abstraction: expected IDENTIFIER, found ${ident.kind}`);

    const dot = nextToken();
    if (dot.kind !== "DOT") throw new Error(`malformed abstraction: expected DOT, found ${dot.kind}`);

    const term = getTerm();
    return { kind: "ABSTRACTION", ident, body: term };
}
