import { File, ParserExt } from '../parser';

export interface Opts {
  aliasForNs: string[];
}

export type PathOption = {
  use: string | ParserExt;
  options?: Opts;
  query?: (className: string) => File[];
}

export interface LoaderOptions {
  debug: boolean;
  nameSpace: string;
  paths: Record<string, false | string | PathOption>;
}

export interface SourceMap {
  version: number;
  sources: string[];
  mappings: string;
  file?: string;
  sourceRoot?: string;
  sourcesContent?: string[];
  names?: string[];
}

export interface Updated {
  type: 'add' | 'update' | 'remove',
  start: number;
  end: number;
  data?: string
}

export interface ConfigOption {
  remove?: boolean;
  allowObject?: boolean,
  end?: boolean;
  prefix?: string;
}

export interface Config extends Record<string, boolean | ConfigOption> {
  requires: boolean | ConfigOption,
  mixins: boolean | ConfigOption,
  override: boolean | ConfigOption,
  extend: boolean | ConfigOption,
  uses: boolean | ConfigOption,
  stores: boolean | ConfigOption,
  controllers: boolean | ConfigOption,
  controller: boolean,
}