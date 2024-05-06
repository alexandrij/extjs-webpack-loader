import { resolve } from 'path';
import { readFileSync } from 'fs';
import { parse, ParseResult } from '@babel/parser';
import {
  File as ParsedFile,
  isCallExpression,
  isExpressionStatement,
  isIdentifier,
  isMemberExpression,
  isStringLiteral,
  isObjectExpression,
  isObjectProperty,
  isArrayExpression,
} from '@babel/types';
import { Block, Spec, parse as commentParse } from 'comment-parser';
import { File, Tag } from './types';
import { ParserTag } from './parser-tag';

const nameTags = ['define', 'class'];
const requireTags = ['require', 'mixins'];
const overrideTags = ['override'];

/**
 *
 * @property Array names
 * @property Array requires
 * @property Array override
 */
interface Options {
  names?: string[];
  requires?: string[];
  override?: string;
  ignoreOverrides?: boolean;
}

export class ParserFile implements File {
  public names: string[];
  public requires: string[];
  public override: string;
  public ignoreOverrides: boolean;
  public src: string;

  constructor(options: Options = {}) {
    this.names = [];
    this.requires = [];
    this.override = '';
    this.ignoreOverrides = Boolean(options.ignoreOverrides);
    this.src = '';
  }

  async parse(src: string) {
    const content = this.loadFile(src);
    // @ts-ignore
    // const ASTEsprima = this.generateEsprimaAST(content);

    const AST = this.generateAST(content);
    const comments = this.extractComments(AST);
    const groupedTags = this.groupComments(comments);

    this.parseTags(groupedTags);

    this.extractCode(AST);
  }

  generateAST(content: string): ParseResult<ParsedFile> {
    return parse(content.toString(), {
      sourceType: 'script',
      attachComment: true,
      tokens: false,
      ranges: false,
    });
  }

  /**
   * Loads a file and returns with the jsDoc comments
   *
   * @param src String
   */
  loadFile(src: string) {
    this.src = src;
    const content = readFileSync(resolve(src));
    return content.toString();
  }

