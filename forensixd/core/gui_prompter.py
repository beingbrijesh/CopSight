"""
forensixd.core.gui_prompter
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Cross-platform utility for native GUI authentication and elevation prompts.
Provides secure password entry dialogs and Allow/Deny confirmation dialogs
without relying on terminal access.
"""

from __future__ import annotations

import platform
import subprocess
import tkinter as tk
from tkinter import simpledialog, messagebox
import logging

_logger = logging.getLogger(__name__)

__all__ = ["prompt_password", "prompt_allow_deny", "prompt_error_action"]


def _prompt_password_mac(title: str, prompt: str) -> str | None:
    applescript = f'''
    try
        display dialog "{prompt}" with title "{title}" default answer "" with hidden answer buttons {{"Cancel", "OK"}} default button "OK"
        return text returned of result
    on error
        return ""
    end try
    '''
    result = subprocess.run(
        ["osascript", "-e", applescript], capture_output=True, text=True
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None


def _prompt_allow_deny_mac(title: str, prompt: str) -> bool:
    applescript = f'''
    try
        display dialog "{prompt}" with title "{title}" buttons {{"Deny", "Allow"}} default button "Allow" cancel button "Deny"
        return "Allow"
    on error
        return "Deny"
    end try
    '''
    result = subprocess.run(
        ["osascript", "-e", applescript], capture_output=True, text=True
    )
    return "Allow" in result.stdout


def _prompt_password_linux(title: str, prompt: str) -> str | None:
    # Try zenity first
    try:
        result = subprocess.run(
            ["zenity", "--password", "--title", title],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    
    # Try kdialog
    try:
        result = subprocess.run(
            ["kdialog", "--password", prompt, "--title", title],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass

    return _prompt_password_tk(title, prompt)


def _prompt_allow_deny_linux(title: str, prompt: str) -> bool:
    try:
        result = subprocess.run(
            ["zenity", "--question", "--title", title, "--text", prompt, "--ok-label", "Allow", "--cancel-label", "Deny"],
            capture_output=True
        )
        return result.returncode == 0
    except FileNotFoundError:
        pass

    return _prompt_allow_deny_tk(title, prompt)


def _prompt_password_tk(title: str, prompt: str) -> str | None:
    root = tk.Tk()
    root.withdraw()
    # Ensure window appears on top
    root.attributes('-topmost', True)
    pwd = simpledialog.askstring(title, prompt, show='*', parent=root)
    root.destroy()
    return pwd


def _prompt_allow_deny_tk(title: str, prompt: str) -> bool:
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    result = messagebox.askyesno(title, prompt, icon='warning', parent=root)
    root.destroy()
    return result


def prompt_password(title: str, prompt: str) -> str | None:
    """Prompt the user for a password using a native GUI dialog.

    Parameters
    ----------
    title : str
        The dialog window title.
    prompt : str
        The message to display to the user.

    Returns
    -------
    str | None
        The entered password, or None if the user cancelled.
    """
    system = platform.system()
    if system == "Darwin":
        return _prompt_password_mac(title, prompt)
    elif system == "Linux":
        return _prompt_password_linux(title, prompt)
    else:
        # Fallback to tkinter for Windows and others
        return _prompt_password_tk(title, prompt)


def prompt_allow_deny(title: str, prompt: str) -> bool:
    """Prompt the user for an Allow/Deny confirmation using a native GUI dialog.

    Parameters
    ----------
    title : str
        The dialog window title.
    prompt : str
        The message to display to the user.

    Returns
    -------
    bool
        True if the user clicked Allow/Yes, False if they clicked Deny/No/Cancel.
    """
    system = platform.system()
    if system == "Darwin":
        return _prompt_allow_deny_mac(title, prompt)
    elif system == "Linux":
        return _prompt_allow_deny_linux(title, prompt)
    else:
        # Fallback to tkinter for Windows and others
        return _prompt_allow_deny_tk(title, prompt)


def _prompt_error_action_mac(title: str, prompt: str) -> str:
    applescript = f'''
    try
        display dialog "{prompt}" with title "{title}" buttons {{"Abort", "Skip", "Retry"}} default button "Retry" cancel button "Abort"
        return button returned of result
    on error
        return "Abort"
    end try
    '''
    result = subprocess.run(
        ["osascript", "-e", applescript], capture_output=True, text=True
    )
    res = result.stdout.strip()
    if res in ("Abort", "Skip", "Retry"):
        return res
    return "Abort"


def _prompt_error_action_linux(title: str, prompt: str) -> str:
    # Try zenity list
    try:
        result = subprocess.run(
            ["zenity", "--list", "--title", title, "--text", prompt, "--radiolist", "--column", "Select", "--column", "Action", "TRUE", "Retry", "FALSE", "Skip", "FALSE", "Abort"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    return _prompt_error_action_tk(title, prompt)


def _prompt_error_action_tk(title: str, prompt: str) -> str:
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    # askyesnocancel returns True (yes/retry), False (no/skip), None (cancel/abort)
    result = messagebox.askyesnocancel(title, prompt, parent=root)
    root.destroy()
    if result is True:
        return "Retry"
    elif result is False:
        return "Skip"
    return "Abort"


def prompt_error_action(title: str, prompt: str) -> str:
    """Prompt the user for an Abort/Skip/Retry action on error.

    Parameters
    ----------
    title : str
        The dialog window title.
    prompt : str
        The error message to display.

    Returns
    -------
    str
        "Retry", "Skip", or "Abort".
    """
    system = platform.system()
    if system == "Darwin":
        return _prompt_error_action_mac(title, prompt)
    elif system == "Linux":
        return _prompt_error_action_linux(title, prompt)
    else:
        return _prompt_error_action_tk(title, prompt)
