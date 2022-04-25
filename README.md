# traversal-combinator

Break up complicated tree traversals into unit-testable components!

## Tree traversals are easy to implement... unless you're receiving the events

[Tree traversals](https://en.wikipedia.org/wiki/Tree_traversal) are everywhere in the Web:

- [JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse) has a `reviver` callback argument for transforming one value to another.  So does [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) for its `serializer` callback argument.
- The Document Object Model has [TreeWalker](https://developer.mozilla.org/en-US/docs/Web/API/TreeWalker) and [NodeIterator](https://developer.mozilla.org/en-US/docs/Web/API/NodeIterator).  The `document.createTreeWalker()` and `document.createNodeIterator()` methods allow you to create these with some native filtering, but if you want something more fine-grained than "Is this an Element or not?", you'll have to write your own filter.
- Static analysis tools like [ESLint](https://eslint.org/) depend on scanning an [abstract syntax tree](https://en.wikipedia.org/wiki/Abstract_syntax_tree) for patterns.  [AST's are pretty complex themselves](https://astexplorer.net/), but once you have it, how do you write rules that read the tree for one pattern, then read the tree for another that depends on the first?
- If you're writing a parser for a single language, that's a [well-understood problem](https://en.wikipedia.org/wiki/LALR_parser).  The real world often has multiple programming and scripting languages nested in one another:  regular expressions written in JavaScript, which you can embed into a HTML document, for example.

Implementing traversal is easy.  Parsing the events is harder.  Eventually you could get something [so complex as to make unit-testing or refactoring very hard](https://github.com/ajvincent/es-membrane/blob/master/source/ObjectGraphHandler.js)...

Wouldn't it be nicer if you could:

1. See all the potential visitor traps you might hit in your code, and cherry-pick the ones you want
1. Break up your traversal visitor's methods into smaller, testable components
1. Define in a simple JSON format how you transition from one visitor component to another, and pass data between them in a shared API
1. Use a tool to scan your JSON and testable modules, and _generate a composite traversal module_ from the sources?

That's what this project is about:  providing a common static HTML website to visualize the various types of AST nodes, then offering a [metaprogramming](https://en.wikipedia.org/wiki/Metaprogramming) API to guide rewriting into a composite that works as if you hand-edited it into one piece.

If that doesn't sell you, here's a simple use case this tool should support early on:  "Why isn't my traversal hitting the node I want to hit?"  That's a first, low-hanging fruit type of goal for this project.  I want to show you how you get from the root node to the target node, or what's stopping you from getting there.  With a few simple callback functions, this should be easy to implement.

## Use cases

### The simple model:  a filter and a visitor

This is usually where we start:  you create a traversal, and provide it an initial filter.  Then you call a method of the traversal repeatedly and handle what it gives you.  In this example, whenever we want to inspect an element, we want to explicitly not look at its descendants:

```javascript
const visitor = {
  acceptedNodes = new WeakSet;

  // NodeIterator
  accept(node) {
    if (this.acceptedNodes.has(node.parentNode))
      return NodeFilter.REJECT;
    if (node.classList.contains("foo"))
      return NodeFilter.ACCEPT;
    return NodeFilter.SKIP;
  }

  handleNextNode(node) {
    this.acceptedNodes.add(node);
    // go do something with it
  }
}

const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, node => visitor.accept(node));
while (walker.nextNode()) {
  visitor.handleNextNode(walker.currentNode);
}
```

If it's something more complex, though:

```javascript
class Visitor {
  // NodeIterator
  accept(node) {
    if (!(node.validity instanceof ValidityState))
      return NodeFilter.FILTER_SKIP;
    return NodeFilter.FILTER_ACCEPT;
  }

  handleNextNode(node) {
    if (node instanceof HTMLInputElement)
      this.#handleInputElement(node);
    else if (node instanceof HTMLSelectElement)
      this.#handleSelectElement(node);
    else {
      throw new Error("Unknown type of element: " + node.localName);
    }
  }

  #handleInputElement(node) {
    if (node.type === "hidden") {
      this.#handleHiddenInput(node);
    }
    else if (node.type === "text") {
      this.#handleTextInput(node);
    }
    // ...
    else {
      throw new Error("Unknown type of input element: " + node.type);
    }
  }

  // ...
}

const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, node => visitor.accept(node));
while (walker.nextNode()) {
  visitor.handleNextNode(walker.currentNode);
}
```

At this point, you'll probably be thinking it'd be nice to hand it off to a separate class, like a linked list.  This will especially be true with [a  complex set of choices](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/estree/index.d.ts).

In reality, though, you probably will end up with a decision tree.

### The decision tree model

Rewriting the previous example:

```javascript
class Visitor {
  handleNextNode(node) {
    throw new Error("Not yet implemented!");
  }
}

class HTMLElementVisitor extends Visitor {
  /** @type {Map<string, Function>} */
  static #nameToNextVisitor = new Map;

  /** @type {Map<string, Visitor>} */
  #nameToNextVisitor = new Map;

  // NodeIterator
  accept(node) {
    if (!(node.validity instanceof ValidityState))
      return NodeFilter.FILTER_SKIP;
    return NodeFilter.FILTER_ACCEPT;
  }

  handleNextNode(node) {
    const name = node.localName.toLowerCase();
    if (!this.#nameToNextVisitor.has(name)) {
      this.#nameToNextVisitor.set(name, new HTMLElementVisitor.#nameToNextVisitor.get(name));
    }

    const nextVisitor = this.#nameToNextVisitor.get(name);
    if (nextVisitor)
      return nextVisitor.handleNextNode(node);
    else {
      throw new Error("Unknown element name: " + node.localName);
    }
  }
}

class HTMLInputElementVisitor extends Visitor {
  /** @type {Map<string, Function>} */
  static #typeToNextVisitor = new Map;

  /** @type {Map<string, Visitor>} */
  #typeToNextVisitor = new Map;
  handleNextNode(node) {
    const type = node.type;
    if (!this.#typeToNextVisitor.has(type)) {
      this.#typeToNextVisitor.set(type, new InputElementVisitor.#typeToNextVisitor.get(type));
    }

    const nextVisitor = this.#typeToNextVisitor.get(type);
    if (nextVisitor)
      return nextVisitor.handleNextNode(node);
    else {
      throw new Error("Unknown input element type: " + type);
    }
  }
}
HTMLElementVisitor.nameToNextVisitor.set("input", HTMLInputElementVisitor);

// ...

const visitor = new Visitor;

const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, node => visitor.accept(node));
while (walker.nextNode()) {
  visitor.handleNextNode(walker.currentNode);
}
```

This is unit-testable (private class fields notwithstanding), but requires several stack calls.  I believe this is really an intermediate step, where code-rewriting tools can take these classes and combine them into one, after everything works.  Plus figuring out the graph from one step to the next can be challenging.

### Multiple visitor entry points provide another dimension of complexity

The above use cases consider _only one_ entry point (or trap) for the traversal.  [What if you have multiple traps, as in Proxy's ProxyHandler case?](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy#handler_functions)?

```javascript
class MyProxyHandler {
  get(target, propertyName, receiver) {
    // lots of code
  }

  apply(target, thisArg, argumentList) {
    // lots of code
  }
}
```

So now you have three dimensions of complexity to deal with:

1. The decisions within a particular trap
2. The forwarding to other handlers in traversal (and keeping track of them)
3. The multiple traps you have to support

## The solutions

This project will offer several tools via a HTML interface:

- _A page to generate AST stub visitors for a traverser._  This will take samples of existing code (yours and a test battery this project hosts) to generate AST's, from which you can pick the particular types of AST nodes you want to listen for.  The types you select will result in a stub visitor you can download, along with supporting JavaScript modules.
- _A page to visualize and combine visitors together._  This project will provide a metaprogramming API for control flow indicators (return and throw statements, moving defined arguments, etc.) and some SVG-based tools to illustrate how you go from an entry visitor to a descendant visitor.
- _A page to trace the tree traversals._ This will answer questions like:
  - "How did I get from my root node to my target node?" (tracing the tree structure)
  - "Why can't I reach my target node from my root node?" (debugging the tree structure)

For your own projects, I'll provide a simple localhost HTTP server you can configure to pick up your source code.  The HTML pages will then be a GUI to the back-end code, which will have more power (saving changes to your filesystem).
