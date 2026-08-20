import sys
from pathlib import Path
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
# Lazy imports to optimize CLI startup time and memory footprint

console = Console()

@click.group(invoke_without_command=True)
@click.pass_context
@click.version_option("2.0.29", prog_name="forensixd CLI by CopsightAI")
def main(ctx):
    """forensixd CLI by CopsightAI — Forensic Data Extraction for Law Enforcement."""
    if ctx.invoked_subcommand is None:
        import os
        if sys.stdout.isatty():
            if os.name == 'nt':
                os.system('cls')
            else:
                print("\033[3J\033[2J\033[H", end="")
                sys.stdout.flush()
        else:
            console.clear()
        if console.width >= 65:
            console.print("[cyan]   _____            _____ _       _     _   [/cyan]")
            console.print("[cyan]  / ____|          / ____(_)     | |   | |  [/cyan]")
            console.print("[cyan] | |     ___  _ __| (___  _  __ _| |__ | |_ [/cyan]")
            console.print("[cyan] | |    / _ \\| '_ \\\\___ \\| |/ _` | '_ \\| __|[/cyan]")
            console.print("[cyan] | |___| (_) | |_) |____) | | (_| | | | | |_ [/cyan]")
            console.print("[cyan]  \\_____\\___/| .__/|_____/|_|\\__, |_| |_|\\__|[/cyan]")
            console.print("[cyan]             | |              __/ |         [/cyan]")
            console.print("[cyan]             |_|             |___/          [/cyan]\n")
            console.print("[cyan][bold]forensixd CLI[/bold] by [bold]CopsightAI[/bold] — Forensic Data Extraction Terminal[/cyan]\n")
        else:
            console.print("[cyan][bold]forensixd CLI[/bold] by CopsightAI — Forensic Data Extraction[/cyan]\n")
        interactive_mode()

@main.command()
@click.option("--output-dir","-o", required=False, type=click.Path())
@click.option("--level","-l", type=click.Choice(["logical","file_system","physical"]), default=None)
@click.option("--ufdr-config", type=click.Path(), default=None)
@click.option("--profile", type=click.Choice(["textual", "media", "all", "deleted"]), default=None)
def acquire(output_dir, level, ufdr_config, profile):
    """Run a full forensic acquisition."""
    console.print(Panel("[bold]CopSight Acquisition[/bold]", subtitle="Law Enforcement Only"))

    from forensixd.core.device_detector import USB_AVAILABLE, DeviceDetector
    from forensixd.core.session import ForensicSession
    from forensixd.core.models import ExtractionLevel
    from forensixd.core.exceptions import ForensixdError, AuthorizationError
    from forensixd.extractors.base import ExtractorRegistry
    from forensixd.legal.authorization import AuthorizationManager
    from forensixd.writers.dfxml_writer import DFXMLWriter
    from forensixd.writers.ufdr_writer import UFDRWriter
    from forensixd.writers.report_writer import ReportWriter
    
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
        
        # Removed the print statement that exposed the backend server location to the user
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
        
        # Generate deterministic integer ID from device.device_id
        import hashlib
        internal_device_id = int(hashlib.md5(device.device_id.encode()).hexdigest()[:7], 16)
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
        
    if not profile:
        profile_input = Prompt.ask(
            "[bold]Extraction Profile[/bold]\n"
            "  [1] Textual Only (SMS, Calls, Contacts, Backups)\n"
            "  [2] Media Only (Images, Videos, PDFs)\n"
            "  [3] Everything (Active Data)\n"
            "  [4] Deleted Recovery & Carving (Deleted Chats, SMS, Freelist DBs, Carved Media)\n"
            "Select an option", 
            choices=["1", "2", "3", "4"], 
            default="1"
        )
        profile_map = {"1": "textual", "2": "media", "3": "all", "4": "deleted"}
        extraction_profile = profile_map[profile_input]
    else:
        extraction_profile = profile

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
    from forensixd.core.exceptions import ForensixdError
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
    from forensixd.writers.report_writer import ReportWriter
    from forensixd.core.exceptions import ForensixdError
    try:
        out = ReportWriter.generate_pdf(Path(html_path), Path(output_pdf))
        console.print(f"[green]PDF:[/green] {out}")
    except ForensixdError as e:
        console.print(f"[red]{e}[/red]")
        sys.exit(1)

