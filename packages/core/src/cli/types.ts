export interface CliOptions {
  cwd?: string;
  agentPrompt?: {
    ask(question: string, defaultValue: string): Promise<string>;
  };
}
