import sys
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from forensixd.core.device_detector import DeviceDetector
from forensixd.core.session import ForensicSession
from forensixd.core.models import ExtractionLevel
from forensixd.core.exceptions import ForensixdError, AuthorizationError
from forensixd.extractors.base import ExtractorRegistry
from forensixd.legal.authorization import AuthorizationManager
from forensixd.writers.dfxml_writer import DFXMLWriter
from forensixd.writers.ufdr_writer import UFDRWriter
from forensixd.writers.report_writer import ReportWriter

console = Console()

@click.group(invoke_without_command=True)
@click.pass_context
@click.version_option("0.1.0", prog_name="forensixd")
def main(ctx):
    """forensixd — Forensic Data Extraction for Law Enforcement."""
    if ctx.invoked_subcommand is None:
        interactive_mode()

@main.command()
@click.option("--output-dir","-o", required=False, type=click.Path())
@click.option("--level","-l", type=click.Choice(["logical","file_system","physical"]), default=None)
@click.option("--ufdr-config", type=click.Path(), default=None)
def acquire(output_dir, level, ufdr_config):
    """Run a full forensic acquisition."""
    console.print(Panel("[bold]forensixd Acquisition[/bold]", subtitle="Law Enforcement Only"))

    # Step 1: detect device
    from forensixd.core.device_detector import USB_AVAILABLE
    if not USB_AVAILABLE:
        console.print("[red]Error: pyusb library is missing or no USB backend is available.[/red]")
        console.print("[yellow]Hint: Run 'pip install pyusb' and ensure libusb is installed (e.g. 'brew install libusb' on macOS).[/yellow]")
        sys.exit(1)

    detector = DeviceDetector()
    with Progress(SpinnerColumn(), TextColumn("{task.description}"), transient=True) as p:
        t = p.add_task("Scanning for devices...", total=None)
        devices = detector.scan()
        p.remove_task(t)
    if not devices:
        console.print("[red]No devices found.[/red]")
        console.print("[yellow]Hint: Please ensure your device is connected via USB and trusted.[/yellow]")
        sys.exit(1)
    device = devices[0]
    console.print(f"[green]Found:[/green] {device.platform.value} — {device.device_id}")

    # Step 1.5: Mandatory Real-Time Streaming Setup
    from forensixd.constants import STREAM_URL, LOGIN_URL
    # Fallback to localhost if not compiled with a secret
    stream_url = "http://localhost:8000" if STREAM_URL == "INJECTED_STREAM_URL" else STREAM_URL
    login_url = "http://localhost:5173/login" if LOGIN_URL == "INJECTED_LOGIN_URL" else LOGIN_URL

    api_stream_writer = None
    selected_case = None
    
    try:
        from forensixd.core.auth_manager import authenticate_via_browser, get_assigned_cases, prompt_case_selection
        from forensixd.writers.api_stream_writer import ApiStreamWriter
        
        console.print(f"[cyan]Connecting to server at: {stream_url}[/cyan]")
        token, session_encryption_key = authenticate_via_browser(login_url=login_url)
        cases = get_assigned_cases(stream_url, token)
        selected_case = prompt_case_selection(cases)
        if not selected_case:
            console.print("[red]Authentication aborted. No case selected.[/red]")
            sys.exit(1)
        case_id = selected_case.get("id")
        if not case_id:
            console.print("[red]Error: Selected case has no ID.[/red]")
            sys.exit(1)
        
        # Using hash of device_id or simple lookup if we have a real DB device ID,
        # For now just use 1 or hash of string device id
        internal_device_id = 1
        api_stream_writer = ApiStreamWriter(stream_url, token, session_encryption_key, int(case_id), internal_device_id)
    except Exception as e:
        console.print(f"[red]Authentication or server connection failed:[/red] {e}")
        console.print("[red]Extraction cannot proceed without server connection.[/red]")
        sys.exit(1)

    # Step 2: authorization
    try:
        if api_stream_writer and selected_case:
            from forensixd.core.models import CaseMetadata, ConsentType
            from datetime import datetime, timezone
            import getpass
            
            case = CaseMetadata(
                case_number=selected_case.get("caseNumber", "UNKNOWN"),
                court_order_ref=str(selected_case.get("id", "STREAM_MODE")),
                examiner_id=getpass.getuser() or "io_user",
                jurisdiction="Backend UI",
                consent_type=ConsentType.COURT_ORDER,
                authorized_at=datetime.now(timezone.utc),
                device=device,
                notes=selected_case.get("title", "Streamed acquisition")
            )
        else:
            case = AuthorizationManager.capture_interactively(device)
    except (AuthorizationError, ForensixdError) as e:
        console.print(f"[red]Authorization failed:[/red] {e}")
        sys.exit(1)

    # Step 2.5: Interactive Prompts for missing args
    from rich.prompt import Prompt
    if not output_dir:
        output_dir = Prompt.ask("\n[bold]Output directory[/bold]", default="./cases")
    if not level:
        level = Prompt.ask("[bold]Extraction level[/bold]", choices=["logical", "file_system", "physical"], default="logical")
        
    profile_input = Prompt.ask(
        "[bold]Extraction Profile[/bold]\n"
        "  [1] Textual Only (SMS, Calls, Contacts, Backups)\n"
        "  [2] Media Only (Images, Videos, PDFs)\n"
        "  [3] Everything\n"
        "Select an option", 
        choices=["1", "2", "3"], 
        default="1"
    )
    profile_map = {"1": "textual", "2": "media", "3": "all"}
    extraction_profile = profile_map[profile_input]

    if ufdr_config is None:
        ufdr_config = Prompt.ask("[bold]CopSight AI config path[/bold] (optional, press Enter to skip)", default="")

    # Step 3: extractor
    try:
        extractor_cls = ExtractorRegistry.get(device.platform)
    except ForensixdError as e:
        console.print(f"[red]No extractor:[/red] {e}")
        sys.exit(1)
    extractor = extractor_cls()
    if not extractor.is_available():
        console.print("[red]Required libraries not installed.[/red]")
        sys.exit(1)

    # Step 4: extract
    artifacts = []
    ext_level = ExtractionLevel(level.upper())
    with ForensicSession(case, Path(output_dir)) as session:
        console.print("\n[bold]Configuration[/bold]")
        console.print(f"  Output Dir: [green]{session.output_dir.absolute()}[/green]")
        console.print(f"  Session ID: [cyan]{session.session_id}[/cyan]")
        console.print(f"  Extraction Level: [yellow]{level.upper()}[/yellow]\n")
        
        extractor.connect(device)
        with Progress(SpinnerColumn(), TextColumn("{task.description}")) as p:
            t = p.add_task("Extracting...", total=None)
            for a in extractor.extract(session, ext_level, profile=extraction_profile):
                artifacts.append(a)
                if api_stream_writer:
                    api_stream_writer.append_artifact(a)
                p.update(t, description=f"Extracted {len(artifacts)} artifacts")
        extractor.disconnect()
        if api_stream_writer:
            api_stream_writer.finalize()
        log = session.close()

    # Step 5: write outputs
    case_dir = Path(output_dir) / case.case_number
    case_dir.mkdir(parents=True, exist_ok=True)

    dfxml = case_dir / "acquisition.dfxml"
    w = DFXMLWriter(dfxml, log)
    for a in artifacts:
        w.append_artifact(a)
    w.finalize()

    ufdr = case_dir / f"{log.session_id}.ufdr"
    UFDRWriter(ufdr, log).build(artifacts)

    html = case_dir / "report.html"
    ReportWriter.generate_html(log, artifacts, html)

    if ufdr_config:
        try:
            from forensixd.integration.ufdr_bridge import UFDRBridge, UFDRBridgeConfig
            UFDRBridge(UFDRBridgeConfig.from_yaml(Path(ufdr_config))).inject_session(log, artifacts)
            console.print("[green]Injected into CopSight AI project.[/green]")
        except FileNotFoundError as e:
            console.print(f"[red]Error:[/red] {e}")
        except ForensixdError as e:
            console.print(f"[yellow]CopSight AI warning:[/yellow] {e}")
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")

    # Summary
    tbl = Table(title="Done")
    tbl.add_column("Output")
    tbl.add_column("Value")
    tbl.add_row("Artifacts", str(len(artifacts)))
    tbl.add_row("DFXML", str(dfxml))
    tbl.add_row("CopSight AI", str(ufdr))
    tbl.add_row("Report", str(html))
    tbl.add_row("Root Hash", (log.root_hash or "")[:24]+"...")
    console.print(tbl)

