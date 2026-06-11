import webbrowser
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading
import requests
import sys
from rich.console import Console
from rich.prompt import Prompt
from rich.table import Table
from typing import List, Dict, Optional

console = Console()

class AuthHTTPServer(HTTPServer):
    token: Optional[str] = None

class AuthCallbackHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Suppress HTTP logs
        
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        if 'token' in query:
            if hasattr(self.server, 'token'):
                self.server.token = query['token'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<html><head><style>body{font-family:sans-serif;text-align:center;margin-top:50px;}</style></head><body><h1>Authentication Successful!</h1><p>You may now close this window and return to the forensixd CLI.</p></body></html>")
            # Trigger shutdown in a separate thread so it finishes sending the response
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"No token found.")

def authenticate_via_browser(login_url: str = "http://localhost:5173/login") -> str:
    """
    Opens browser for login and runs a local server to catch the JWT token.
    """
    callback_url = "http://localhost:54321"
    server = AuthHTTPServer(('localhost', 54321), AuthCallbackHandler)
    server.token = None

    url_to_open = f"{login_url}?cli_callback={urllib.parse.quote(callback_url)}"
    console.print(f"\n[cyan]Opening browser for authentication...[/cyan]")
    console.print(f"If your browser does not open automatically, visit: [underline]{url_to_open}[/underline]")
    webbrowser.open(url_to_open)

    console.print("[yellow]Waiting for login completion...[/yellow]")
    server.serve_forever()
    
    if server.token:
        console.print("[green]Successfully authenticated.[/green]\n")
        return str(server.token)
    else:
        console.print("[red]Authentication failed. No token received.[/red]")
        sys.exit(1)

def get_assigned_cases(base_url: str, token: str) -> List[Dict]:
    """
    Fetches active cases assigned to the authenticated user.
    """
    # Ensure base_url has no trailing slash and point to api
    base_api = base_url.rstrip('/')
    if not base_api.endswith('/api'):
        base_api = f"{base_api}/api"
        
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"{base_api}/cases", headers=headers)
        response.raise_for_status()
        data = response.json()
        # Handle cases pagination structure
        cases = data.get("data", {}).get("cases", [])
        return cases
    except Exception as e:
        console.print(f"[red]Error fetching cases:[/red] {e}")
        sys.exit(1)

def prompt_case_selection(cases: List[Dict]) -> Optional[Dict]:
    """
    Prompts the user to select an assigned case.
    """
    if not cases:
        console.print("[red]No cases found. Please ensure you are assigned to an active case in the UI.[/red]")
        sys.exit(1)

    table = Table(title="Select a Case for Streaming")
    table.add_column("Option", style="cyan")
    table.add_column("Case Number")
    table.add_column("Title")
    table.add_column("Status")

    for idx, c in enumerate(cases):
        table.add_row(str(idx + 1), c.get('caseNumber', 'Unknown'), c.get('title', 'Unknown'), c.get('status', 'Unknown'))
    
    console.print(table)
    
    choices = [str(i + 1) for i in range(len(cases))]
    choice = Prompt.ask("Enter the number of the case to stream data into", choices=choices)
    
    selected_case = cases[int(choice) - 1]
    console.print(f"[green]Selected Case:[/green] {selected_case.get('caseNumber')} - {selected_case.get('title')}\n")
    return selected_case
