"""
Unified loader for the pretrained anomaly detection model suite.

Handles loading of:
  - XGBoost attack classifier  (.pkl)
  - Universal DNN              (.pt  state_dict)
  - LSTM Autoencoder            (.pt  state_dict)
  - All associated scalers, encoders, and thresholds
"""

import os
import logging
import warnings
from typing import Dict, Any, Optional

import numpy as np
import torch
import joblib

from .advanced_models import UniversalDNN, LSTMAutoencoder

logger = logging.getLogger(__name__)

# Silence sklearn version-mismatch warnings from pickled objects
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Resolve the model directory relative to this file
_BASE_DIR = os.path.join(os.path.dirname(__file__), "Anamoly Detection Model")


class ModelBundle:
    """Container holding all loaded model artefacts."""

    def __init__(self):
        # ── PyTorch models ───────────────────────────────
        self.dnn_model: Optional[UniversalDNN] = None
        self.lstm_model: Optional[LSTMAutoencoder] = None

        # ── XGBoost ──────────────────────────────────────
        self.xgb_model = None

        # ── Scalers (RobustScaler) ───────────────────────
        self.dnn_scaler = None       # expects 23 features
        self.lstm_scaler = None      # expects 18 features
        self.xgb_scaler = None       # expects 41 features

        # ── Label / category encoders ────────────────────
        self.attack_label_encoder = None   # DoS / Normal / Probe / R2L / U2R
        self.attack_type_encoder = None    # 20 fine-grained attack types
        self.domain_encoder = None         # cloud_os, cyber_crime, …
        self.kdd_cat_encoders: Dict[str, Any] = {}  # protocol_type, service, flag

        # ── Thresholds ───────────────────────────────────
        self.lstm_ae_threshold: float = 3059.4263    # default from .npy
        self.inference_thresholds: Dict[str, float] = {}

        # ── Status ───────────────────────────────────────
        self.is_loaded: bool = False
        self.load_errors: list = []


def load_all_models(base_dir: str = _BASE_DIR) -> ModelBundle:
    """
    Load every artefact from the model directory and return a ``ModelBundle``.

    This is intentionally **fail-soft**: if one component fails to load the
    rest will still be available and the error is logged.
    """
    bundle = ModelBundle()

    # ── 1. Universal DNN ──────────────────────────────────────────────
    try:
        dnn_path = os.path.join(base_dir, "universal_dnn_best.pt")
        state = torch.load(dnn_path, map_location="cpu")
        model = UniversalDNN()
        model.load_state_dict(state)
        model.eval()
        bundle.dnn_model = model
        logger.info("Universal DNN loaded successfully")
    except Exception as e:
        bundle.load_errors.append(f"DNN: {e}")
        logger.error(f"Failed to load Universal DNN: {e}")

    # ── 2. LSTM Autoencoder ───────────────────────────────────────────
    try:
        lstm_path = os.path.join(base_dir, "lstm_autoencoder.pt")
        state = torch.load(lstm_path, map_location="cpu")
        model = LSTMAutoencoder()
        model.load_state_dict(state)
        model.eval()
        bundle.lstm_model = model
        logger.info("LSTM Autoencoder loaded successfully")
    except Exception as e:
        bundle.load_errors.append(f"LSTM-AE: {e}")
        logger.error(f"Failed to load LSTM Autoencoder: {e}")

    # ── 3. XGBoost attack classifier ──────────────────────────────────
    try:
        xgb_path = os.path.join(base_dir, "xgboost_attack_classifier.pkl")
        bundle.xgb_model = joblib.load(xgb_path)
        logger.info("XGBoost classifier loaded successfully")
    except Exception as e:
        bundle.load_errors.append(f"XGBoost: {e}")
        logger.error(f"Failed to load XGBoost classifier: {e}")

    # ── 4. Scalers ────────────────────────────────────────────────────
    for name, attr, n_feat in [
        ("dnn_scaler.pkl", "dnn_scaler", 23),
        ("lstm_ae_scaler.pkl", "lstm_scaler", 18),
        ("xgb_scaler.pkl", "xgb_scaler", 41),
    ]:
        try:
            path = os.path.join(base_dir, name)
            scaler = joblib.load(path)
            setattr(bundle, attr, scaler)
            logger.info(f"Scaler '{name}' loaded  (expects {n_feat} features)")
        except Exception as e:
            bundle.load_errors.append(f"{name}: {e}")
            logger.error(f"Failed to load scaler {name}: {e}")

    # ── 5. Encoders ───────────────────────────────────────────────────
    for name, attr in [
        ("attack_label_encoder.pkl", "attack_label_encoder"),
        ("attack_type_encoder.pkl", "attack_type_encoder"),
        ("domain_encoder.pkl", "domain_encoder"),
    ]:
        try:
            path = os.path.join(base_dir, name)
            setattr(bundle, attr, joblib.load(path))
            logger.info(f"Encoder '{name}' loaded")
        except Exception as e:
            bundle.load_errors.append(f"{name}: {e}")
            logger.error(f"Failed to load encoder {name}: {e}")

    try:
        path = os.path.join(base_dir, "kdd_cat_encoders.pkl")
        bundle.kdd_cat_encoders = joblib.load(path)
        logger.info("KDD categorical encoders loaded")
    except Exception as e:
        bundle.load_errors.append(f"kdd_cat_encoders: {e}")
        logger.error(f"Failed to load KDD cat encoders: {e}")

    # ── 6. Thresholds ─────────────────────────────────────────────────
    try:
        path = os.path.join(base_dir, "lstm_ae_threshold.npy")
        bundle.lstm_ae_threshold = float(np.load(path)[0])
        logger.info(f"LSTM AE threshold loaded: {bundle.lstm_ae_threshold}")
    except Exception as e:
        bundle.load_errors.append(f"lstm_ae_threshold: {e}")
        logger.warning(f"Using default LSTM AE threshold: {e}")

    try:
        import json
        path = os.path.join(base_dir, "inference_thresholds.json")
        with open(path, "r") as f:
            bundle.inference_thresholds = json.load(f)
        logger.info(f"Inference thresholds loaded: {bundle.inference_thresholds}")
    except Exception as e:
        bundle.load_errors.append(f"inference_thresholds: {e}")
        logger.warning(f"Using empty inference thresholds: {e}")

    # ── Done ──────────────────────────────────────────────────────────
    bundle.is_loaded = True
    if bundle.load_errors:
        logger.warning(f"Model bundle loaded with {len(bundle.load_errors)} error(s)")
    else:
        logger.info("All model artefacts loaded successfully")

    return bundle
