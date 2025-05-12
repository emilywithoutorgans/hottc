import { readFile } from "fs/promises";

export const EOF: Token = { kind: "EOF" };

const text = await readFile("./main.hott", "utf8");

type SimpleTokenName = "EOF" | "ZERO" | "ONE" | "ARROW" | "BACKSLASH" | "STAR" | "EQUAL" | "COLONEQUAL" | "COLON" | "DOT" | "LPAREN" | "RPAREN" | "COMMA" | "LBRACKET" | "RBRACKET" | "PIPE";
export type Identifier = { kind: "IDENTIFIER", value: string };
export type Token = { kind: SimpleTokenName } | { kind: "UN", value: number } | Identifier;

let cachedToken: Token | null = null;
function popCachedToken() {
    const token = cachedToken;
    cachedToken = null;
    return token;
}

function lexToken(): Token {
    skipWhitespace();
    return lexTokenFromStart();
}

let p = 0;
function skipWhitespace() {
    const whitespaceMatch = /^\s+/.exec(text.slice(p));
    if (whitespaceMatch === null) return false;
    p += whitespaceMatch[0].length;
    return true;
}

function lexTokenFromStart(): Token {
    switch (text[p]) {
        case "U": {
            const unMatch = /^\d+/.exec(text.slice(p + 1));
            if (unMatch) {
                p += unMatch[0].length + 1;
                return { kind: "UN", value: parseInt(unMatch[0]) };
            }
        }
        case "0":
            p++;
            return { kind: "ZERO" };
        case "1":
            p++;
            return { kind: "ONE" };
    }
    const token = lexNonIdentTokenFromStart();
    if (token) return token;
    return lexIdent();
}

function lexNonIdentTokenFromStart(): Token | null {
    if (p >= text.length) return EOF; // no more tokens to find

    switch (text[p]) {
        case "-":
            if (text[p + 1] === ">") {
                p += 2;
                return { kind: "ARROW" };
            }
            break;
        case "|":
            p++;
            return { kind: "PIPE" };
        case "\\":
            p++;
            return { kind: "BACKSLASH" };
        case "*":
            p++;
            return { kind: "STAR" };
        case ":":
            p++;
            if (text[p] === "=") {
                p++;
                return { kind: "COLONEQUAL" };
            }
            return { kind: "COLON" };
        case ".":
            p++;
            return { kind: "DOT" };
        case "(":
            p++;
            return { kind: "LPAREN" };
        case ")":
            p++;
            return { kind: "RPAREN" };
        case ",":
            p++;
            return { kind: "COMMA" };
        case "[":
            p++;
            return { kind: "LBRACKET" };
        case "]":
            p++;
            return { kind: "RBRACKET" };
        case "=":
            p++;
            return { kind: "EQUAL" };
    }

    return null;
}

function lexIdent(): Token {
    console.assert(cachedToken === null);

    let start = p;
    let end = start;
    while (true) {
        if (skipWhitespace()) break;

        cachedToken = lexNonIdentTokenFromStart();
        if (cachedToken) break;

        p++;
        end = p;
    }

    if (start === end) {
        console.assert(cachedToken);
        return popCachedToken()!;
    }

    return { kind: "IDENTIFIER", value: text.slice(start, end) };
}


let currentToken: Token = lexToken();
export function token(): Token {
    return currentToken;
}

export function nextToken(): Token {
    return (currentToken = popCachedToken() || lexToken());
}

type State = [number, Token, Token | null];
export function mark(): State {
    return [p, currentToken, cachedToken];
}

export function rollback(save: State) {
    [p, currentToken, cachedToken] = save;
}

export function log() {
    console.log("current token", currentToken);
    console.log("remaining text", text.slice(p));
}