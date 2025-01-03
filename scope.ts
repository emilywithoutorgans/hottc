export class Scope<K, V> {
    constructor(private parent?: Scope<K, V>, private map: Map<K, V> = new Map()) { }

    push() {
        this.parent = new Scope(this.parent, this.map);
        this.map = new Map();
    }

    pop() {
        if (this.parent) {
            this.map = this.parent.map;
            this.parent = this.parent.parent;
        } else {
            throw new Error("attempted to pop root scope");
        }
    }

    set(key: K, value: V) {
        this.map.set(key, value);
    }

    lookup(key: K): V | undefined {
        return this.map.get(key) ?? this.parent?.lookup(key);
    }
}

let counter = 0;
export function id() {
    return counter++;
}

export function ensureId(n: number | undefined) {
    return n === undefined ? id() : n;
}