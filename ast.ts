import SparkMD5 from "spark-md5";
import { Scope, SymbolTable } from "./scope.js";

type HashedASTNode = { hash: string };
type Identifier = { kind: "IDENTIFIER", value: string } & HashedASTNode;

type Zero = { kind: "ZERO" };
type One = { kind: "ONE" };
type Un = { kind: "UN", level: number };
type Pi = { kind: "PI", ident: Identifier | null, left: SimpleType, right: Type };

type Singleton = { kind: "SINGLETON" };
type Abstraction = { kind: "ABSTRACTION", ident: Identifier, body: Term };
type Call = { kind: "CALL", base: Term, arg: Term };

export type SimpleType = (Zero | One | Un | Identifier) & HashedASTNode;
export type Type = (SimpleType | Pi) & HashedASTNode;
export type Term = (Type | Singleton | Abstraction | Call) & HashedASTNode;

export function zero(): Zero & HashedASTNode {
    return { kind: "ZERO", hash: SparkMD5.hash("ZERO") };
}

export function one(): One & HashedASTNode {
    return { kind: "ONE", hash: SparkMD5.hash("ONE") };
}

export function un(level: number): Un & HashedASTNode {
    const hash = new SparkMD5();
    hash.append("UN");
    hash.append(level.toString());
    return { kind: "UN", level, hash: hash.end() };
}

export function identifier(value: string, scope: SymbolTable): Identifier {
    const hash = new SparkMD5();
    hash.append("IDENTIFIER");
    hash.append(scope.lookupOrAdd(value).toString());
    return { kind: "IDENTIFIER", value, hash: hash.end() };
}

export function pi(ident: Identifier | null, left: SimpleType, right: Type): Pi & HashedASTNode {
    const hash = new SparkMD5();
    hash.append("PI");
    if (ident !== null) hash.append(ident.hash);
    hash.append(left.hash);
    hash.append(right.hash);
    return { kind: "PI", ident, left, right, hash: hash.end() };
}

export function singleton(): Singleton & HashedASTNode {
    return { kind: "SINGLETON", hash: SparkMD5.hash("SINGLETON") };
}

export function abstraction(ident: Identifier, body: Term): Abstraction & HashedASTNode {
    const hash = new SparkMD5();
    hash.append("ABSTRACTION");
    hash.append(ident.hash);
    hash.append(body.hash);
    return { kind: "ABSTRACTION", ident, body, hash: hash.end() };
}

export function call(base: Term, arg: Term): Call & HashedASTNode {
    const hash = new SparkMD5();
    hash.append("CALL");
    hash.append(base.hash);
    hash.append(arg.hash);
    return { kind: "CALL", base, arg, hash: hash.end() };
}