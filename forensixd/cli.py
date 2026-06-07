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

@click.group()
@click.version_option("0.1.0", prog_name="forensixd")
def main():
    """forensixd — Forensic Data Extraction for Law Enforcement."""

@main.command()
@click.option("--output-dir","-o", required=True, type=click.Path())
@click.option("--level","-l", type=click.Choice(["logical","file_system","physical"]), default="logical")
@click.option("--ufdr-config", type=click.Path(), default=None)
def acquire(output_dir, level, ufdr_config):
    """Run a full forensic acquisition."""
    console.print(Panel("[bold]forensixd Acquisition[/bold]", subtitle="Law Enforcement Only"))

    # Step 1: detect device
    detector = DeviceDetector()
    with Progress(SpinnerColumn(), TextColumn("{task.description}"), transient=True) as p:
        t = p.add_task("Scanning for devices...", total=None)
        devices = detector.scan()
        p.remove_task(t)
    if not devices:
        console.print("[red]No devices found.[/red]")
        sys.exit(1)
    device = devices[0]
    console.print(f"[green]Found:[/green] {device.platform.value} — {device.device_id}")

    # Step 2: authorization
    try:
        case = AuthorizationManager.capture_interactively(device)
    except (AuthorizationError, ForensixdError) as e:
        console.print(f"[red]Authorization failed:[/red] {e}")
        sys.exit(1)

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
    ext_level = ExtractionLevel(level)
    with ForensicSession(case, Path(output_dir)) as session:
        extractor.connect(device)
        with Progress(SpinnerColumn(), TextColumn("{task.description}")) as p:
            t = p.add_task("Extracting...", total=None)
            for a in extractor.extract(session, ext_level):
                artifacts.append(a)
                p.update(t, description=f"Extracted {len(artifacts)} artifacts")
        extractor.disconnect()
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
            console.print("[green]Injected into UFDR project.[/green]")
        except ForensixdError as e:
            console.print(f"[yellow]UFDR warning:[/yellow] {e}")

    # Summary
    tbl = Table(title="Done")
    tbl.add_column("Output")
    tbl.add_column("Value")
    tbl.add_row("Artifacts", str(len(artifacts)))
    tbl.add_row("DFXML", str(dfxml))
    tbl.add_row("UFDR", str(ufdr))
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

if __name__ == "__main__":
    main()

__all__ = ["main"]