@main.command()
@click.argument("session_dir", type=click.Path(exists=True))
def verify(session_dir):
    """Verify chain-of-custody hashes for a session."""
    from forensixd.core.logger import AuditLogger
    files = list(Path(session_dir).rglob("*.audit.jsonl"))
    if not files:
        console.print("[red]No audit log found.[/red]")
        sys.exit(1)
    ok_all = True
    for f in files:
        ok = AuditLogger.from_file(f).verify()
        console.print(f"{f.name}: {'[green]PASS[/green]' if ok else '[red]FAIL — TAMPERED[/red]'}")
        if not ok:
            ok_all = False
    sys.exit(0 if ok_all else 1)

@main.command()
@click.argument("html_path", type=click.Path(exists=True))
@click.argument("output_pdf", type=click.Path())
def pdf(html_path, output_pdf):
    """Convert HTML report to PDF."""
    try:
        out = ReportWriter.generate_pdf(Path(html_path), Path(output_pdf))
        console.print(f"[green]PDF:[/green] {out}")
    except ForensixdError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)

def interactive_mode():
    from rich.prompt import Prompt
    try:
        import readline
    except ImportError:
        pass
    console.print(Panel("[bold green]forensixd Interactive Shell[/bold green]", subtitle="Select an operation by entering the corresponding number"))
    while True:
        try:
            console.print("\n[bold cyan]Available Features:[/bold cyan]")
            console.print("  [1] Acquire Forensic Data")
            console.print("  [2] Verify Chain of Custody")
            console.print("  [3] Generate PDF Report")
            console.print("  [4] Exit")
            
            choice = Prompt.ask("\nSelect option", choices=["1", "2", "3", "4"], default="4")
            
            if choice == "4":
                break
            
            args = []
            if choice == "1":
                args = ["acquire"]
                    
            elif choice == "2":
                session_dir = Prompt.ask("Session directory")
                if session_dir.strip():
                    args = ["verify", session_dir.strip()]
            
            elif choice == "3":
                html_path = Prompt.ask("Path to HTML report")
                out_pdf = Prompt.ask("Path for output PDF")
                if html_path.strip() and out_pdf.strip():
                    args = ["pdf", html_path.strip(), out_pdf.strip()]
            
            if not args:
                continue

            try:
                main(args=args, standalone_mode=False)
            except click.ClickException as e:
                e.show()
            except click.exceptions.Exit:
                pass
            except SystemExit as e:
                if e.code != 0 and e.code is not None:
                    console.print(f"[red]Command exited with code {e.code}[/red]")
        except (KeyboardInterrupt, EOFError):
            console.print()
            break
        except Exception as e:
            console.print(f"[red]Error:[/red] {e}")

if __name__ == "__main__":
    import atexit
    def pause_on_exit():
        if getattr(sys, 'frozen', False) and sys.platform == "win32":
            input("\nPress Enter to exit...")
    atexit.register(pause_on_exit)
    main()

__all__ = ["main"]
