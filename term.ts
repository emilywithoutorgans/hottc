import { abstraction, call, identifier, singleton, Term } from "./ast.js";
import { mark, nextToken, rollback } from "./lex.js";
import { SymbolTable } from "./scope.js";
import { tryGetType } from "./type.js";

function tryGetSimpleTerm(scope: SymbolTable, token = nextToken()): Term | null {
    if (token.kind === "STAR") {
        return singleton();
    } else if (token.kind === "LPAREN") {
        const term = getTerm(scope);

        if (nextToken().kind !== "RPAREN") {
            throw new Error("expected right paren");
        }

        return term;
    }

    return null;
}

function tryGetPrimaryTerm(scope: SymbolTable, token = nextToken()): Term | null {
    let term = tryGetSimpleTerm(scope, token);
    if (term === null) {
        return null;
    }

    while (true) {
        const p0 = mark();
        const peek = nextToken();

        if (peek.kind === "LPAREN") {
            term = call(term, getTerm(scope));

            if (nextToken().kind !== "RPAREN") {
                throw new Error("expected right paren");
            }
        } else {
            rollback(p0);
            break;
        }
    }

    return term;
}


export function getTerm(scope: SymbolTable, token = nextToken()): Term {
    const type = tryGetType(scope, token);
    if (type !== null) {
        return type;
    }

    const primaryTerm = tryGetPrimaryTerm(scope, token);
    if (primaryTerm !== null) {
        return primaryTerm;
    }

    if (token.kind === "BACKSLASH") {
        return getAbstraction(scope);
    }

    throw new Error(`cannot parse token ${token.kind} for term`)
}

function getAbstraction(scope: SymbolTable): Term {
    const ident = nextToken();
    if (ident.kind !== "IDENTIFIER") throw new Error(`malformed abstraction: expected IDENTIFIER, found ${ident.kind}`);

    const dot = nextToken();
    if (dot.kind !== "DOT") throw new Error(`malformed abstraction: expected DOT, found ${dot.kind}`);

    scope.push();
    const hashedIdent = identifier(ident.value, scope)
    const body = getTerm(scope);
    scope.pop();
    return abstraction(hashedIdent, body);
}
