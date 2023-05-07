import { CallExpression, Node, PropertyAccessExpression } from 'ts-morph';

const apiNamesToMakeAsync = ['genMockFromModule', 'createMockFromModule', 'requireActual', 'requireMock'];

const apiNamesRecord: Record<string, string> = {
  createMockFromModule: 'importMock',
  deepUnmock: 'unmock',
  genMockFromModule: 'importMock',
  requireActual: 'importActual',
  requireMock: 'importMock',
  setMock: 'mock',
};

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

export const replaceJestWithVi = (node: CallExpression, expression: PropertyAccessExpression) => {
  const propExpression = expression.getExpression();
  if (Node.isPropertyAccessExpression(propExpression)) {
    const propExpressionNested = propExpression.getExpression();
    if (Node.isIdentifier(propExpressionNested)) {
      const propExpressionText = propExpressionNested.getText();

      if (propExpressionText === 'jest') {
        propExpressionNested.replaceWithText('vi');
      }
    }
  }

  if (Node.isIdentifier(propExpression)) {
    const propExpressionText = propExpression.getText();
    const propExpressionName = expression.getName();

    if (propExpressionText === 'jest') {
      if (propExpressionName === 'disableAutomock') {
        const parent = node.getParent();
        if (Node.isExpressionStatement(parent)) {
          parent.remove();
          return;
        }
      }

      propExpression.replaceWithText('vi');

      handleApiNamesRecord(node, expression);
    }
  }
};
