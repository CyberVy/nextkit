import { useState } from "react"
import { ArrowRight, ArrowUpRight, Blocks, Code2, Globe2, Monitor, Smartphone, Workflow } from "lucide-react"
import { LaunchAnimation } from "@/blocks/LaunchAnimation"

const targets = [
    { n: "01", name: "Web", detail: "A fast, accessible web application.", tech: "Browser runtime", Icon: Globe2 },
    { n: "02", name: "PWA", detail: "Installable and ready to work offline.", tech: "Service worker", Icon: Smartphone },
    { n: "03", name: "Desktop", detail: "A native desktop experience.", tech: "Tauri · Rust", Icon: Monitor },
    { n: "04", name: "Mobile", detail: "The same app, wherever users are.", tech: "Native bridge", Icon: Smartphone }
]

const principles = [
    ["01", "One codebase", "Share UI, business logic, and application state across platforms."],
    ["02", "Web first", "Build with web standards as your application runtime, not as a compromise."],
    ["03", "Native when needed", "Reach platform capabilities through a focused native bridge."]
]

function App() {
    const [show_launch_animation, set_show_launch_animation] = useState(true)

    return <>
        <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background" {...(show_launch_animation ? { inert: true } : {})}>
            <header className="border-b border-foreground/10">
                <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6 lg:px-10">
                    <a href="#top" className="flex items-center gap-3 font-semibold tracking-tight"><span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><Code2 size={17}/></span>nextkit<span className="text-foreground/35">.</span></a>
                    <nav className="hidden gap-8 text-[13px] text-foreground/55 md:flex"><a href="#platforms" className="hover:text-foreground">Platforms</a><a href="#architecture" className="hover:text-foreground">Architecture</a><a href="#start" className="hover:text-foreground">Quick start</a></nav>
                    <a href="#start" className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground/15 px-4 text-xs font-medium hover:bg-foreground/[0.04]">Get started <ArrowUpRight size={14}/></a>
                </div>
            </header>

            <main id="top">
                <section className="relative overflow-hidden border-b border-foreground/10">
                    <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(128,128,128,.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,.15)_1px,transparent_1px)] [background-size:72px_72px]"/>
                    <div className="relative mx-auto grid min-h-[650px] max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:py-32">
                        <div>
                            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/80 px-3 py-1.5 text-[10px] font-medium tracking-widest text-foreground/55"><span className="size-1.5 rounded-full bg-foreground"/> CROSS-PLATFORM APPLICATION FRAMEWORK</div>
                            <h1 className="text-[clamp(3.6rem,8vw,7.5rem)] font-semibold leading-[.91] tracking-[-.075em]">The Web is<br/>the <span className="text-foreground/35">Application.</span></h1>
                            <p className="mt-9 max-w-xl text-base leading-8 text-foreground/55 sm:text-lg">Build modern applications with web technologies. Ship to the browser, install as a PWA, or go native — from one codebase.</p>
                            <div className="mt-10 flex flex-wrap gap-3"><a href="#start" className="inline-flex h-12 items-center gap-3 rounded-full bg-foreground px-6 text-sm font-medium text-background hover:opacity-80">Start building <ArrowRight size={16}/></a><a href="#architecture" className="inline-flex h-12 items-center rounded-full border border-foreground/15 px-6 text-sm font-medium hover:bg-foreground/[0.04]">Explore the framework</a></div>
                            <div className="mt-16 flex gap-6 font-mono text-[10px] uppercase tracking-wider text-foreground/35"><span>React 19</span><span>Vite</span><span>Tauri 2</span><span>TypeScript</span></div>
                        </div>
                        <div className="relative mx-auto w-full max-w-[480px] rounded-2xl border border-foreground/15 bg-background shadow-[0_28px_90px_rgba(0,0,0,.1)]">
                            <div className="flex h-12 items-center justify-between border-b border-foreground/10 px-4"><div className="flex gap-1.5"><i className="size-2 rounded-full bg-foreground/15"/><i className="size-2 rounded-full bg-foreground/15"/><i className="size-2 rounded-full bg-foreground/15"/></div><span className="font-mono text-[10px] text-foreground/35">your-app / src</span><span className="text-[10px] text-foreground/35">TSX</span></div>
                            <div className="p-6 sm:p-8"><div className="mb-8 flex items-center justify-between"><div><div className="font-mono text-[10px] uppercase tracking-widest text-foreground/35">Project overview</div><div className="mt-2 text-xl font-semibold">One app. Every screen.</div></div><div className="flex size-10 items-center justify-center rounded-xl bg-foreground text-background"><Blocks size={19}/></div></div>
                                <div className="space-y-3">{targets.map(({n,name,tech,Icon})=><div key={n} className="flex items-center gap-4 rounded-xl border border-foreground/10 p-3.5 transition hover:border-foreground/30 hover:bg-foreground/[.025]"><div className="flex size-10 items-center justify-center rounded-lg bg-foreground/[.06]"><Icon size={18}/></div><div className="flex-1"><div className="flex justify-between text-sm font-semibold"><span>{name}</span><span className="font-mono text-[10px] text-foreground/35">{n}</span></div><div className="mt-1 text-[11px] text-foreground/45">{tech}</div></div><ArrowUpRight size={14} className="text-foreground/25"/></div>)}</div>
                                <div className="mt-6 flex justify-between border-t border-foreground/10 pt-5 font-mono text-[10px] text-foreground/35"><span>SHARED APPLICATION CORE</span><span>READY</span></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="platforms" className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
                    <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><div className="font-mono text-[10px] tracking-[.2em] text-foreground/40">01 / ONE CODEBASE, FOUR TARGETS</div><h2 className="mt-5 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Meet your users<br/>where they are.</h2></div><p className="max-w-sm text-sm leading-6 text-foreground/50">Different platforms. Familiar web standards. One consistent application experience, without maintaining four separate products.</p></div>
                    <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/10 sm:grid-cols-2 lg:grid-cols-4">{targets.map(({n,name,detail,Icon})=><article key={n} className="min-h-[225px] bg-background p-7 transition hover:bg-foreground/[.025]"><div className="flex justify-between"><span className="font-mono text-[10px] text-foreground/35">/{n}</span><Icon size={20} className="text-foreground/45"/></div><h3 className="mt-12 text-xl font-semibold">{name}</h3><p className="mt-3 text-[13px] leading-6 text-foreground/50">{detail}</p></article>)}</div>
                </section>

                <section id="architecture" className="border-y border-foreground/10 bg-foreground/[.025]"><div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-32"><div><div className="font-mono text-[10px] tracking-[.2em] text-foreground/40">02 / UNDER THE HOOD</div><h2 className="mt-5 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">A clear core.<br/>A flexible edge.</h2><p className="mt-7 max-w-md text-sm leading-7 text-foreground/55">Keep application logic independent from the interface and the platform. Each layer has a clear responsibility, so your app stays easier to reason about as it grows.</p></div>
                    <div className="rounded-2xl border border-foreground/10 bg-background p-5 sm:p-8"><div className="mb-5 flex justify-between font-mono text-[10px] tracking-wider text-foreground/35"><span>APPLICATION ARCHITECTURE</span><span>OVERVIEW / 01</span></div><div className="rounded-xl border border-foreground/15 p-5 text-center"><Workflow size={19} className="mx-auto"/><div className="mt-3 text-sm font-semibold">Application UI</div><div className="mt-1 text-[11px] text-foreground/40">React · Views · Blocks</div></div><div className="mx-auto h-8 w-px bg-foreground/20"/><div className="rounded-xl border border-foreground/15 bg-foreground/[.025] p-5 text-center"><div className="text-sm font-semibold">Controllers</div><div className="mt-1 text-[11px] text-foreground/40">State · Events · Business logic</div><div className="mt-3 inline-flex rounded-full border border-foreground/10 px-3 py-1 font-mono text-[9px] text-foreground/40">SINGLE SOURCE OF TRUTH</div></div><div className="mx-auto h-8 w-px bg-foreground/20"/><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-foreground/15 p-4 text-center"><Globe2 size={17} className="mx-auto"/><div className="mt-2 text-xs font-semibold">Web runtime</div><div className="mt-1 text-[10px] text-foreground/40">Browser · PWA</div></div><div className="rounded-xl border border-foreground/15 p-4 text-center"><Monitor size={17} className="mx-auto"/><div className="mt-2 text-xs font-semibold">Native bridge</div><div className="mt-1 text-[10px] text-foreground/40">Tauri · Rust</div></div></div></div>
                </div></section>

                <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32"><div className="font-mono text-[10px] tracking-[.2em] text-foreground/40">03 / DESIGN PRINCIPLES</div><div className="mt-5 grid gap-12 md:grid-cols-3 md:gap-8">{principles.map(([n,title,desc])=><article key={n} className="border-t border-foreground/15 pt-5"><span className="font-mono text-[10px] text-foreground/35">{n}</span><h3 className="mt-9 text-xl font-semibold">{title}</h3><p className="mt-3 max-w-sm text-[13px] leading-6 text-foreground/50">{desc}</p></article>)}</div></section>

                <section id="start" className="border-t border-foreground/10"><div className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[1fr_.8fr] lg:items-center lg:px-10 lg:py-28"><div><div className="font-mono text-[10px] tracking-[.2em] text-foreground/40">04 / GET STARTED</div><h2 className="mt-5 text-4xl font-semibold tracking-[-.055em] sm:text-5xl">Start with an idea.<br/>Ship an application.</h2><p className="mt-6 max-w-md text-sm leading-7 text-foreground/50">Create a new Nextkit project and start building with the tools you already know.</p></div><div className="overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/[.025]"><div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4 text-xs font-medium"><span className="flex items-center gap-2"><Code2 size={14}/> Terminal</span><span className="font-mono text-[10px] text-foreground/35">QUICK START</span></div><div className="space-y-5 p-5 sm:p-7"><div><div className="mb-2 font-mono text-[10px] text-foreground/35">01 — CREATE A PROJECT</div><div className="rounded-lg bg-foreground/[.05] px-4 py-3 font-mono text-xs">$ npm create nextkit</div></div><div><div className="mb-2 font-mono text-[10px] text-foreground/35">02 — START DEVELOPING</div><div className="rounded-lg bg-foreground/[.05] px-4 py-3 font-mono text-xs">$ npm run dev</div></div><div className="flex items-center justify-between border-t border-foreground/10 pt-5"><span className="text-[11px] text-foreground/40">Your next app starts here.</span><a href="https://github.com/CyberVy/nextkit" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-medium">GitHub <ArrowUpRight size={14}/></a></div></div></div></div></section>
            </main>
            <footer className="border-t border-foreground/10"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-7 text-[11px] text-foreground/40 sm:flex-row sm:justify-between lg:px-10"><a href="#top" className="font-semibold text-foreground/65">nextkit.</a><span>Build once. Reach everywhere.</span><span className="font-mono">© {new Date().getFullYear()} NEXTKIT</span></div></footer>
        </div>
        {show_launch_animation && <LaunchAnimation on_finish={() => set_show_launch_animation(false)}/>}
    </>
}

export default App
