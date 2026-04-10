"""
PyTorch architecture definitions for pretrained anomaly detection models.

These architectures mirror the training-time definitions so that
the saved state_dict weights can be loaded for inference.
"""

import torch
import torch.nn as nn


class UniversalDNN(nn.Module):
    """
    Residual Deep Neural Network for binary anomaly detection.

    Architecture (reconstructed from state_dict inspection):
        - Embedding layer: 6 categories → 16-dim vectors
        - Stem block:  Linear(45→256) → BN → ReLU → Dropout
        - Residual block: Linear(256→256) → BN → ReLU → Dropout → Linear(256→256)
        - Head: Dropout → Linear(256→128) → BN → ReLU → Dropout → Linear(128→64) → ReLU → Linear(64→1)

    Input:  (batch, 23) continuous features  +  (batch,) integer category index
    Output: (batch, 1) anomaly logit (pass through sigmoid for probability)
    """

    def __init__(self):
        super().__init__()

        # Categorical embedding (e.g. domain / protocol_type, 6 classes → 16-d)
        self.emb = nn.Embedding(6, 16)

        # 23 continuous + 6 one-hot-like from embedding (but concat is 23+16+6pad → 45 from scaler mapping)
        # Actually stem expects 45 inputs: 23 scaled continuous + 16 embedding + 6 spare flags
        # The exact split depends on training code; we keep the linear input=45 to match weights.
        self.stem = nn.Sequential(
            nn.Linear(45, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.3),
        )

        self.res1 = nn.Sequential(
            nn.Linear(256, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 256),
        )

        self.head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(self, x_cont: torch.Tensor, x_cat: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x_cont: (batch, 23) scaled continuous features
            x_cat:  (batch,)    integer category indices  [0..5]
        Returns:
            (batch, 1) anomaly logit
        """
        emb = self.emb(x_cat)                       # (batch, 16)
        # Pad to reach 45 = 23 + 16 + 6 spare flags (zeros)
        pad = torch.zeros(x_cont.size(0), 6, device=x_cont.device)
        x = torch.cat([x_cont, emb, pad], dim=1)    # (batch, 45)

        out = self.stem(x)                           # (batch, 256)
        residual = out
        out = self.res1(out) + residual              # skip connection
        out = self.head(out)                         # (batch, 1)
        return out


class LSTMAutoencoder(nn.Module):
    """
    LSTM-based autoencoder for sequence anomaly detection via reconstruction error.

    Architecture (reconstructed from state_dict inspection):
        Encoder: LSTM(18→64) → LSTM(64→32) → BN(32)
        Decoder: LSTM(32→64) → LSTM(64→18)

    Input:  (batch, seq_len, 18)
    Output: (batch, seq_len, 18)  reconstructed sequence
    """

    def __init__(self):
        super().__init__()

        # Encoder
        self.enc1 = nn.LSTM(input_size=18, hidden_size=64, batch_first=True)
        self.enc2 = nn.LSTM(input_size=64, hidden_size=32, batch_first=True)

        # Bottleneck normalisation
        self.bn = nn.BatchNorm1d(32)

        # Decoder
        self.dec1 = nn.LSTM(input_size=32, hidden_size=64, batch_first=True)
        self.dec2 = nn.LSTM(input_size=64, hidden_size=18, batch_first=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, seq_len, 18)
        Returns:
            reconstructed: (batch, seq_len, 18)
        """
        seq_len = x.size(1)

        # Encode
        enc1_out, _ = self.enc1(x)          # (batch, seq_len, 64)
        enc2_out, _ = self.enc2(enc1_out)   # (batch, seq_len, 32)

        # Bottleneck: apply BN on last timestep's hidden state
        # BN expects (batch, features), so transpose
        bottleneck = enc2_out[:, -1, :]      # (batch, 32)
        bottleneck = self.bn(bottleneck)     # (batch, 32)

        # Repeat bottleneck across time for decoder input
        dec_input = bottleneck.unsqueeze(1).repeat(1, seq_len, 1)  # (batch, seq_len, 32)

        # Decode
        dec1_out, _ = self.dec1(dec_input)   # (batch, seq_len, 64)
        dec2_out, _ = self.dec2(dec1_out)    # (batch, seq_len, 18)

        return dec2_out
