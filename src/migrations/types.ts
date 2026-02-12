export interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
}
