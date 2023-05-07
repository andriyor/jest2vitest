import { Project, SourceFile, Node, ImportDeclaration, CallExpression, PropertyAccessExpression } from "ts-morph";
import { intersect } from "set-fns";

const argv = require("yargs-parser")(process.argv.slice(2));

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const jestGlobalApis = ["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "test", "it", "expect"];

const testApiProps = ["concurrent", "each", "only", "skip", "todo", "failing"];

const jestGlobalApiProps: Record<string, string[]> = {
  describe: ["each", "only", "skip"],
  it: testApiProps,
  test: testApiProps,
};

const jestGlobalApiPropsKeys = Object.keys(jestGlobalApiProps);

const apiNamesRecord: Record<string, string> = {
  createMockFromModule: "importMock",
  deepUnmock: "unmock",
  genMockFromModule: "importMock",
  requireActual: "importActual",
  requireMock: "importMock",
  setMock: "mock",
};

const apiNamesToMakeAsync = ["genMockFromModule", "createMockFromModule", "requireActual", "requireMock"];

const handleApiNamesRecord = (node: CallExpression, expression: PropertyAccessExpression) => {
  const propExpressionName = expression.getName();
  if (apiNamesRecord[propExpressionName]) {
    expression.getNameNode().replaceWithText(apiNamesRecord[propExpressionName]);

    if (apiNamesToMakeAsync.includes(propExpressionName)) {
      let parent = node.getParent();
      while (!Node.isArrowFunction(parent)) {
        parent = parent?.getParent();
      }
      if (Node.isArrowFunction(parent)) {
        parent.setIsAsync(true);
      }

      const nodeParent = node.getParent();
      if (Node.isVariableDeclaration(nodeParent)) {
        nodeParent.setInitializer(`await ${node.getText()}`);
      }
    }
  }
};

const handleFailing = (node: CallExpression) => {
  const expression = node.getExpression();

  if (Node.isPropertyAccessExpression(expression)) {
    const propExpression = expression.getExpression();
    if (Node.isPropertyAccessExpression(propExpression)) {
      const propExpressionNested = propExpression.getExpression();
      if (Node.isIdentifier(propExpressionNested)) {
        const propExpressionText = propExpressionNested.getText();
        const expressionName = expression.getName();
        const propExpressionName = propExpression.getName();

        if (propExpressionText === "it" || propExpressionText === "test") {
          if (expressionName === "failing") {
            expression.getNameNode().replaceWithText("fails");
          }
          if (propExpressionName === "failing") {
            propExpression.getNameNode().replaceWithText("fails");
          }
        }
      }
    }

    if (Node.isIdentifier(propExpression)) {
      const propExpressionText = propExpression.getText();
      const propExpressionName = expression.getName();

      if (["fit", "it", "test"].includes(propExpressionText)) {
        if (propExpressionName === "failing") {
          expression.getNameNode().replaceWithText("fails");
        }
      }
    }
  }
};

const getNamedImports = (sourceFile: SourceFile) => {
  const namedImport: string[] = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        namedImport.push(expressionText);
      }
    }
  });
  return intersect(namedImport, jestGlobalApis);
};

const getImports = (sourceFile: SourceFile) => {
  const api: string[] = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression)) {
        const propExpression = expression.getExpression();
        if (Node.isPropertyAccessExpression(propExpression)) {
          const propExpressionNested = propExpression.getExpression();
          if (Node.isIdentifier(propExpressionNested)) {
            const propExpressionText = propExpressionNested.getText();
            const expressionName = expression.getName();

            if (
              jestGlobalApiPropsKeys.includes(propExpressionText) &&
              jestGlobalApiProps[propExpressionText].includes(expressionName)
            ) {
              api.push(propExpressionText);
            }

            if (propExpressionText === "jest") {
              api.push("vi");
            }
          }
        }

        if (Node.isIdentifier(propExpression)) {
          const propExpressionText = propExpression.getText();
          const propExpressionName = expression.getName();

          if (
            jestGlobalApiPropsKeys.includes(propExpressionText) &&
            jestGlobalApiProps[propExpressionText].includes(propExpressionName)
          ) {
            api.push(propExpressionText);
          }

          if (propExpressionText === "fit") {
            api.push("it");
          }

          if (propExpressionText === "jest") {
            api.push("vi");
          }
        }
      }

      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        if (expressionText === "fit") {
          api.push("it");
        }
      }
    }
  });
  return api;
};

const insertViteImport = (sourceFile: SourceFile) => {
  let firstImportNode = 0;

  const imports = getNamedImports(sourceFile);
  const api = getImports(sourceFile);

  sourceFile.forEachDescendant((node) => {
    if (Node.isImportDeclaration(node)) {
      if (!firstImportNode) {
        firstImportNode = node.getChildIndex();
      }

      const moduleSpecifierText = node.getModuleSpecifier().getText();
      if (moduleSpecifierText == '"@jest/globals"') {
        node.remove();
        return;
      }
    }

    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      handleFailing(node);

      if (Node.isPropertyAccessExpression(expression)) {
        const propExpression = expression.getExpression();
        if (Node.isPropertyAccessExpression(propExpression)) {
          const propExpressionNested = propExpression.getExpression();
          if (Node.isIdentifier(propExpressionNested)) {
            const propExpressionText = propExpressionNested.getText();

            if (propExpressionText === "jest") {
              propExpressionNested.replaceWithText("vi");
            }
          }
        }

        if (Node.isIdentifier(propExpression)) {
          const propExpressionText = propExpression.getText();
          const propExpressionName = expression.getName();

          if (propExpressionText === "fit") {
            propExpression.replaceWithText("it.only");
          }

          if (propExpressionText === "jest") {
            if (propExpressionName === "disableAutomock") {
              const parent = node.getParent();
              if (Node.isExpressionStatement(parent)) {
                parent.remove();
                return;
              }
            }

            propExpression.replaceWithText("vi");

            handleApiNamesRecord(node, expression);
          }
        }
        return;
      }

      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        if (expressionText === "fit") {
          expression.replaceWithText("it.only");
        }
      }
    }
  });

  const importDeclarationString = `import { ${[...new Set([...imports, ...api])].sort().join(", ")} } from "vitest";`;

  // just for compatability of tests
  if (firstImportNode) {
    sourceFile.insertStatements(firstImportNode, `${importDeclarationString}\n`);
  } else {
    sourceFile.insertStatements(firstImportNode, importDeclarationString);
  }
};

export const migrate = (path: string) => {
  const sourceFiles = project.getSourceFiles(path);

  console.log(sourceFiles.length);

  for (const sourceFile of sourceFiles) {
    console.log(sourceFile.getFilePath());
    insertViteImport(sourceFile);
  }

  return project.save();
};

// migrate("test/__fixtures__/**/*.input.{tsx,ts,js,mjs}");

// migrate("test/__fixtures__/misc/with-existing-imports.input.mjs");