@main.command("import-image")
@click.argument("image_path", type=click.Path(exists=True))
@click.option("--output-dir", "-o", required=False, type=click.Path())
@click.option("--level", "-l", type=click.Choice(["logical", "file_system", "physical"]), default="file_system")
@click.option("--ufdr-config", type=click.Path(), default=None)
def import_image(image_path, output_dir, level, ufdr_config):
    """Import and analyze a raw partition dump (.dd, .bin, .E01)."""
    console.print(Panel("[bold]CopSight Import Raw Image[/bold]", subtitle="Analysis & Reporting Backend"))
    
    from forensixd.core.models import DeviceInfo, Platform, ExtractionLevel
    from forensixd.core.session import ForensicSession
    from forensixd.core.exceptions import ForensixdError, AuthorizationError
    from forensixd.extractors.base import ExtractorRegistry
    from forensixd.writers.dfxml_writer import DFXMLWriter
    from forensixd.writers.ufdr_writer import UFDRWriter
    from forensixd.writers.report_writer import ReportWriter

    device = DeviceInfo(platform=Platform.DISK_IMAGE, device_id=image_path)
    
    # Optional stream auth (same as acquire)
    from forensixd.constants import STREAM_URL, LOGIN_URL
    stream_url = "http://localhost:8000" if STREAM_URL == "INJECTED_STREAM_URL" else STREAM_URL
    login_url = "http://localhost:5173/login" if LOGIN_URL == "INJECTED_LOGIN_URL" else LOGIN_URL

    api_stream_writer = None
    selected_case = None
    
    try:
        from forensixd.core.auth_manager import authenticate_via_browser, get_assigned_cases, prompt_case_selection
        from forensixd.writers.api_stream_writer import ApiStreamWriter
        
        token, session_encryption_key = authenticate_via_browser(login_url=login_url)
        cases = get_assigned_cases(stream_url, token)
        selected_case = prompt_case_selection(cases)
        if selected_case:
            case_id = selected_case.get("id")
            import hashlib
            internal_device_id = int(hashlib.md5(device.device_id.encode()).hexdigest()[:7], 16)
            api_stream_writer = ApiStreamWriter(stream_url, token, session_encryption_key, int(case_id), internal_device_id)
    except Exception as e:
        console.print(f"[yellow]Skipping CopSight AI streaming (auth failed or skipped).[/yellow]")

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
                notes=selected_case.get("title", "Imported image")
            )
        else:
            from forensixd.legal.authorization import AuthorizationManager
            case = AuthorizationManager.capture_interactively(device)
    except (AuthorizationError, ForensixdError) as e:
        console.print(f"[red]Authorization failed:[/red] {e}")
        sys.exit(1)

    from rich.prompt import Prompt
    if not output_dir:
        output_dir = Prompt.ask("\n[bold]Output directory[/bold]", default="./cases")

    try:
        extractor_cls = ExtractorRegistry.get(device.platform)
    except ForensixdError as e:
        console.print(f"[red]No extractor:[/red] {e}")
        sys.exit(1)
    
    extractor = extractor_cls()
    if not extractor.is_available():
        console.print("[red]pytsk3 is not installed. Cannot read disk images.[/red]")
        sys.exit(1)

    artifacts = []
    ext_level = ExtractionLevel(level.upper())
    
    with ForensicSession(case, Path(output_dir)) as session:
        console.print("\n[bold]Configuration[/bold]")
        console.print(f"  Target Image: [cyan]{image_path}[/cyan]")
        console.print(f"  Output Dir: [green]{session.output_dir.absolute()}[/green]")
        
        extractor.connect(device)
        with Progress(SpinnerColumn(), TextColumn("{task.description}")) as p:
            t = p.add_task("Extracting and Carving...", total=None)
            for a in extractor.extract(session, ext_level, profile="deleted"):
                artifacts.append(a)
                if api_stream_writer:
                    api_stream_writer.append_artifact(a)
                p.update(t, description=f"Analyzed {len(artifacts)} files/carved records")
        extractor.disconnect()
        if api_stream_writer:
            api_stream_writer.finalize()
        log = session.close()

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

    tbl = Table(title="Done")
    tbl.add_column("Output")
    tbl.add_column("Value")
    tbl.add_row("Artifacts", str(len(artifacts)))
    tbl.add_row("DFXML", str(dfxml))
    tbl.add_row("CopSight AI", str(ufdr))
    tbl.add_row("Report", str(html))
    console.print(tbl)


