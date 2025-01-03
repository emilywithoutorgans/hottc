import { identifier, one, pi, SimpleType, Type, un, zero } from "./ast.js";
import { mark, nextToken, rollback, Token } from "./lex.js";
import { SymbolTable } from "./scope.js";

function tryGetSimpleType(scope: SymbolTable, token = nextToken()): SimpleType | null {
    switch (token.kind) {
        case "ZERO":
            return zero();
        case "ONE":
            return one();
        case "UN":
            return un(token.value);
        case "IDENTIFIER":
            return identifier(token.value, scope);
    }

    return null;
}

export function tryGetType(scope: SymbolTable, token = nextToken()): Type | null {
    const base = tryGetSimpleType(scope, token);
    if (base === null) {
        return null;
    }

    const p0 = mark();
    const peek = nextToken();

    // if it's a pi type or function for example
    if (peek !== null) {
        try {
            return getPostfixOnType(scope, base, peek);
        } catch (e) {
            if (e !== false) throw e;
        }
    }

    rollback(p0);
    return base;
}

function getPostfixOnType(scope: SymbolTable, base: SimpleType, peek: Token): Type {
    if (base.kind === "IDENTIFIER" && peek.kind === "COLON") {
        scope.push();
        const left = getSimpleType(scope);
        const token = nextToken();
        if (token.kind === "ARROW") {
            const right = getType(scope);
            scope.pop();
            return pi(base, left, right);
        } else {
            scope.pop();
        }
    } else if (peek.kind === "ARROW") {
        return pi(null, base, getType(scope));
    }

    throw false;
}

function getType(scope: SymbolTable) {
    const right = tryGetType(scope);
    if (right === null) throw new Error("expected type on the right of ->");
    return right;
}

function getSimpleType(scope: SymbolTable) {
    const type = tryGetSimpleType(scope);
    if (type === null) throw false;
    return type;
}