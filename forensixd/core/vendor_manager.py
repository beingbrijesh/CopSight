import os
import sys
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Tuple

_logger = logging.getLogger(__name__)

class VendorManager:
    """
    Manages the lifecycle (installation, verification, execution) of 3rd-party
    physical exploit tools (mtkclient, edl) within the UFDR ecosystem.
    """

    VENDOR_DIR = Path(__file__).parent.parent.parent / "vendor"

    @classmethod
    def _ensure_vendor_dir(cls) -> Path:
        cls.VENDOR_DIR.mkdir(parents=True, exist_ok=True)
        return cls.VENDOR_DIR

    @classmethod
    def setup_mtkclient(cls) -> Dict[str, Any]:
        """
        Clones bkerler/mtkclient, installs brew dependencies (libusb),
        and sets up a python virtual environment for it.
        """
        vendor_dir = cls._ensure_vendor_dir()
        mtk_dir = vendor_dir / "mtkclient"
        venv_dir = mtk_dir / ".venv"
        mtk_bin = venv_dir / "bin" / "mtk"

        if mtk_bin.exists():
            return {"success": True, "message": "mtkclient is already installed and ready.", "path": str(mtk_dir)}

        try:
            _logger.info("Setting up mtkclient...")
            
            # 1. Install system dependencies (macOS)
            if sys.platform == "darwin":
                _logger.info("Ensuring libusb is installed via Homebrew...")
                res_brew = subprocess.run(["brew", "list", "libusb"], capture_output=True, text=True)
                if res_brew.returncode != 0:
                    subprocess.run(["brew", "install", "libusb"], check=True)

            # 2. Clone the repository
            if not mtk_dir.exists():
                _logger.info("Cloning bkerler/mtkclient repository...")
                subprocess.run(["git", "clone", "https://github.com/bkerler/mtkclient.git", str(mtk_dir)], check=True)

            # 3. Create virtual environment
            if not venv_dir.exists():
                _logger.info("Creating isolated Python virtual environment...")
                subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)

            # 4. Install requirements
            pip_bin = venv_dir / "bin" / "pip"
            req_file = mtk_dir / "requirements.txt"
            _logger.info("Installing mtkclient python dependencies...")
            subprocess.run([str(pip_bin), "install", "-r", str(req_file)], check=True)

            # 5. Install the package itself to create the `mtk` binary
            subprocess.run([str(pip_bin), "install", "-e", "."], cwd=str(mtk_dir), check=True)

            if mtk_bin.exists():
                return {"success": True, "message": "Successfully installed mtkclient.", "path": str(mtk_dir)}
            else:
                return {"success": False, "error": "Installation completed but 'mtk' binary not found in venv."}

        except subprocess.CalledProcessError as e:
            _logger.error(f"Vendor setup failed during command execution: {e}")
            return {"success": False, "error": f"Command failed: {e.cmd}"}
        except Exception as e:
            _logger.error(f"Unexpected error during vendor setup: {e}")
            return {"success": False, "error": str(e)}

    @classmethod
    def execute_mtk_dump(cls, output_dir: Path, log_file: Path) -> subprocess.Popen:
        """
        Launches the mtkclient physical dump command (userdata).
        Returns the Popen process so the server can track it while it runs.
        """
        python_bin = cls.VENDOR_DIR / "mtkclient" / ".venv" / "bin" / "python3"
        mtk_script = cls.VENDOR_DIR / "mtkclient" / "mtk.py"
        
        # We target userdata specifically for FBE extraction.
        # It's recommended to pull userdata and metadata for decryption.
        out_userdata = output_dir.resolve() / "userdata.img"
        out_metadata = output_dir.resolve() / "metadata.img"
        
        cmd = [
            str(python_bin), str(mtk_script), "r", 
            "userdata,metadata", 
            f"{out_userdata},{out_metadata}"
        ]
        
        _logger.info(f"Starting MTK dump: {' '.join(cmd)}")
        
        # Open log file to pipe output directly to it
        log_fh = open(log_file, "w")
        
        # Start process asynchronously
        process = subprocess.Popen(
            cmd,
            stdout=log_fh,
            stderr=subprocess.STDOUT,  # Combine stderr into stdout log
            cwd=str(cls.VENDOR_DIR / "mtkclient")
        )
        
        # We also need to store the process reference or just return it to the caller
        return process
