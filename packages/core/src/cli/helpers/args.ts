interface ParsedArgs {
  command: string | undefined;
  flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0];
  const flags: Record<string, string> = {};

  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = value;
    i += 1;
  }

  return { command, flags };
}

export function collectRepeatedFlagValues(argv: string[], key: string): string[] {
  const values: string[] = [];
  const needle = `--${key}`;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== needle) {
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Flag ${needle} requires a value.`);
    }
    values.push(value);
    index += 1;
  }
  return values;
}

export function parseTemplateParamFlags(entries: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const entry of entries) {
    const pivot = entry.indexOf("=");
    if (pivot <= 0 || pivot === entry.length - 1) {
      throw new Error(`Invalid --param '${entry}'. Expected key=value.`);
    }
    const key = entry.slice(0, pivot).trim();
    const value = entry.slice(pivot + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid --param '${entry}'. Expected non-empty key=value.`);
    }
    params[key] = value;
  }
  return params;
}
