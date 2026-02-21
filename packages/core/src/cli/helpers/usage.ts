export function usage(): string {
  return [
    "Usage:",
    "  athena --version",
    "  athena run --session <id> --input <text> [--provider <id>] [--model <id>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena run --template <id> [--param key=value]... [--session <id>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena cancel --session <id> [--reason <text>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena specialist run --name <id> --repo <path> --head <branch> [--base <branch>] [--session <id>] [--out-json <path>] [--out-md <path>] [--stdout summary|json|md|none] [--provider <id>] [--model <id>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena specialist init <id> [--role <text>] [--description <text>]",
    "  athena specialist validate <id>",
    "  athena persona ... (alias for specialist ...)",
    "  athena work enqueue --session <id> --input <text> [--mode followup|collect] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena work drain --session <id> [--provider <id>] [--model <id>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena work status (--session <id> | --workflow <id>) [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena memory search --query <text> [--max-results <n>] [--min-score <n>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena memory get --path <workspace-relative-path> [--from <line>] [--lines <count>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena schedule add --id <id> --session <id> --input <text> --every-minutes <n> [--start-now true|false] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena schedule list [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena schedule run --id <id> [--provider <id>] [--model <id>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena schedule tick [--at <iso-datetime>] [--provider <id>] [--model <id>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena schedule logs --id <id> [--limit <n>] [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena schedule remove --id <id> [--transport local|api|auto] [--api-base-url <url>] [--api-timeout-ms <n>]",
    "  athena api serve [--host <host>] [--port <n>]",
    "  athena api contracts [--out <path>]"
  ].join("\n");
}
