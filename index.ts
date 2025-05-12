import { check, infer } from "./kernel.js";
import { nextToken, mark, rollback, EOF, Identifier, token, log } from "./lex.js";
import { getTerm, Term } from "./term.js";
import { Context } from "./kernel.js";
import { termToString } from "./print.js";

const context: Context = {};

function judgement() {
    // check if the start is null
    const start = token();
    if (start === EOF) {
        return false;
    }

    // get the term
    const term = getTerm();

    if (term.kind === "IDENTIFIER" && term.value === "typeof") {
        const term = getTerm();
        const type = infer(term, context);
        console.log(termToString(type));
    } else {
        // get the operator after the term
        const tk = token();
        if (tk === null) {
            return false;
        } else if (tk.kind === "COLON") {
            nextToken();
            const type = getTerm();
            if (type === null) {
                throw new Error("malformed judgement, invalid type after :");
            }

            // check the judgement
            if (check(term, type, context)) {
                console.log("ok");
            } else {
                throw new Error("fail");
            }
        } else if (tk.kind === "COLONEQUAL") {
            if (term.kind !== "IDENTIFIER") {
                throw new Error("malformed judgement, expected identifier before :=");
            }

            // after :=
            nextToken();

            // get the term
            const value = getTerm();
            const type = infer(value, context);
            
            // add the definition to the context
            context[term.value] = { kind: "DEF", value, type };
        } else {
            throw new Error(`malformed judgement, got ${tk.kind}`);
        }
    }

    // check that it ends with a dot
    const dot = token();
    if (dot === null) {
        return false;
    } else if (dot.kind !== "DOT") {
        throw new Error(`expected DOT, got ${dot.kind}`);
    }

    nextToken();

    return true;
}
try {
    while (judgement());
} catch (e) {
    console.error(e);
    log();
}



