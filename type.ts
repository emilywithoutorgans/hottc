import { mark, nextToken, rollback, Token, Identifier } from "./lex.js";

type SimpleType = { kind: "ZERO" | "ONE" } | { kind: "UN", level: number } | Identifier
export type Type = SimpleType | { kind: "PI", ident: Identifier, left: SimpleType, right: Type } | { kind: "FUNCTION", left: SimpleType, right: Type };

function tryGetSimpleType(token = nextToken()): SimpleType | null {
    switch (token.kind) {
        case "UN":
            return { kind: "UN", level: token.value };
        case "ZERO":
            return { kind: "ZERO" };
        case "ONE":
            return { kind: "ONE" };
        case "IDENTIFIER":
            return { kind: "IDENTIFIER", value: token.value };
    }

    return null;
}

export function tryGetType(token = nextToken()): Type | null {
    const base = tryGetSimpleType(token);
    if (base === null) {
        return null;
    }

    const p0 = mark();
    const peek = nextToken();

    // if it's a pi type or function for example
    if (peek !== null) {
        try {
            return getPostfixOnType(base, peek);
        } catch (e) {
            if (e !== false) throw e;
        }
    }

    rollback(p0);
    return base;
}

function getPostfixOnType(base: SimpleType, peek: Token): Type {
    if (base.kind === "IDENTIFIER" && peek.kind === "COLON") {
        const left = getSimpleType();
        const token = nextToken();
        if (token.kind === "ARROW") {
            return {
                kind: "PI",
                ident: base,
                left,
                right: getType()
            };
        }
    } else if (peek.kind === "ARROW") {
        return {
            kind: "FUNCTION",
            left: base,
            right: getType()
        };
    }

    throw false;
}

function getType() {
    const right = tryGetType();
    if (right === null) throw new Error("expected type on the right of ->");
    return right;
}

function getSimpleType() {
    const type = tryGetSimpleType();
    if (type === null) throw false;
    return type;
}