@main.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.option("--output-dir", "-o", required=False, type=click.Path(), default="./recovered_output")
def carve(input_path, output_dir):
    """Carve deleted files (playable media, documents, chat/SMS databases)."""
    from forensixd.recovery.file_carver import FileSignatureCarver
    from forensixd.recovery.sqlite_carver import SQLiteFreelistCarver
    from forensixd.recovery.thumbnail_carver import ThumbnailCacheCarver

    out_p = Path(output_dir)
    out_p.mkdir(parents=True, exist_ok=True)
    in_p = Path(input_path)

    console.print(Panel(f"[bold green]CopSight Carving & Deleted Recovery[/bold green]\nTarget: [cyan]{in_p}[/cyan]\nDestination: [yellow]{out_p}[/yellow]"))

    with Progress(SpinnerColumn(), TextColumn("{task.description}")) as p:
        t = p.add_task("Scanning and carving artifacts...", total=None)
        
        # 1. Signature Carving
        file_carver = FileSignatureCarver()
        carved_files = file_carver.carve_file_or_stream(in_p, out_p / "carved_media")
        
        # 2. SQLite Freelist Carving
        sqlite_carver = SQLiteFreelistCarver()
        if in_p.is_file():
            recovered_records = sqlite_carver.carve_database(in_p, out_p / "databases")
        else:
            recovered_records = sqlite_carver.carve_all_databases_in_dir(in_p, out_p / "databases")

        # 3. Thumbnail Caches
        thumb_carver = ThumbnailCacheCarver()
        thumb_files = thumb_carver.carve_thumbnail_directory(in_p, out_p / "thumbnails")
        
        p.remove_task(t)

    tbl = Table(title="Carving Summary")
    tbl.add_column("Category", style="cyan")
    tbl.add_column("Count", style="green")
    tbl.add_column("Output Location", style="yellow")
    tbl.add_row("Playable Media & Docs", str(len(carved_files)), str(out_p / "carved_media"))
    tbl.add_row("Deleted DB Records (Chats/Calls)", str(len(recovered_records)), str(out_p / "databases"))
    tbl.add_row("Thumbnail Previews", str(len(thumb_files)), str(out_p / "thumbnails"))
    console.print(tbl)
    console.print(f"[bold green]Carving complete! Files saved to {out_p}[/bold green]")

def interactive_mode():
    from rich.prompt import Prompt
    try:
        import readline
    except ImportError:
        pass
    subtitle = "Select an operation" if console.width < 80 else "Select an operation by entering the corresponding number"
    console.print(Panel("[bold green]CopSight Interactive Shell[/bold green]", subtitle=subtitle))
    while True:
        try:
            console.print("\n[bold cyan]Available Features:[/bold cyan]")
            console.print("  [1] Acquire Forensic Data")
            console.print("  [2] Recover Deleted Files & Carve Artifacts")
            console.print("  [3] Verify Chain of Custody")
            console.print("  [4] Generate PDF Report")
            console.print("  [5] Import & Analyze Raw Partition Dump")
            console.print("  [6] Exit")
            
            choice = Prompt.ask("\nSelect option", choices=["1", "2", "3", "4", "5", "6"], default="6")
            
            if choice == "6":
                break
            
            args = []
            if choice == "1":
                args = ["acquire"]
                    
            elif choice == "2":
                source = Prompt.ask("Recover from [1] Connected Device or [2] Local File/Image?", choices=["1", "2"], default="1")
                if source == "1":
                    args = ["acquire", "--profile", "deleted"]
                else:
                    target_path = Prompt.ask("Path to image, database, or directory to carve")
                    out_dir = Prompt.ask("Output directory for carved files", default="./recovered_output")
                    if target_path.strip():
                        args = ["carve", target_path.strip(), "-o", out_dir.strip()]

            elif choice == "3":
                session_dir = Prompt.ask("Session directory")
                if session_dir.strip():
                    args = ["verify", session_dir.strip()]
            
            elif choice == "4":
                html_path = Prompt.ask("Path to HTML report")
                out_pdf = Prompt.ask("Path for output PDF")
                if html_path.strip() and out_pdf.strip():
                    args = ["pdf", html_path.strip(), out_pdf.strip()]
            
            elif choice == "5":
                image_path = Prompt.ask("Path to raw partition dump (.dd, .bin, .E01)")
                out_dir = Prompt.ask("Output directory", default="./cases")
                if image_path.strip():
                    args = ["import-image", image_path.strip(), "-o", out_dir.strip()]
            
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
            err_msg = str(e).strip() or f"{type(e).__name__}"
            console.print(f"[red]Error:[/red] {err_msg}")

if __name__ == "__main__":
    import atexit
    def pause_on_exit():
        if getattr(sys, 'frozen', False) and sys.platform == "win32":
            input("\nPress Enter to exit...")
    atexit.register(pause_on_exit)
    main()

__all__ = ["main"]
