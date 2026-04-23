type OptionValue = string | boolean | string[]

export type CommandContext = {
    command: string
    args: string[]
    options: Record<string, OptionValue>
    unknown: string[]
    raw: string[]
}

type CommandHandler = (ctx: CommandContext) => void | Promise<void>

type OptionConfig = {
    short_flag?: string
    long_flag?: string
    option_name: string
    requires_value: boolean
    repeatable: boolean
    value_placeholder?: string
    description?: string
}

type OptionDeclarationConfig = {
    repeatable?: boolean
    description?: string
}

function to_snake_case(input: string): string {
    return input
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/-/g, "_")
        .toLowerCase()
}

function parse_option_declaration(
    option_declaration: string,
    option_declaration_config: OptionDeclarationConfig = {}
): OptionConfig {
    const parts = option_declaration
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)

    const short_flag = parts.find((part) => /^-[a-zA-Z0-9]\b/.test(part))?.match(/^-([a-zA-Z0-9])/)?.[1]
    const long_flag = parts.find((part) => part.startsWith("--"))?.match(/^--([a-zA-Z][a-zA-Z0-9-]*)/)?.[1]
    const value_placeholder = option_declaration.match(/<([^>]+)>/)?.[1]?.trim()
    const requires_value = value_placeholder !== undefined
    const repeatable = option_declaration_config.repeatable ?? false
    const description = option_declaration_config.description?.trim() || undefined
    const base_name = long_flag ?? short_flag

    if (!base_name) {
        throw new Error(`Invalid option declaration: "${option_declaration}"`)
    }

    if (repeatable && !requires_value) {
        throw new Error(`Repeatable option must require a value: "${option_declaration}"`)
    }

    return {
        short_flag,
        long_flag,
        option_name: to_snake_case(base_name),
        requires_value,
        repeatable,
        value_placeholder,
        description,
    }
}

export class Command {
    private readonly option_configs: OptionConfig[] = []
    private handler?: CommandHandler

    constructor(
        public readonly name: string,
        public readonly description = ""
    ) {}

    /** Register one option for this command; description is used by built-in help output. */
    public option(option_declaration: string, option_declaration_config: OptionDeclarationConfig = {}): this {
        this.option_configs.push(parse_option_declaration(option_declaration, option_declaration_config))
        return this
    }

    /** Register the command handler called after args/options parsing. */
    public action(handler: CommandHandler): this {
        this.handler = handler
        return this
    }

    public get options(): OptionConfig[] {
        return this.option_configs
    }

    public async execute(ctx: CommandContext): Promise<void> {
        if (!this.handler) {
            throw new Error(`No action registered for command "${this.name}"`)
        }
        await this.handler(ctx)
    }
}

export class CLI {
    private readonly commands = new Map<string, Command>()

    /** Register a command by unique name; its description is shown in built-in help. */
    public command(name: string, description = ""): Command {
        if (this.commands.has(name)) {
            throw new Error(`Command "${name}" is already registered`)
        }
        const cmd = new Command(name, description)
        this.commands.set(name, cmd)
        return cmd
    }

    /** Run argv like process.argv.slice(2); auto handles -h/--help unless that command defines help manually. */
    public async run(argv: string[]): Promise<void> {
        const [command_name, ...tokens] = argv
        if (!command_name) {
            throw new Error("No command provided")
        }

        if (command_name === "-h" || command_name === "--help") {
            console.log(this.build_cli_help())
            return
        }

        const command = this.commands.get(command_name)
        if (!command) {
            throw new Error(`Unknown command: "${command_name}"`)
        }

        const has_manual_help = this.has_manual_help_option(command.options)
        if (!has_manual_help && this.has_help_token(tokens)) {
            console.log(this.build_command_help(command))
            return
        }

        const parsed = this.parse_args(tokens, command.options)
        await command.execute({
            command: command_name,
            args: parsed.args,
            options: parsed.options,
            unknown: parsed.unknown,
            raw: argv,
        })
    }

    private has_manual_help_option(option_configs: OptionConfig[]): boolean {
        return option_configs.some((option_config) => option_config.short_flag === "h" || option_config.long_flag === "help")
    }

    private has_help_token(tokens: string[]): boolean {
        for (const token of tokens) {
            if (token === "--") return false
            if (token === "-h" || token === "--help") return true
        }
        return false
    }

    private format_option_label(option_config: OptionConfig): string {
        const names: string[] = []
        if (option_config.short_flag) names.push(`-${option_config.short_flag}`)
        if (option_config.long_flag) names.push(`--${option_config.long_flag}`)
        const value_part = option_config.requires_value
            ? ` <${option_config.value_placeholder || "value"}>`
            : ""
        return `${names.join(", ")}${value_part}`
    }

    private format_option_description(option_config: OptionConfig): string | undefined {
        const base_description = option_config.description ?? option_config.value_placeholder
        if (option_config.repeatable) {
            return base_description ? `${base_description} (repeatable)` : "repeatable"
        }
        return base_description
    }

