export interface File {
  names: string[];
  requires: string[];
  override: string;
  src: string;
}

export interface Tag {
  type: string;
  tag: string;
  name: string;
  default?: string;
  optional?: boolean;
  description?: string;
}

export interface Comment {
  tags: Tag[];
}

export type FileMap = Record<string, File>;

export type ClassProp = { classProp: File } | {};

export type ClassMap = Record<string, ClassProp>;

export interface SenchaPackage {
  namespace: string;
  type: 'theme' | 'framework' | 'toolkit' | 'code';
  toolkit: 'classic' | 'modern';
  framework: 'ext';
  version: string;
  extend?: string;
  summary?: string;
  detailedDescription?: string;
  compatVersion?: string;
  classpath: string | string[];
  overrides?: string[];
  requires?: string[];
}

export interface ParserOptions {
  path: string;
  toolkit: string;
  packages?: string[];
  namespace?: string;
  fileMap?: FileMap;
  classMap?: ClassMap;
}