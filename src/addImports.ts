import { Node, LeftHandSideExpression, PropertyAccessExpression, SourceFile, ts } from "ts-morph";

const jestGlobalApis = ["afterAll", "afterEach", "beforeAll", "beforeEach", "describe", "test", "it", "expect", "vi"];

const testApiProps = ["concurrent", "each", "only", "skip", "todo", "failing"];

const jestGlobalApiProps: Record<string, string[]> = {
  describe: ["each", "only", "skip"],
  it: testApiProps,
  test: testApiProps,
};

const jestGlobalApiPropsKeys = Object.keys(jestGlobalApiProps);

const jestToVitestApiMap: Record<string, string> = {
  fit: "it",
  jest: "vi",
};

const handleIdentifier = (
  expression: LeftHandSideExpression<ts.LeftHandSideExpression>,
  propertyExpression: PropertyAccessExpression
) => {
  if (Node.isIdentifier(expression)) {
    const propExpressionText = expression.getText();
    const expressionName = propertyExpression.getName();

    if (
      jestGlobalApiPropsKeys.includes(propExpressionText) &&
      jestGlobalApiProps[propExpressionText].includes(expressionName)
    ) {
      return propExpressionText;
    }

    if (jestToVitestApiMap[propExpressionText]) {
      return jestToVitestApiMap[propExpressionText];
    }
  }
};

export const getImports = (sourceFile: SourceFile) => {
  const api: string[] = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression)) {
        const propExpression = expression.getExpression();
        if (Node.isPropertyAccessExpression(propExpression)) {
          const propExpressionNested = propExpression.getExpression();
          const res = handleIdentifier(propExpressionNested, expression);
          if (res) {
            api.push(res);
          }
        }

        const res = handleIdentifier(propExpression, expression);
        if (res) {
          api.push(res);
        }
      }

      if (Node.isIdentifier(expression)) {
        const expressionText = expression.getText();
        if (jestGlobalApis.includes(expressionText)) {
          api.push(expressionText);
        }
        if (jestToVitestApiMap[expressionText]) {
          api.push(jestToVitestApiMap[expressionText]);
        }
      }
    }
  });
  return api;
};

const getFirstImportIndex = (sourceFile: SourceFile) => {
  sourceFile.forEachDescendant((node) => {
    if (Node.isImportDeclaration(node)) {
      return node.getChildIndex();
    }
  });
  return 0;
};

export const addImports = (sourceFile: SourceFile) => {
  const api = getImports(sourceFile);
  const importDeclarationString = `import { ${[...new Set([...api])].sort().join(", ")} } from "vitest";`;

  const firstImportIndex = getFirstImportIndex(sourceFile);
  // just for compatability of tests
  if (firstImportIndex) {
    sourceFile.insertStatements(firstImportIndex, `${importDeclarationString}\n`);
  } else {
    sourceFile.insertStatements(firstImportIndex, importDeclarationString);
  }
};
