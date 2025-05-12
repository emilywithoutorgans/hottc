import { Term } from "./term.js";

export function termToString(term: Term): string {
    switch (term.kind) {
        case "SINGLETON":
            return "*";
        case "ZERO":
            return "0";
        case "ONE":
            return "1";
        case "UN":
            return `U${term.level}`;
        case "IDENTIFIER":
            return term.value;
        case "PI":
            if (term.ident) {
                return `(${term.ident.value}: ${termToString(term.left)} -> ${termToString(term.right)})`;
            }
            return `(${termToString(term.left)} -> ${termToString(term.right)})`;
        case "ABSTRACTION":
            return `(\\${term.ident.value}: ${termToString(term.type)}. ${termToString(term.body)})`;
        case "CALL":
            return `${termToString(term.base)}(${termToString(term.arg)})`;
        case "SIGMA":
            if (term.ident) {
                return `[${term.ident.value}: ${termToString(term.left)}, ${termToString(term.right)}]`;
            }
            return `[${termToString(term.left)}, ${termToString(term.right)}]`;
        case "TUPLE":
            if (term.ident) {
                return `(${term.ident.value} := ${termToString(term.left)}, ${termToString(term.right)})`;
            }
            return `(${termToString(term.left)}, ${termToString(term.right)})`;
        case "PR": {
            return `pr${term.first ? "1" : "2"}(${termToString(term.arg)})`;
        }
        case "REFL": {
            return `refl(${termToString(term.arg)})`;
        }
        case "PATH": {
            return `${termToString(term.left)} =[${termToString(term.type)}] ${termToString(term.right)}`;
        }
        case "UNIVALENCE": {
            return `|${termToString(term.inner)}|`;
        }
    }
}
