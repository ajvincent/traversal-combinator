import {
  JSONNode,
  childToParentMap,
  JSONTreeWalker,
  JSONReconstructorVisitor
} from "#support/jsonToTreeUtilities.mjs";


it("jsonToTreeUtilities works", () => {
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

  const fixture = JSON.parse(JSON.stringify(pkg), JSONNode.reviver);

  expect(fixture.children.files.parent).toBe(fixture);
  expect(fixture.children.scripts.children.debug.parent).toBe(fixture.children.scripts);

  const eachChildToParent = childToParentMap(fixture);
  expect(eachChildToParent.get(fixture.children.files)).toBe(fixture);
  expect(eachChildToParent.get(fixture.children.scripts.children.debug)).toBe(fixture.children.scripts);

  const reconstructor = new JSONReconstructorVisitor();
  const walker = new JSONTreeWalker(fixture);

  walker.visitNodes(reconstructor);

  if (reconstructor.exceptionThrown)
    fail(reconstructor.exception);
  expect(reconstructor.root).toEqual(pkg);
});
