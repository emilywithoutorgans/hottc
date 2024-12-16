import { readFile } from "fs/promises";

export const EOF: Token = { kind: "EOF" };

const text = await readFile("./main.hott", "utf8");

type SimpleTokenName = "EOF" | "ZERO" | "ONE" | "ARROW" | "BACKSLASH" | "STAR" | "COLONEQUAL" | "COLON" | "DOT";
export type Identifier = { kind: "IDENTIFIER", value: string };
export type Token = { kind: SimpleTokenName } | { kind: "UN", value: number } | Identifier;

let cachedToken: Token | null = null;
function popCachedToken() {
    const token = cachedToken;
    cachedToken = null;
    return token;
}

export function nextToken(): Token {
    return popCachedToken() || lexToken();
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
    const token = lexNonIdentTokenFromStart();
    if (token) return token;
    return lexIdent();
}

function lexNonIdentTokenFromStart(): Token | null {
    if (p >= text.length) return EOF; // no more tokens to find

    const char = text[p];

    switch (char) {
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
        case "-":
            if (text[p + 1] === ">") {
                p += 2;
                return { kind: "ARROW" };
            }
            break;
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

    return { kind: 'IDENTIFIER', value: text.slice(start, end) };
}

type State = [number, Token | null];
export function mark(): State {
    return [p, cachedToken];
}

export function rollback(save: State) {
    [p, cachedToken] = save;
}