  extractCode(AST: ParseResult<ParsedFile>) {
    AST.program.body.forEach((node) => {
      // `[expression.callee.object.name = 'Ext'][expression.callee.property.name = define][expression.arguments.0.value!='null']`;
      if (
        isExpressionStatement(node) &&
        isCallExpression(node.expression) &&
        isMemberExpression(node.expression.callee) &&
        isIdentifier(node.expression.callee.object) &&
        node.expression.callee.object.name === 'Ext' &&
        isIdentifier(node.expression.callee.property) &&
        node.expression.callee.property.name === 'define' &&
        isStringLiteral(node.expression.arguments[0])
      ) {
        // Название класса Ext.define('Example.view.Main'...)
        this.addName(node.expression.arguments[0].value);

        node.expression.arguments.forEach((node) => {
          if (isObjectExpression(node)) {
            node.properties.forEach((property) => {
              if (isObjectProperty(property)) {
                /**
                 * Альтернативное название класса
                 *
                 * Пример:
                 * Ext.define('Example.view.Main', {
                 *   alternateClassName: 'ExampleViewMain' или
                 *
                 *   alternateClassName: ['ExampleViewMain', 'ExampleCompMain']
                 * })
                 */
                if (isIdentifier(property.key) && property.key.name === 'alternateClassName') {
                  if (isStringLiteral(property.value)) {
                    this.addName(property.value.value);
                  } else if (isArrayExpression(property.value)) {
                    property.value.elements.forEach((element) => {
                      if (isStringLiteral(element)) {
                        this.addName(element.value);
                      }
                    });
                  }
                }

                /**
                 * Добавление родительского класса
                 *
                 * Пример:
                 * Ext.define('Example.form.field.ComboBox', {
                 *   extend: 'Ext.form.field.ComboBox'
                 * })
                 */
                if (isIdentifier(property.key) && property.key.name === 'extend') {
                  if (isStringLiteral(property.value)) {
                    this.addRequire(property.value.value);
                  } else {
                    console.error('not found extended class');
                  }
                }

                /**
                 * Определение зависимых пакетов requires
                 *
                 * Пример:
                 * Ext.define('Example.view.Main', {
                 *   requires: 'Example.model.User' или
                 *   requires: ['Example.model.User', 'Example.view.UserList']
                 * })
                 */
                if (isIdentifier(property.key) && property.key.name === 'requires') {
                  if (isStringLiteral(property.value)) {
                    this.addRequire(property.value.value);
                  } else if (isArrayExpression(property.value)) {
                    property.value.elements.forEach((element) => {
                      if (isStringLiteral(element)) {
                        this.addRequire(element.value);
                      }
                    });
                  }
                }

                /**
                 * Определение зависимых пакетов usages
                 *
                 * Пример:
                 * Ext.define('Example.view.Main', {
                 *   usages: 'Example.model.User' или
                 *   usages: ['Example.model.User', 'Example.view.UserList']
                 * })
                 */
                if (isIdentifier(property.key) && property.key.name === 'uses') {
                  if (isStringLiteral(property.value)) {
                    this.addRequire(property.value.value);
                  } else if (isArrayExpression(property.value)) {
                    property.value.elements.forEach((element) => {
                      if (isStringLiteral(element)) {
                        this.addRequire(element.value);
                      }
                    });
                  }
                }

                /**
                 * Определение зависимых переопределяемых классов override
                 *
                 * Пример:
                 * Ext.define('Example.form.field.ComboBox', {
                 *   override: 'Ext.form.field.ComboBox'
                 * })
                 */
                if (!this.ignoreOverrides && isIdentifier(property.key) && property.key.name === 'override') {
                  if (isStringLiteral(property.value)) {
                    this.addOverride(property.value.value);
                  } else {
                    console.error('not found extended class');
                  }
                }
              }
            });
          }
        });
      }
    });
  }

  extractComments(AST: ParseResult<ParsedFile>): Block[] {
    return AST.comments
      ? AST.comments
          .map((comment) => {
            let value = comment.value;
            if (comment.type === 'CommentLine') {
              value = `*${comment.value}`;
            }
            return commentParse(`/*${value}*/`)[0];
          })
          .filter(Boolean)
      : [];
  }

  groupComments(comments: Block[]): Spec[] {
    return comments.reduce((ret: Spec[], comment) => {
      // @ts-ignore
      return ret.concat(comment.tags);
    }, []);
  }

  parseTags(tags: Tag[]) {
    tags.forEach((tag) => {
      return this.parseTag(new ParserTag(tag));
    });
  }

  parseTag(tag: Tag) {
    if (tag.tag === 'class' && (tag.name === 'Ext' || tag.name === 'Ext.Widget')) {
      if (this.src.indexOf('Ext.js') === -1) {
        return;
      }
    }

    if (nameTags.includes(tag.tag)) {
      this.addName(tag.name);
    }
    if (requireTags.includes(tag.tag)) {
      this.addRequire(tag.name);
    }
    if (overrideTags.includes(tag.tag)) {
      this.addOverride(tag.name);
    }
    /* if (tag.tag.indexOf('cmd-auto-dependency') > -1) {
         if (tag.type.defaultType && tag.type.defaultType.indexOf('Ext.') > -1) {
           console.log('Adding defaultType',tag.type.defaultType);
             this.addRequire(tag.type.defaultType);
         }
     }*/
  }

  addName(name: string) {
    if (name && name !== '' && !this.names.includes(name)) {
      this.names.push(name);
    }
  }

  addRequire(require: string) {
    if (require) {
      this.requires.push(require);
    }
  }

  addOverride(override: string) {
    if (override) {
      this.override = override;
    }
  }
}
