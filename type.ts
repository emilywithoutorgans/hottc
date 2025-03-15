import { mark, nextToken, rollback, Token, Identifier, token, andMove } from "./lex.js";

type SimpleType = { kind: "ZERO" | "ONE" } | { kind: "UN", level: number } | Identifier
export type Type = SimpleType | { kind: "PI", ident?: Identifier, left: SimpleType, right: Type };

function tryGetSimpleType(): SimpleType | null {
    const tk = token();
    switch (tk.kind) {
        case "UN":
            return andMove({ kind: "UN", level: tk.value });
        case "ZERO":
            return andMove({ kind: "ZERO" });
        case "ONE":
            return andMove({ kind: "ONE" });
        case "IDENTIFIER":
            return andMove({ kind: "IDENTIFIER", value: tk.value });
    }

    return null;
}

export function tryGetType(): Type | null {
    const base = tryGetSimpleType();
    if (base === null) {
        return null;
    }

    const peek = token();
    const p0 = mark();

    // if it's a pi type or function for example
    if (peek !== null) {
        try {
            return getPostfixOnType(base, peek);
        } catch (e) {
            if (e !== false) throw e;
        }
    }

    rollback(p0); // unnecessary in some cases
    return base;
}

function getPostfixOnType(base: SimpleType, peek: Token): Type {
    if (base.kind === "IDENTIFIER" && peek.kind === "COLON") {
        nextToken();

        const left = getSimpleType();
        if (token().kind === "ARROW") {
            nextToken();
            return {
                kind: "PI",
                ident: base,
                left,
                right: getType()
            };
        }
    } else if (peek.kind === "ARROW") {
        nextToken();
        return {
            kind: "PI",
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