import { File } from '@babel/types';
import { ParseResult } from '@babel/parser';
import { resolve } from 'path';

import { ParserFile } from './parser-file';

describe('File loading', () => {
  it('should load file', () => {
    const parser = new ParserFile();
    expect(parser.loadFile(resolve(__dirname, './__mock__/file-test-all.js')).length).toBeGreaterThan(0);
  });

  it('should error when file does not exists', async () => {
    const parser = new ParserFile();
    expect(() => {
      parser.loadFile('not-existing-file');
    }).toThrow();
  });
});

describe('file content extract', () => {
  const files = ['file-test-all.js', 'file-requires-none-existing.js'];
  files.forEach((file, idx) => {
    it(`should be ${idx + 1} comment block`, () => {
      const parser = new ParserFile();
      const parsed = parser.loadFile(resolve(__dirname, `./__mock__/${file}`));
      const ast = parser.generateAST(parsed);
      expect(ast.type).toBe('File');
      expect(ast.program).toBeDefined();
      expect(ast.program.type).toBe('Program');
    });
  });
});

describe('Extract comments', () => {
  const testData = require('./__mock__/test-data.json');
  const schema = require('./__mock__/schema.json');

  describe('Block comments', () => {
    it('should return 1 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.oneBlock.twoTags as ParseResult<File>;
      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 1,
        maxItems: 1,
      });
    });

    it('should return 2 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.twoBlocks.twoTags;

      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 2,
        maxItems: 2,
      });
    });

    it('should return 3 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.threeBlocks.withEmptyBlock;
      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 3,
        maxItems: 3,
      });
    });
  });

  describe('Line comments', () => {
    it('should return 1 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.oneLine.twoTags;
      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 1,
        maxItems: 1,
      });
    });

    it('should return 2 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.twoLines.twoTags;
      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 2,
        maxItems: 2,
      });
    });
  });

  describe('Mixed comments', () => {
    it('block-line-emptyline should return 2 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.mixed.withEmptyLine;
      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({ ...schema.AST.comments, minItems: 2, maxItems: 2 });
    });

    it('should return 2 comment block', () => {
      let parser = new ParserFile();
      let mockData = testData.AST.comments.mixed.withEmptyBlock;
      const result = parser.extractComments(mockData);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 2,
        maxItems: 2,
      });
    });

    it('should return 3 comment block', () => {
      let parser = new ParserFile();
      const result = parser.extractComments(testData.AST.comments.mixed.full);
      expect(result).toMatchSchema({
        ...schema.AST.comments,
        minItems: 3,
        maxItems: 3,
      });
    });
  });
});

describe('Parse tags', () => {
  it('should find all requires', async () => {
    let parser = new ParserFile();
    await parser.parse(resolve(__dirname, './__mock__/file-test-all.js'));

    let mustHave = ['structure.fileB', 'structure.fileC', 'structure.fileD', 'structure.fileA'];
    expect(parser.requires).toEqual(mustHave);
  });

  it('should find all define', () => {
    let parser = new ParserFile();
    return parser.parse(resolve(__dirname, './__mock__/file-define-only.js')).then(() => {
      let mustHave = ['structure.fileD', 'structure.fileDAlias', 'structure.fileE'];
      expect(parser.names.sort()).toEqual(mustHave.sort());
    });
  });

  it('should find all define and requires', () => {
    let parser = new ParserFile();
    return parser.parse(resolve(__dirname, './__mock__/file-test-all.js')).then(() => {
      let mustHaveNames = ['structure.alias.file', 'structure.file', 'structure.fileClass', 'structure.fileE', 'fileE'];
      let mustHaveRequires = ['structure.fileA', 'structure.fileB', 'structure.fileC', 'structure.fileD'];
      expect(parser.names.sort()).toEqual(mustHaveNames.sort());
      expect(parser.requires.sort()).toEqual(mustHaveRequires.sort());
    });
  });
});
