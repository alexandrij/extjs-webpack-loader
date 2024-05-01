import { Tag } from './types';

export class ParserTag implements Tag {
  private _type: string;
  private _tag: string;
  private _name: string;

  constructor(tag: Tag) {
    this._type = tag.type;
    this._tag = tag.tag;
    this._name = tag.name;
  }

  get name() {
    return this._name;
  }

  get type() {
    return this._type;
  }

  get tag() {
    return this._tag;
  }
}
