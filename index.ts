import { log } from "./lex.js";
import { judgement } from "./judgement.js";

try {
    while (judgement());
} catch (e) {
    console.error(e);
    log();
}



