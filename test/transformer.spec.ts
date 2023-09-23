import { readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import util from "node:util";
const exec = util.promisify(require("node:child_process").exec);

import { migrateFile } from '../src';

afterEach(async () => {
  await exec("git stash push -- test/__fixtures__");
});

describe('transformer', () => {
  const inputFileRegex = /(.*).input.m?[jt]sx?$/;
  const errorFileRegex = /(.*).error.m?[jt]sx?$/;

  const fixtureDir = path.join(__dirname, '__fixtures__');
  const fixtureSubDirs = readdirSync(fixtureDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  const getTestFileMetadata = (dirPath: string, fileRegex: RegExp) =>
    readdirSync(dirPath)
      .filter((fileName) => fileRegex.test(fileName))
      .map(
        (fileName) => [(fileName.match(fileRegex) as RegExpMatchArray)[1], fileName.split('.').pop() as string] as const
      );

  const getTestFileCode = async (dirPath: string, fileName: string) => readFile(path.join(dirPath, fileName), 'utf8');

  describe.each(fixtureSubDirs)('%s', (subDir) => {
    const subDirPath = path.join(fixtureDir, subDir);
    console.log(getTestFileMetadata(subDirPath, inputFileRegex));

    it.concurrent.each(getTestFileMetadata(subDirPath, inputFileRegex))(
      'transforms: %s.%s',
      async (filePrefix, fileExtension) => {
        const inputFileName = [filePrefix, 'input', fileExtension].join('.');
        const outputFileName = [filePrefix, 'output', fileExtension].join('.');

        await migrateFile(path.join(subDirPath, inputFileName))!.save();
        const input = await getTestFileCode(subDirPath, inputFileName);

        const outputCode = await getTestFileCode(subDirPath, outputFileName);
        expect(input.trim()).toEqual(outputCode.trim());
      },
      60000
    );

    it.concurrent.each(getTestFileMetadata(subDirPath, errorFileRegex))(
      'throws: %s.%s',
      async (filePrefix, fileExtension) => {
        const inputFileName = [filePrefix, 'error', fileExtension].join('.')

        expect(
          () => migrateFile(path.join(subDirPath, inputFileName))
        ).toThrow()
      },
    )
  });

  //   describe('.snap', () => {
  //     it.each([
  //       [
  //         'Empty array',
  //         'exports[`snapshot 1`] = `Array []`;',
  //         'exports[`snapshot 1`] = `[]`;',
  //       ],
  //       [
  //         'Empty object',
  //         'exports[`snapshot 1`] = `Object {}`;',
  //         'exports[`snapshot 1`] = `{}`;',
  //       ],
  //       [
  //         'Nested array+object',
  //         `exports[\`snapshot 1\`] = \`
  //           Array [
  //             Object {
  //               "foo": "bar",
  //             },
  //           ]
  //           \`;`,
  //         `exports[\`snapshot 1\`] = \`
  //           [
  //             {
  //               "foo": "bar",
  //             },
  //           ]
  //           \`;`,
  //       ],
  //     ])('%s', async (testName, inputCode, outputCode) => {
  //       const input = {
  //         path: 'test.js.snap',
  //         source: inputCode,
  //       }

  //       const output = await transform(input, {
  //         j: jscodeshift,
  //         jscodeshift,
  //         stats: () => {},
  //         report: () => {},
  //       })

  //       expect(output.trim()).toEqual(outputCode)
  //     })
  //   })
});
