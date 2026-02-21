export interface CliOptions {
  cwd?: string;
  specialistPrompt?: {
    ask(question: string, defaultValue: string): Promise<string>;
  };
  personaPrompt?: {
    ask(question: string, defaultValue: string): Promise<string>;
  };
}
