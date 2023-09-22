import { CallExpression, Node, PropertyAccessExpression } from 'ts-morph';

export const updateMock = (node: CallExpression, expression: PropertyAccessExpression) => {
  const expressionName = expression.getName();
  if (expressionName === 'setMock') {
    const [moduleName, mock] = node.getArguments();
    if (Node.isStringLiteral(mock)) {
      mock
        .replaceWithText(`() => ({ default: ${mock.getText()} })`);
    } else {
      mock
        .replaceWithText(`() => (${mock.getText()})`);
    }
  }
  if (expressionName === 'mock') {
    const [moduleName, mock] = node.getArguments();
    if (Node.isArrowFunction(mock)) {
      const functionBody = mock.getBody();
      if (Node.isStringLiteral(functionBody)) {
        functionBody
          .replaceWithText(`({ default: ${functionBody.getText()} })`);
      }
    }
    if (Node.isFunctionExpression(mock)) {
      const functionBody = mock.getBody();
      if (Node.isBlock(functionBody)) {
        const functionStatements = functionBody.getStatements();
        const returnStatement =
          functionStatements[functionStatements.length - 1];
        if (Node.isReturnStatement(returnStatement)) {
          const returnExpression = returnStatement.getExpression();
          if (returnExpression) {
            returnExpression.replaceWithText(
              `{ default: ${returnExpression.getText()} }`
            );
          }
        }
      }
    }
  }
};
