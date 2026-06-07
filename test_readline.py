import readline
from rich.console import Console

c = Console()
while True:
    cmd = c.input("> ")
    if cmd == "exit": break
    print(f"You typed: {cmd}")
