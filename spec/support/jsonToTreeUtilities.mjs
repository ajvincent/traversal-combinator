export class JSONNode {
  /**
   * @param {string} key   The property name.
   * @param {any}    valueFromJSON The va;ie from JSON.parse..
   * @returns {JSONNode} The object
   */
  static reviver(key, valueFromJSON) {
    return new JSONNode(key, valueFromJSON);
  }

  /** @type {string} */
  keyName;

  /** @type {string} */
  type;

  /** @type {any} */
  value;

  /** @type {any} */
  children;

  /** @type {JSONNode | undefined} */
  parent;

  /**
   * @param {string} key   The property name.
   * @param {any}    valueFromJSON The va;ie from JSON.parse..
   */
  constructor(key, valueFromJSON) {
    let type = typeof valueFromJSON, value = undefined;

    if (Array.isArray(valueFromJSON)) {
      type = "array";
      valueFromJSON.forEach(c => c.parent = this);
      value = [];
    }
    else if (valueFromJSON === null) {
      type = "null";
      valueFromJSON = undefined;
      value = null;
    }
    else if (type === "object") {
      for (let kid of Object.values(valueFromJSON)) {
        kid.parent = this;
      }

      value = {};
    }
    else {
      value = valueFromJSON;
      valueFromJSON = undefined;
    }
  
    this.keyName = key;
    this.type = type;
    this.value = value;
    this.children = valueFromJSON;
  }
}

/**
 * Get a WeakMap pointing from each tree node to its parent.
 *
 * @param {JSONNode} root The root.
 * @returns {WeakMap<JSONNode, JSONNode>} The map.
 */
export function childToParentMap(root) {
  const map = new WeakMap;
  const visitedSet = new WeakSet, queue = [root];
  while (queue.length) {
    const current = queue.shift();
    visitedSet.add(current);
    let values = [];
    if (current.type === "array") {
      values = current.children.slice();
    }
    else if (current.type === "object") {
      values = Array.from(Object.values(current.children));
    }

    values.forEach(v => map.set(v, current));

    queue.push(...values);
  }

  return map;
}

class JSONTreeWalkerStackItem {
  constructor(node) {
    this.node = node;
    this.notifiedEnter = false;
    this.pendingChildren = node.children ? Array.from(Object.values(node.children)) : [];
    this.notifiedLeave = false;
  }
}

export class JSONTreeWalker {
  #root;

  /**
   * @param {JSONNode} root The root object
   */
  constructor(root) {
    this.#root = root;
  }

  /**
   * @param {JSONNodeBaseVisitor} visitor The visitor
   */
  visitNodes(visitor) {
    let stack = [new JSONTreeWalkerStackItem(this.#root)];
    while (stack.length) {
      const front = stack[0];

      if (!front.notifiedEnter) {
        front.notifiedEnter = true;
        try {
          visitor.enter(front.node);
        }
        catch (ex) {
          // do nothing
        }
      }

      if (front.pendingChildren.length) {
        stack.unshift(new JSONTreeWalkerStackItem(front.pendingChildren.shift()))
        continue;
      }

      if (!front.notifiedLeave) {
        front.notifiedLeave = true;
        try {
          visitor.leave(front.node);
        }
        catch (ex) {
          // do nothing
        }
      }

      stack.shift();
    }
  }
}

export class JSONNodeBaseVisitor {
  enter(node) {
    void(node);
  }
  leave(node) {
    void(node);
  }
}

export class JSONReconstructorVisitor extends JSONNodeBaseVisitor {
  #stack = [];
  #root;

  #exceptionThrown = false;
  #exception;

  #handleException(ex) {
    if (!this.#exceptionThrown) {
      this.#exceptionThrown = true;
      this.#exception = ex;
    }
    throw ex;
  }

  enter(node) {
    try {
      let value = node.value;
      if (node.type === "array")
        value = [];
      else if (node.type === "object")
        value = {};
      else if (node.type === "null")
        value = null;

      if (!this.#root) {
        this.#root = value;
      }
      this.#stack.unshift(value);
    }
    catch (ex) {
      this.#handleException(ex);
      throw ex;
    }
  }

  leave(node) {
    try {
      const value = this.#stack.shift();
      if (!this.#stack.length)
        return;

      const front = this.#stack[0];
      if (Object(front) === front)
        front[node.keyName] = value;
    }
    catch (ex) {
      this.#handleException(ex);
      throw ex;
    }
  }

  get root() {
    return this.#root;
  }

  get exceptionThrown() {
    return this.#exceptionThrown;
  }

  get exception() {
    return this.#exception;
  }
}
