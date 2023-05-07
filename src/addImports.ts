import {
  Node,
  LeftHandSideExpression,
  PropertyAccessExpression,
  SourceFile,
  ts,
  SyntaxKind,
} from 'ts-morph';

const jestGlobalApis = ['afterAll', 'afterEach', 'beforeAll', 'beforeEach', 'describe', 'test', 'it', 'expect', 'vi'];

const testApiProps = ['concurrent', 'each', 'only', 'skip', 'todo', 'failing'];

const jestGlobalApiProps: Record<string, string[]> = {
  describe: ['each', 'only', 'skip'],
  it: testApiProps,
  test: testApiProps,
};

const jestGlobalApiPropsKeys = Object.keys(jestGlobalApiProps);

const jestToVitestApiMap: Record<string, string> = {
  fit: 'it',
  jest: 'vi',
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

    if (jestToVitestApiMap[propExpressionText] && expressionName !== 'disableAutomock') {
      return jestToVitestApiMap[propExpressionText];
    }
  }
};

export const getImports = (sourceFile: SourceFile) => {
  const api: string[] = [];
  const propertyAccessExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  propertyAccessExpressions.forEach((propertyAccessExpressions) => {
    const expression = propertyAccessExpressions.getExpression();
    const res = handleIdentifier(expression, propertyAccessExpressions);
    if (res) {
      api.push(res);
    }
  });

  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  callExpressions.forEach((callExpression) => {
    const expression = callExpression.getExpression();
    if (Node.isIdentifier(expression)) {
      const expressionText = expression.getText();
      if (jestGlobalApis.includes(expressionText)) {
        api.push(expressionText);
      }
      if (jestToVitestApiMap[expressionText]) {
        api.push(jestToVitestApiMap[expressionText]);
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

const getCommentIndex = (sourceFile: SourceFile) => {
  let lastComment;

  for (const statement of sourceFile.getStatementsWithComments()) {
    if (statement.isKind(ts.SyntaxKind.MultiLineCommentTrivia)) {
      lastComment = statement;
    } else {
      break;
    }
  }

  return lastComment ? lastComment.getChildIndex() + 1 : 0;
};

export const addImports = (sourceFile: SourceFile) => {
  const api = getImports(sourceFile);
  const importDeclarationString = `import { ${[...new Set([...api])].sort().join(', ')} } from "vitest";`;

  const firstImportIndex = getFirstImportIndex(sourceFile);
  const commentIndex = getCommentIndex(sourceFile);
  const insertIndex = Math.max(firstImportIndex, commentIndex);
  sourceFile.insertStatements(insertIndex, importDeclarationString);
};
