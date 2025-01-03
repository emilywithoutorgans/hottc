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

export class SymbolTable extends Scope<string, number> {
    private next: number;

    constructor(parent?: SymbolTable, map: Map<string, number> = new Map()) {
        super(parent, map);
        this.next = parent?.next ?? 0;
    }

    add(name: string) {
        const id = this.next;
        this.next += 1;
        this.set(name, id);
        return id;
    }

    lookupOrAdd(name: string) {
        return this.lookup(name) ?? this.add(name);
    }
}