    public build_command_help(command: Command): string {
        const option_entries = [...command.options]
        if (!this.has_manual_help_option(command.options)) {
            option_entries.push({
                short_flag: "h",
                long_flag: "help",
                option_name: "help",
                requires_value: false,
                repeatable: false,
                description: "Show help for this command",
            })
        }

        const rows = option_entries.map((option_config) => ({
            label: this.format_option_label(option_config),
            description: this.format_option_description(option_config),
        }))
        const label_width = rows.reduce((max, row) => Math.max(max, row.label.length), 0)
        const option_lines =
            rows.length === 0
                ? ["  (none)"]
                : rows.map((row) =>
                      row.description
                          ? `  ${row.label.padEnd(label_width)}  ${row.description}`
                          : `  ${row.label}`
                  )

        const lines = [`Usage: ${command.name} [options] [args]`]
        if (command.description) {
            lines.push("", command.description)
        }
        lines.push("", "Options:", ...option_lines)
        return lines.join("\n")
    }

    private build_cli_help(): string {
        const commands = Array.from(this.commands.values())
        const name_width = commands.reduce((max, command) => Math.max(max, command.name.length), 0)
        const command_lines = commands.map((command) =>
            command.description
                ? `  ${command.name.padEnd(name_width)}  ${command.description}`
                : `  ${command.name}`
        )

        return [
            "Usage: <command> [options] [args]",
            "",
            "Commands:",
            ...command_lines,
            "",
            'Run "<command> --help" for command details.',
        ].join("\n")
    }

    private parse_args(tokens: string[], option_configs: OptionConfig[]) {
        const args: string[] = []
        const options: Record<string, OptionValue> = {}
        const unknown: string[] = []
        const assign_option = (option_config: OptionConfig, value: string | boolean) => {
            if (!option_config.repeatable) {
                options[option_config.option_name] = value
                return
            }

            if (typeof value !== "string") {
                throw new Error(`Repeatable option "${option_config.option_name}" must have string values`)
            }

            const existing = options[option_config.option_name]

            if (existing === undefined) {
                options[option_config.option_name] = [value]
                return
            }

            if (Array.isArray(existing)) {
                existing.push(value)
                return
            }

            if (typeof existing === "string") {
                options[option_config.option_name] = [existing, value]
                return
            }

            throw new Error(`Repeatable option "${option_config.option_name}" has invalid existing value`)
        }

        const short_map = new Map(
            option_configs
                .filter((config) => config.short_flag)
                .map((config) => [config.short_flag as string, config])
        )
        const long_map = new Map(
            option_configs
                .filter((config) => config.long_flag)
                .map((config) => [config.long_flag as string, config])
        )

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i]

            if (token === "--") {
                args.push(...tokens.slice(i + 1))
                break
            }

            if (token.startsWith("--")) {
                const option_body = token.slice(2)
                const eq_index = option_body.indexOf("=")
                const colon_index = option_body.indexOf(":")
                const separator_index =
                    eq_index >= 0 && colon_index >= 0
                        ? Math.min(eq_index, colon_index)
                        : Math.max(eq_index, colon_index)
                const name = separator_index >= 0 ? option_body.slice(0, separator_index) : option_body
                const inline_value = separator_index >= 0 ? option_body.slice(separator_index + 1) : undefined
                const option_config = long_map.get(name)

                if (!option_config) {
                    unknown.push(token)
                    continue
                }

                if (option_config.requires_value) {
                    const value = inline_value ?? tokens[++i]
                    if (value === undefined) {
                        throw new Error(`Missing value for --${name}`)
                    }
                    assign_option(option_config, value)
                } else {
                    assign_option(option_config, true)
                }
                continue
            }

            if (/^-[a-zA-Z0-9]$/.test(token)) {
                const name = token[1] as string
                const option_config = short_map.get(name)

                if (!option_config) {
                    unknown.push(token)
                    continue
                }

                if (option_config.requires_value) {
                    const value = tokens[++i]
                    if (value === undefined) {
                        throw new Error(`Missing value for -${name}`)
                    }
                    assign_option(option_config, value)
                } else {
                    assign_option(option_config, true)
                }
                continue
            }

            args.push(token)
        }

        return { args, options, unknown }
    }
}

/**
Usage example:

async function main(){
    const cli = create_cli()

    cli
        .command("build", "Build project assets")
        .option("-o, --output <dir>", { description: "Output directory" })
        .option("-m, --minify")
        .option("--option <value>", { repeatable: true, description: "Collect values" })
        .action(({ command, args, options, unknown }) => {
            console.log("command:", command)
            console.log("args:", args)
            console.log("options:", options)
            console.log("option values:", options.option)
            console.log("unknown:", unknown)
        })

    cli
        .command("serve", "Start local server")
        .option("-p, --port <port>")
        .option("-h, --host <host>")
        .action(({ options }) => {
            const port = options.port ?? "3000"
            const host = options.host ?? "127.0.0.1"
            console.log(`Serving on http://${host}:${port}`)
        })

    await cli.run(process.argv.slice(2))
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
})

// $ npx tsx cli.ts --help
// $ npx tsx cli.ts build --help
// $ npx tsx cli.ts build arg1 arg2 --option:a --option:b
**/
export const create_cli = (): CLI => new CLI()
