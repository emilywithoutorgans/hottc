import { identifier, one, pi, SimpleType, Type, un, zero } from "./ast.js";
import { mark, nextToken, rollback, Token } from "./lex.js";

function tryGetSimpleType(token = nextToken()): SimpleType | null {
    switch (token.kind) {
        case "ZERO":
            return zero();
        case "ONE":
            return one();
        case "UN":
            return un(token.value);
        case "IDENTIFIER":
            return identifier(token.value);
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
            return pi(base, left, getType());
        }
    } else if (peek.kind === "ARROW") {
        return pi(null, base, getType());
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