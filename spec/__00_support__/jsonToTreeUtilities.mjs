import {
  JSONNode,
  childToParentMap,
  JSONTreeWalker,
  JSONReconstructorVisitor
} from "#support/jsonToTreeUtilities.mjs";

const pkg = {
  "name": "traversal-combinator",
  "version": "0.1.0",
  "description": "Break up complicated tree traversals into unit-testable components.",
  "main": "index.mjs",
  "settings": {
    "isTruthy": true,
    "isFalsy": false,
    "isANumber": 12,
  },
  "scripts": {
    "test": "jasmine",
    "debug": "node --inspect-brk node_modules/jasmine/bin/jasmine.js",
    "eslint": "eslint docs spec *.mjs",
    "playground": "node playground.mjs",
    "tsc": "tsc"
  },
  "nullInTheMiddle": null,
  "keywords": [
    "traversal",
    "combinator",
    "codegenerator"
  ],
  "devDependencies": {
    "eslint": "^8.14.0",
    "express": "^4.17.3",
    "jasmine": "^4.1.0",
    "typescript": "^4.6.3"
  },
  "imports": {
    "#exports/*": "./docs/exports",
    "#support/*": "./spec/support/*"
  },
  "files": [
    "docs/exports/**"
  ]
};

describe("jsonToTreeUtilities", () => {
  let fixture;
  beforeEach(() => {
    fixture = JSON.parse(JSON.stringify(pkg), JSONNode.reviver);
  });

  it("provides a reviver for JSON.parse to create an abstract syntax tree", () => {
    expect(fixture.children.files.parent).toBe(fixture);
    expect(fixture.children.scripts.children.debug.parent).toBe(fixture.children.scripts);

    const eachChildToParent = childToParentMap(fixture);
    expect(eachChildToParent.get(fixture.children.files)).toBe(fixture);
    expect(eachChildToParent.get(fixture.children.scripts.children.debug)).toBe(fixture.children.scripts);
  });

  it("provides a working tree walker and visitor", () => {
    const walker = new JSONTreeWalker(fixture);
    const reconstructor = new JSONReconstructorVisitor();

    walker.visitNodes(reconstructor);

    if (reconstructor.exceptionThrown)
      fail(reconstructor.exception);
    expect(reconstructor.root).toEqual(pkg);
  });

  it("supports filtering in its tree walker class", () => {
    const walker = new JSONTreeWalker(fixture);
    walker.filter = (node) => {
      return node.type !== "array";
    };
    const reconstructor = new JSONReconstructorVisitor();

    walker.visitNodes(reconstructor);

    if (reconstructor.exceptionThrown)
      fail(reconstructor.exception);

    const expected = JSON.parse(JSON.stringify(pkg));
    delete expected.keywords;
    delete expected.files;

    expect(reconstructor.root).toEqual(expected);
  });
});
