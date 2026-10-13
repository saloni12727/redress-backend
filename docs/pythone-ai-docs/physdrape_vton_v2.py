"""
PhysDrape-VTON v2 — Virtual Try-On con fisica dei tessuti differenziabile.

Innovazioni rispetto a SOTA (CatVTON, IDM-VTON, GS-VTON) e alla v1:
  1. MaterialNet        — stima delle proprietà del tessuto (rigidezza, elasticità,
                          drappeggio) dalla foto flat-lay del capo
  2. EnergyNet          — energie discrete differenziabili (stretch / bending /
                          gravity) sulla griglia deformata dal warp field
  3. Rectified Flow     — v-prediction, 8 step (2-4 con distillazione),
                          5-13x più veloce di DDPM-50
  4. min-SNR-gamma      — ri-pesatura dei timestep adattata al flow matching
  5. Logo-Anchor        — ancoraggio spaziale delle texture (MSE + InfoNCE)
                          nei punti deformati dal warp
  6. UncertaintyHead    — incertezza eteroscedastica per-pixel (NLL in training,
                          UX di confidenza al sampling)
  7. AdaptiveLossWeights— pesi delle loss appresi (Kendall et al.), zero tuning manuale
  8. KV-cache multi-view— coerenza 360° economica durante il sampling

Il file è self-contained: torch + diffusers (solo per il backbone). Tutti i moduli
sono zero-init / warm-start, quindi allo step 0 il modello replica la base
SD-inpainting e il training parte da un punto stabile.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

__version__ = "2.0.0"


# --------------------------------------------------------------------------- #
#  Config                                                                      #
# --------------------------------------------------------------------------- #
@dataclass
class PhysDrapeConfig:
    unet_id: str = "stable-diffusion-v1-5/stable-diffusion-inpainting"
    vae_scale: float = 0.18215
    body_ch: int = 25            # canali pose scaffold (OpenPose/DWPose)
    warp_ch: int = 4             # canali del warp field (spostamento + confidenza)
    token_ch: int = 256          # dim ramo semantico DualScale
    n_flow_steps: int = 8        # step di sampling Rectified Flow
    min_snr_gamma: float = 5.0   # gamma del ri-pesaggio min-SNR
    pixel_loss_prob: float = 0.25  # probabilità di decodificare per le loss a pixel
    warp_scale: float = 0.25     # scala delle energie drape
    nce_weight: float = 0.1      # peso InfoNCE nel Logo-Anchor
    nce_k: int = 64              # punti-ancora campionati per immagine
    dwt_levels: int = 3          # livelli wavelet Haar
    hf_gain: float = 3.0         # guadagno sotto-bande alte (convenzione v1)
    ema_decay: float = 0.999
    energy_sample: int = 16      # risoluzione griglia EnergyNet
    penetration_eps: float = 0.02  # margine non-penetrazione (depth)
    warp_flow_max: float = 0.25   # spostamento max flow (coord normalizzate)


# --------------------------------------------------------------------------- #
#  Blocchi base                                                                #
# --------------------------------------------------------------------------- #
class ConvBlock(nn.Module):
    """Conv2d + GroupNorm + SiLU."""

    def __init__(self, cin: int, cout: int, kernel: int = 3, stride: int = 1, pad: int = 1):
        super().__init__()
        groups = max(1, min(8, cout // 4))
        self.net = nn.Sequential(
            nn.Conv2d(cin, cout, kernel, stride, pad, bias=False),
            nn.GroupNorm(groups, cout),
            nn.SiLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class DualScaleEncoder(nn.Module):
    """Codificatore del capo a doppia scala:
    - ramo semantico  -> token (16x16) iniettati negli adattatori UNet
    - ramo texture    -> feature spaziali per Logo-Anchor / identity
    """

    def __init__(self, token_ch: int = 256):
        super().__init__()
        self.sem = nn.Sequential(
            ConvBlock(3, 64, stride=2),
            ConvBlock(64, 128, stride=2),
            ConvBlock(128, token_ch, stride=2),
            nn.AdaptiveAvgPool2d((16, 16)),
        )
        self.tex = nn.Sequential(
            ConvBlock(3, 64, stride=2),
            ConvBlock(64, 128, stride=2),
        )

    def forward(self, garment_img: torch.Tensor):
        return self.sem(garment_img), self.tex(garment_img)


class MaterialNet(nn.Module):
    """Innovazione 1 — stima delle proprietà fisiche del tessuto dalla flat-lay.

    Output in [0,1]: k_s (rigidezza), elast (elasticità), drape (coefficiente di drappeggio).
    Supervisibile con rendering CLO3D/Style3D o misure ISO 9073-9; altrimenti self-supervised.
    """

    def __init__(self, dim: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            ConvBlock(3, dim),
            ConvBlock(dim, dim * 2),
            ConvBlock(dim * 2, dim * 4),
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
        )
        self.heads = nn.ModuleList([nn.Linear(dim * 4, 1) for _ in range(3)])

    def forward(self, garment_img: torch.Tensor) -> Dict[str, torch.Tensor]:
        f = self.net(garment_img)
        return {
            "k_s": torch.sigmoid(self.heads[0](f)),
            "elast": torch.sigmoid(self.heads[1](f)),
            "drape": torch.sigmoid(self.heads[2](f)),
        }


class DrapeWarpV2(nn.Module):
    """Innovazione 1 (lato warp) — campo di deformazione material-aware.

    Input : [garment_mask(1), body_pose(25)] a risoluzione latente
    Output: spostamento in [-0.5, +0.5] modulato dalle proprietà stimate:
      - drape alto     -> spostamenti maggiori (flusso di pendolo)
      - rigidezza alta -> spostamenti ridotti (tessuto rigido resiste)
    """

    def __init__(self, body_ch: int = 25, out_ch: int = 4):
        super().__init__()
        self.net = nn.Sequential(
            ConvBlock(body_ch + 1, 32),
            ConvBlock(32, 64, stride=2),
            ConvBlock(64, 64),
            nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False),
            ConvBlock(64, out_ch),
            nn.Tanh(),
        )

    def forward(self, cond: torch.Tensor, material: Dict[str, torch.Tensor]) -> torch.Tensor:
        warp = self.net(cond) * 0.5
        drape = material["drape"].view(-1, 1, 1, 1)
        stiff = material["k_s"].view(-1, 1, 1, 1)
        scale = (0.6 + 0.8 * drape) * (1.0 - 0.5 * stiff)
        return warp * scale


class EnergyNet(nn.Module):
    """Innovazione 2 — energie di shell discreta differenziabili sulla griglia deformata.

      E_stretch : termine ||J - I||^2 con differenze finite (mappe affini -> ~0)
      E_bend    : laplaciano discreto al quadrato (affine -> 0, pieghe -> alto)
      E_gravity : penalità se il warp SOLLEVA il bordo inferiore del capo oltre la sua
                  posizione di riposo (anti-fisica: "indossare sollevando il tessuto")

    Tutti i termini sono differenziabili e backpropagano nei parametri di DrapeWarp.
    """

    def __init__(self, sample: int = 16):
        super().__init__()
        self.sample = sample
        g = torch.linspace(0.0, 1.0, sample)
        yy, xx = torch.meshgrid(g, g, indexing="ij")
        self.register_buffer("pts", torch.stack([xx, yy], dim=-1).float())

    def _sample_field(self, field: torch.Tensor) -> torch.Tensor:
        B = field.shape[0]
        norm = (self.pts * 2.0 - 1.0).view(1, 1, -1, 2).expand(B, 1, -1, 2)
        w = F.grid_sample(field.float(), norm, mode="bilinear", align_corners=False)
        return w.squeeze(2).permute(0, 2, 1)  # (B,C,1,N) -> (B, N, C)

    def forward(self, warp_field: torch.Tensor,
                mask: Optional[torch.Tensor] = None) -> Dict[str, torch.Tensor]:
        S = self.sample
        B = warp_field.shape[0]
        pts_u = self.pts.view(1, -1, 2).expand(B, -1, 2)
        w = self._sample_field(warp_field)[:, :, :2]
        P1 = pts_u + w                      # punti deformati
        ref = 1.0 / (S - 1)
        Pm = P1.view(B, S, S, 2)

        d_r = Pm[1:, :, :] - Pm[:-1, :, :]
        d_c = Pm[:, 1:, :] - Pm[:, :-1, :]
        e_r = torch.tensor([ref, 0.0], device=P1.device).view(1, 1, 2)
        e_c = torch.tensor([0.0, ref], device=P1.device).view(1, 1, 2)
        e_stretch = ((d_r - e_r) ** 2).mean() + ((d_c - e_c) ** 2).mean()

        L = (Pm[:, 2:, 1:-1] + Pm[:, :-2, 1:-1] + Pm[:, 1:-1, 2:] + Pm[:, 1:-1, :-2]
             - 4.0 * Pm[:, 1:-1, 1:-1])
        e_bend = (L ** 2).mean() / (ref ** 2)

        if mask is None:
            e_gravity = torch.zeros((), device=P1.device)
        else:
            m = mask.float()
            if m.dim() == 3:
                m = m.unsqueeze(0)
            if m.shape[-2:] != (S, S):
                m = F.adaptive_avg_pool2d(m, (S, S))
            rows = torch.linspace(0.0, 1.0, S, device=P1.device).view(1, 1, S, 1)
            mb = m[:, :, S // 2:, :]                # (B,1,S/2,S) meta inferiore
            rb = rows[:, :, S // 2:, :]             # (1,1,S/2,1)
            rest_bot = (rb * mb).sum(dim=(1, 2, 3)) / mb.sum(dim=(1, 2, 3)).clamp(min=1e-6)
            y_bot = Pm[:, -1, :, 1].mean(dim=1)     # (B,) riga deformata inferiore
            e_gravity = F.relu(rest_bot - y_bot).mean()

        return {"E_stretch": e_stretch, "E_bend": e_bend, "E_gravity": e_gravity}


class TexEncoder(nn.Module):
    """Codificatore texture leggero condiviso (Logo-Anchor + identity)."""

    def __init__(self, dim: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            ConvBlock(3, 64, stride=2),
            ConvBlock(64, dim, stride=2),
        )

    def forward(self, img: torch.Tensor) -> torch.Tensor:
        return self.net(img)


class DepthHead(nn.Module):
    """Testa di profondità per-view (precursore 3DGS)."""

    def __init__(self, in_ch: int = 512):
        super().__init__()
        self.net = nn.Sequential(
            ConvBlock(in_ch, 128),
            ConvBlock(128, 64),
            nn.Conv2d(64, 1, 1),
        )

    def forward(self, feat: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.net(feat))


class UncertaintyHead(nn.Module):
    """Innovazione 6 — incertezza eteroscedastica per-pixel (log sigma^2)."""

    def __init__(self, in_ch: int = 512):
        super().__init__()
        self.net = nn.Sequential(
            ConvBlock(in_ch, 128),
            ConvBlock(128, 64),
            nn.Conv2d(64, 1, 1),
        )

    def forward(self, feat: torch.Tensor) -> torch.Tensor:
        return self.net(feat)


class WarpRefineDecoder(nn.Module):
    """P0 (Gap 1) — warp-then-refine: decodifica il warp field latente in un flow
    field pixel-space e lo applica al capo. L'UNet fa solo refinement (occlusioni,
    illuminazione, bordi): geometria del drape e posizione della texture sono
    vincolate da un flusso reale, non generate alla cieca dal prior di diffusion."""

    def __init__(self, warp_ch: int = 4, mid: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(warp_ch + 1, mid, 3, padding=1), nn.ReLU(),
            nn.Conv2d(mid, mid * 2, 3, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(mid * 2, mid * 2, 3, padding=1), nn.ReLU(),
        )
        self.flow_head = nn.Conv2d(mid * 2, 2, 3, padding=1)

    def forward(self, warp_latent: torch.Tensor, mask: torch.Tensor,
                out_hw: Tuple[int, int], flow_max: float = 0.25) -> torch.Tensor:
        cond = torch.cat([warp_latent, mask], dim=1)
        feat = F.interpolate(self.net(cond), size=out_hw, mode="bilinear", align_corners=False)
        return torch.tanh(self.flow_head(feat)) * flow_max


def apply_flow_to_image(img: torch.Tensor, flow: torch.Tensor) -> torch.Tensor:
    """Warpa img (B,3,H,W) in [0,1] con flow (B,2,H,W) in coord normalizzate."""
    B, _, H, W = img.shape
    ys, xs = torch.meshgrid(torch.linspace(-1, 1, H, device=img.device),
                            torch.linspace(-1, 1, W, device=img.device), indexing="ij")
    grid = torch.stack([xs, ys], dim=-1).unsqueeze(0).expand(B, -1, -1, -1)
    if flow.dim() == 4:  # NCHW -> NHWC per il broadcasting col grid
        flow = flow.permute(0, 2, 3, 1)
    return F.grid_sample(img.float(), grid + flow * 2.0, mode="bilinear",
                         padding_mode="zeros", align_corners=False)


class PerceptualLoss(nn.Module):
    """P0 — distanza percettiva (feature VGG16, LPIPS-lite) con opzionale mask.
    Se torchvision/weight non sono disponibili degrada a wavelet multi-livello."""

    def __init__(self):
        super().__init__()
        self._vgg = None
        self._failed = False

    def _get_vgg(self, device):
        if self._vgg is None and not self._failed:
            try:
                from torchvision import models
                vgg = models.vgg16(weights=models.VGG16_Weights.IMAGENET1K_V1).features
                vgg = vgg.to(device).eval()
                for p in vgg.parameters():
                    p.requires_grad_(False)
                self._vgg = vgg
            except Exception:
                self._failed = True  # offline / no torchvision: fallback permanente
        return self._vgg

    @staticmethod
    def _normalize(x: torch.Tensor) -> torch.Tensor:
        mean = torch.tensor([0.485, 0.456, 0.406], device=x.device).view(1, 3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225], device=x.device).view(1, 3, 1, 1)
        return (x - mean) / std

    def forward(self, pred: torch.Tensor, target: torch.Tensor,
                mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        dev = pred.device
        vgg = self._get_vgg(dev)
        if vgg is None:
            return wavelet_loss(pred, target, levels=2, hf_gain=1.0)
        p = F.interpolate(pred.float(), size=(256, 256), mode="bilinear", align_corners=False)
        t = F.interpolate(target.float(), size=(256, 256), mode="bilinear", align_corners=False)
        m0 = None
        if mask is not None:
            m0 = F.interpolate(mask.float(), size=(256, 256), mode="bilinear", align_corners=False)
        p, t = self._normalize(p.clamp(0, 1)), self._normalize(t.clamp(0, 1))
        keep = (3, 8, 15, 22, 29)

        def feats(img):
            out, x = [], img
            for i, layer in enumerate(vgg):
                x = layer(x)
                if i in keep:
                    out.append(F.normalize(x, dim=1))
            return out

        d, n = 0.0, 0
        for a, b in zip(feats(p), feats(t)):
            if m0 is not None:
                mm = F.interpolate(m0, size=a.shape[-2:], mode="bilinear", align_corners=False)
                term = ((a - b).abs() * mm).sum() / mm.sum().clamp(min=1e-6)
            else:
                term = (a - b).abs().mean()
            d += term
            n += 1
        return d / max(n, 1)


LOSS_KEYS = ["flow", "drape_stretch", "drape_bend", "drape_gravity", "uncertainty",
             "material", "wavelet", "identity", "logo", "perceptual", "complement",
             "penetration"]


class AdaptiveLossWeights(nn.Module):
    """Innovazione 7 — pesi delle loss appresi (Kendall et al.):
    L = sum_i exp(-s_i) * L_i + sum_i s_i, con s_i parametri liberi.
    I nomi dei termini sono fissi in LOSS_KEYS (robusto all'ordine del dizionario)."""

    def __init__(self, names: Optional[list] = None):
        super().__init__()
        self.names = list(names) if names is not None else list(LOSS_KEYS)
        self._idx = {n: i for i, n in enumerate(self.names)}
        self.s = nn.Parameter(torch.zeros(len(self.names)))

    def weights(self) -> torch.Tensor:
        return torch.exp(-self.s)

    def combine(self, losses: Dict[str, torch.Tensor]) -> Tuple[torch.Tensor, Dict[str, float]]:
        w = self.weights()
        total = self.s.sum()
        info: Dict[str, float] = {}
        for k, v in losses.items():
            if v is None or k not in self._idx:
                continue
            total = total + w[self._idx[k]] * v
            info[k] = float(w[self._idx[k]].detach())
        return total, info


class RectifiedFlow:
    """Innovazioni 3+4 — rectified flow (v-prediction) con ri-pesatura min-SNR-gamma.

    Convenzione: t=0 -> dati, t=1 -> rumore;
      x_t = (1-t)*x0 + t*x1 ,  target v = x1 - x0 .
    Il sampling integra da t=1 a t=0 con step rettilinei (nessuna curvatura).
    """

    def __init__(self, steps: int = 8, gamma: float = 5.0):
        self.steps = steps
        self.gamma = gamma

    @staticmethod
    def sample_t(batch: int, device) -> torch.Tensor:
        return torch.rand(batch, device=device).clamp(1e-3, 1.0 - 1e-3)

    @staticmethod
    def interpolate(x0: torch.Tensor, x1: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        t = t.view(-1, 1, 1, 1)
        return (1.0 - t) * x0 + t * x1

    @staticmethod
    def target_v(x0: torch.Tensor, x1: torch.Tensor) -> torch.Tensor:
        return x1 - x0

    @staticmethod
    def predict_x0(xt: torch.Tensor, v: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        t = t.view(-1, 1, 1, 1)
        return xt - t * v

    def weight(self, t: torch.Tensor) -> torch.Tensor:
        """min-SNR-gamma: w(t) = min(SNR(t), gamma) / SNR(t), con SNR_RF(t) = ((1-t)/t)^2.

        Esempio: t=0.05 -> SNR=361 -> w=5/361 ~= 0.014 (basso rumore pesato poco).
        """
        snr = ((1.0 - t) / t.clamp(min=1e-4)) ** 2
        return torch.min(snr, torch.full_like(snr, self.gamma)) / snr


# --------------------------------------------------------------------------- #
#  Adattatori cross zero-init (token capo -> self-attention UNet)             #
# --------------------------------------------------------------------------- #
class ZeroCrossAdapter(nn.Module):
    """Adattatore zero-init che inietta i token semantici del capo in ogni livello
    di self-attention dell'UNet, tramite forward hook (robusto alle versioni diffusers).

    Allo step 0 gate=0 -> contributo ESATTAMENTE nullo -> il modello replica la base
    SD-inpainting (warm start perfetto). Ospita anche la cache per-view usata per la
    coerenza multi-view 360° (modalità record / inject al sampling).
    """

    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim
        self.to_k = nn.Linear(dim, dim, bias=False)
        self.to_v = nn.Linear(dim, dim, bias=False)
        self.gate = nn.Parameter(torch.zeros(1))
        self.tokens: Optional[torch.Tensor] = None
        self.mode = "off"  # off | record | inject
        self.cached: Optional[torch.Tensor] = None

    def _tok_seq(self, side: int) -> torch.Tensor:
        """Token del capo in sequenza (B, N', dim); proiezione pigra se i canali
        non coincidono con dim (robusto a token_ch != dim UNet)."""
        tok = F.adaptive_avg_pool2d(self.tokens, (side, side))   # (B, C_t, s, s)
        T = tok.flatten(2).transpose(1, 2)                        # (B, N', C_t)
        if T.shape[-1] != self.dim:
            proj = getattr(self, "_tok_proj", None)
            if proj is None or proj.in_features != T.shape[-1]:
                self._tok_proj = nn.Linear(T.shape[-1], self.dim).to(T.device, T.dtype)
            T = self._tok_proj(T)
        return T

    def contribution(self, hs: torch.Tensor) -> torch.Tensor:
        if hs.dim() == 4:  # feature map conv (stub/tiny UNet): appiattisci
            B, C, Hs, Ws = hs.shape
            out = self._contrib(hs.flatten(2).transpose(1, 2))
            return out.transpose(1, 2).reshape(B, C, Hs, Ws)
        return self._contrib(hs)

    def _contrib(self, seq: torch.Tensor) -> torch.Tensor:
        B, N, D = seq.shape
        side = int(round(math.sqrt(N)))
        T = self._tok_seq(side)
        k = self.to_k(T)
        v = self.to_v(T)
        scale = D ** -0.5
        w = torch.bmm(seq, k.transpose(1, 2)) * scale
        w = F.softmax(w.float(), dim=-1).to(seq.dtype)
        return self.gate * torch.bmm(w, v)


def _adapter_hook(adapter: ZeroCrossAdapter):
    def hook(module, inputs, output):
        if adapter.tokens is None or not isinstance(output, torch.Tensor):
            return output
        hs = inputs[0] if isinstance(inputs, (tuple, list)) and len(inputs) > 0 else None
        if not isinstance(hs, torch.Tensor):
            return output
        try:
            contrib = adapter.contribution(hs)
        except Exception:
            return output
        if adapter.mode == "record":
            adapter.cached = contrib.detach()
            return output + contrib
        if adapter.mode == "inject" and adapter.cached is not None \
                and adapter.cached.shape == output.shape:
            return output + 0.5 * contrib + 0.5 * adapter.cached
        return output + contrib

    return hook


def _iter_self_attn(unet):
    blocks = list(getattr(unet, "down_blocks", []))
    mb = getattr(unet, "mid_block", None)
    if mb is not None:
        blocks.append(mb)
    blocks.extend(list(getattr(unet, "up_blocks", [])))
    for block in blocks:
        attns = getattr(block, "attentions", None)
        if attns is None:
            continue
        for a in attns:
            yield getattr(a, "attn1", a)


def install_zero_cross_adapters(unet) -> List[ZeroCrossAdapter]:
    adapters: List[ZeroCrossAdapter] = []
    for module in _iter_self_attn(unet):
        to_q = getattr(module, "to_q", None)
        if to_q is None or not hasattr(to_q, "out_features"):
            continue
        adapter = ZeroCrossAdapter(int(to_q.out_features))
        module.register_forward_hook(_adapter_hook(adapter))
        adapters.append(adapter)
    return adapters


def _mid_dim(unet) -> int:
    mb = getattr(unet, "mid_block", None)
    if mb is not None:
        for attr in ("conv_in", "conv_1"):
            c = getattr(mb, attr, None)
            if c is not None and hasattr(c, "out_channels"):
                return int(c.out_channels)
        # fallback: dim di attention (SD-UNet: 512; TinyUNet: mid)
        attns = getattr(mb, "attentions", None)
        if attns:
            a0 = getattr(attns[0], "attn1", attns[0])
            q = getattr(a0, "to_q", None)
            if q is not None and hasattr(q, "out_features"):
                return int(q.out_features)
    return 512


def _expand_conv_in(unet, total_channels: int) -> None:
    """Espande conv_in (9 -> 39 canali): i primi 9 pesi SD vengono copiati,
    i restanti (body/depth/warp) sono zero-init -> warm start identico alla base."""
    old = unet.conv_in
    new = nn.Conv2d(total_channels, old.out_channels, old.kernel_size,
                    old.stride, old.padding, bias=old.bias is not None)
    with torch.no_grad():
        n_old = min(old.in_channels, total_channels)
        new.weight[:, :n_old].copy_(old.weight[:, :n_old])
        if old.bias is not None and new.bias is not None:
            new.bias.copy_(old.bias)
    unet.conv_in = new


# --------------------------------------------------------------------------- #
#  Loss a pixel (wavelet / identity / logo)                                    #
# --------------------------------------------------------------------------- #
def _haar(x: torch.Tensor):
    er, orr = x[..., 0::2, :], x[..., 1::2, :]
    Lr = (er + orr) * 0.7071
    Hr = (er - orr) * 0.7071
    ec, oc = Lr[..., :, 0::2], Lr[..., :, 1::2]
    LL = (ec + oc) * 0.7071
    HL = (ec - oc) * 0.7071
    ec, oc = Hr[..., :, 0::2], Hr[..., :, 1::2]
    LH = (ec + oc) * 0.7071
    HH = (ec - oc) * 0.7071
    return LL, LH, HL, HH


def wavelet_loss(pred: torch.Tensor, target: torch.Tensor,
                 levels: int = 3, hf_gain: float = 3.0) -> torch.Tensor:
    """L1 + sotto-bande ad alta frequenza (Haar DWT) con guadagno (convenzione v1)."""
    total = F.l1_loss(pred, target)
    hp = 0.0
    n = 0
    p, t = pred, target
    for _ in range(levels):
        if p.shape[-1] < 2 or p.shape[-2] < 2:
            break
        p_ll, p_lh, p_hl, p_hh = _haar(p)
        t_ll, t_lh, t_hl, t_hh = _haar(t)
        hp = hp + F.l1_loss(p_lh, t_lh) + F.l1_loss(p_hl, t_hl) + F.l1_loss(p_hh, t_hh)
        n += 1
        p, t = p_ll, t_ll
    return total + hf_gain * (hp / max(n, 1))


# --------------------------------------------------------------------------- #
#  EMA (memoria CPU)                                                           #
# --------------------------------------------------------------------------- #
class EMA:
    def __init__(self, module: nn.Module, decay: float = 0.999):
        self.decay = decay
        self.shadow = {k: v.detach().cpu().clone()
                       for k, v in module.state_dict().items() if v.dtype.is_floating_point}

    @torch.no_grad()
    def update(self, module: nn.Module) -> None:
        sd = module.state_dict()
        for k, v in self.shadow.items():
            cur = sd.get(k)
            if cur is None or cur.dtype != v.dtype:
                continue
            v.mul_(self.decay).add_(cur.detach().cpu(), alpha=1.0 - self.decay)

    def state_dict(self) -> Dict[str, torch.Tensor]:
        return dict(self.shadow)

    def load_state_dict(self, shadow: Dict[str, torch.Tensor]) -> None:
        self.shadow = {k: v.cpu().clone() for k, v in shadow.items()}

    @torch.no_grad()
    def copy_to(self, module: nn.Module) -> None:
        sd = module.state_dict()
        for k in list(sd.keys()):
            if k in self.shadow and sd[k].dtype.is_floating_point:
                sd[k].copy_(self.shadow[k].to(sd[k].device))


# --------------------------------------------------------------------------- #
#  Modello principale                                                          #
# --------------------------------------------------------------------------- #
class PhysDrapeVTON(nn.Module):
    """PhysDrape-VTON v2 — vedere docstring di modulo per le 8 innovazioni.

    Layout input UNet (conv_in espansa a 39 canali):
      [ x_t(4) | mask(1) | persona_latent(4) | body_pose(25) | depth(1) | warp(4) ]
    """

    def __init__(self, cfg: Optional[PhysDrapeConfig] = None):
        super().__init__()
        self.cfg = cfg or PhysDrapeConfig()
        self.dualscale = DualScaleEncoder(self.cfg.token_ch)
        self.materialnet = MaterialNet()
        self.warpnet = DrapeWarpV2(self.cfg.body_ch, self.cfg.warp_ch)
        self.energies = EnergyNet(self.cfg.energy_sample)
        self.texenc = TexEncoder(128)
        self.flow = RectifiedFlow(self.cfg.n_flow_steps, self.cfg.min_snr_gamma)
        # P0 warp-then-refine: flow field pixel-space + capo warpato come conditioning
        self.warp_decoder = WarpRefineDecoder(self.cfg.warp_ch)
        self.perceptual = PerceptualLoss()
        # 12 pesi appresi (Kendall), nomi fissi in LOSS_KEYS
        self.loss_weights = AdaptiveLossWeights(LOSS_KEYS)
        # interruttori per ablation (usati dall'eval harness)
        self.enabled = {k: True for k in ("material", "energies", "logo", "uncertainty",
                                          "perceptual", "complement", "penetration",
                                          "warp_refine")}

        self.unet: Optional[nn.Module] = None
        self.adapters: List[ZeroCrossAdapter] = []
        self.depth_head: Optional[DepthHead] = None
        self.unc_head: Optional[UncertaintyHead] = None
        self.vae = None
        self.text_encoder = None
        self.tokenizer = None
        self._mid_feat: Optional[torch.Tensor] = None

    # ---------------- backbone --------------------------------------------- #
    def attach_unet(self, unet: nn.Module) -> "PhysDrapeVTON":
        """Attacca un UNet2DConditionModel (SD-inpainting o tiny per selftest)."""
        # allinea device/dtype del nuovo UNet a quelli del modello (evita mismatch cpu/cuda)
        dev = next(self.parameters()).device
        if unet.device != dev:
            unet = unet.to(dev)
        self.unet = unet
        self.adapters = install_zero_cross_adapters(unet)
        dim = _mid_dim(unet)
        self.depth_head = DepthHead(dim)
        self.unc_head = UncertaintyHead(dim)

        def _tap(module, inp, out):
            if isinstance(out, torch.Tensor):
                self._mid_feat = out

        unet.mid_block.register_forward_hook(_tap)
        return self

    def load_backbone(self, unet_id: Optional[str] = None, device="cpu",
                      dtype=torch.float32) -> "PhysDrapeVTON":
        """Carica SD-inpainting (UNet+VAE+CLIP), espande conv_in a 39 canali,
        installa adattatori e teste. Richiede diffusers + transformers."""
        from diffusers import AutoencoderKL, UNet2DConditionModel
        from transformers import CLIPTextModel, CLIPTokenizer

        unet_id = unet_id or self.cfg.unet_id
        unet = UNet2DConditionModel.from_pretrained(unet_id, subfolder="unet").to(device=device, dtype=dtype)
        # [x_t(4)|mask(1)|persona(4)|body(25)|depth(1)|warp(4)|capo_warpato(3)]
        total = 4 + 1 + (4 + self.cfg.body_ch + 1 + self.cfg.warp_ch + 3)  # = 42
        _expand_conv_in(unet, total)

        vae = AutoencoderKL.from_pretrained(unet_id, subfolder="vae").to(device=device, dtype=dtype)
        text_encoder = CLIPTextModel.from_pretrained(unet_id, subfolder="text_encoder").to(device=device, dtype=dtype)
        tokenizer = CLIPTokenizer.from_pretrained(unet_id, subfolder="tokenizer")

        self.vae = vae
        self.text_encoder = text_encoder
        self.tokenizer = tokenizer
        return self.attach_unet(unet)

    # ---------------- helper ------------------------------------------------- #
    def _text_emb(self, text: str, device) -> torch.Tensor:
        if self.text_encoder is None or self.tokenizer is None:
            dim = int(getattr(self.unet.config, "cross_attention_dim", 768))
            return torch.randn(1, 77, dim, device=device)
        toks = self.tokenizer(text, padding="max_length", max_length=77,
                              truncation=True, return_tensors="pt").input_ids.to(device)
        with torch.no_grad():
            emb = self.text_encoder(toks)[0].last_hidden_state
        return emb

    def _encode_img(self, img: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            z = self.vae.encode(img.to(self.vae.dtype)).latent_dist.sample()
        return z * self.cfg.vae_scale

    def _decode_latent(self, z: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            img = self.vae.decode(z.to(self.vae.dtype) / self.cfg.vae_scale).sample
        return (img.clamp(-1, 1) + 1.0) / 2.0

    def _set_tokens(self, sem: torch.Tensor) -> None:
        for a in self.adapters:
            a.tokens = sem

    def _set_mode(self, mode: str) -> None:
        for a in self.adapters:
            a.mode = mode

    def _unet_step(self, xt, t, extra_cond, mask1, text_emb):
        self._mid_feat = None
        out = self.unet(
            sample=xt,
            timestep=t * 1000.0,
            encoder_hidden_states=text_emb,
            mask_image=mask1,
            masked_image_latent=extra_cond,
        )
        s = getattr(out, "sample", None)
        return s if s is not None else out[0]

    # ---------------- loss a pixel ------------------------------------------- #
    def identity_loss(self, gen_img: torch.Tensor, person_img: torch.Tensor,
                      face_mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        """Preserva l'identità del volto: L1 sulla regione facciale + coseno feature.
        (Upgrade opzionale: ArcFace — vedi INTEGRATION_GUIDE.md §7.)"""
        if face_mask is not None and face_mask.sum() > 0:
            m = F.interpolate(face_mask.float(), size=gen_img.shape[-2:],
                              mode="bilinear", align_corners=False)
            l1 = (F.l1_loss(gen_img, person_img, reduction="none") * m).sum() / m.sum().clamp(min=1e-6)
        else:
            h, w = gen_img.shape[-2:]
            y0, y1 = int(0.05 * h), int(0.45 * h)
            x0, x1 = int(0.30 * w), int(0.70 * w)
            l1 = F.l1_loss(gen_img[..., y0:y1, x0:x1], person_img[..., y0:y1, x0:x1])
        fg = F.adaptive_avg_pool2d(self.texenc(gen_img), 1).flatten(1)
        fp = F.adaptive_avg_pool2d(self.texenc(person_img), 1).flatten(1)
        cos = F.cosine_similarity(fg, fp, dim=1)
        return l1 + (1.0 - cos).mean()

    def _logo_anchor_single(self, g: torch.Tensor, f: torch.Tensor,
                            w: torch.Tensor, m: torch.Tensor):
        """Logo-Anchor per una singola immagine (batch=1)."""
        K = self.cfg.nce_k
        dev = g.device
        H, W = g.shape[-2:]
        ys, xs = torch.meshgrid(torch.linspace(0, 1, H, device=dev),
                                torch.linspace(0, 1, W, device=dev), indexing="ij")
        grid = torch.stack([xs, ys], dim=-1).reshape(-1, 2)          # (HW, 2) in [0,1]
        m_grid = F.grid_sample(m.float(), (grid * 2 - 1).view(1, 1, -1, 2),
                               mode="bilinear", align_corners=False)[0, 0]
        valid = (m_grid > 0.5).nonzero().flatten()
        if valid.numel() < max(K, 8):
            return F.mse_loss(g, f), None
        idx = valid[torch.randperm(valid.numel(), device=dev)[:K]]
        pts = grid[idx]
        w_pts = F.grid_sample(w.float(), (pts * 2 - 1).view(1, 1, K, 2),
                              mode="bilinear", align_corners=False)[0].squeeze(1).T  # (K,C)
        pts_w = (pts + w_pts[:, :2]).clamp(0.0, 1.0)

        fg = F.grid_sample(self.texenc(g), (pts * 2 - 1).view(1, 1, K, 2),
                           mode="bilinear", align_corners=False)[0, 0]  # (C, K)
        ff = F.grid_sample(self.texenc(f), (pts_w * 2 - 1).view(1, 1, K, 2),
                           mode="bilinear", align_corners=False)[0, 0]  # (C, K)
        mse = F.mse_loss(fg, ff)

        fg_n = F.normalize(fg, dim=0)
        ff_n = F.normalize(ff, dim=0)
        s_pos = (fg_n * ff_n).sum(dim=0)
        perm = torch.randperm(K, device=dev)
        s_neg = (fg_n * ff_n[:, perm]).sum(dim=0)
        tau = 0.1
        nce = -torch.log(torch.exp(s_pos / tau) /
                         (torch.exp(s_pos / tau) + torch.exp(s_neg / tau))).mean()
        return mse, nce

    def logo_anchor_loss(self, garment_img: torch.Tensor, gen_img: torch.Tensor,
                         warp_field: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        """Innovazione 5 — Logo-Anchor (batch): le texture del capo nei punti deformati
        dal warp devono combaciare con quelle dell'immagine generata (MSE + InfoNCE)."""
        B = garment_img.shape[0]
        m = F.interpolate(mask.float(), size=gen_img.shape[-2:],
                          mode="bilinear", align_corners=False)
        total_mse = None
        nces: List[torch.Tensor] = []
        for i in range(B):
            mse_i, nce_i = self._logo_anchor_single(
                garment_img[i:i + 1], gen_img[i:i + 1], warp_field[i:i + 1], m[i:i + 1])
            total_mse = mse_i if total_mse is None else total_mse + mse_i
            if nce_i is not None:
                nces.append(nce_i)
        out = total_mse / B
        if nces:
            out = out + self.cfg.nce_weight * torch.stack(nces).mean()
        return out

    # ---------------- forward di training ------------------------------------ #
    def forward(self, x0_latent: torch.Tensor, garment_img: torch.Tensor,
                mask: torch.Tensor, body_pose: Optional[torch.Tensor] = None,
                depth: Optional[torch.Tensor] = None,
                person_img: Optional[torch.Tensor] = None,
                input_img: Optional[torch.Tensor] = None,
                face_mask: Optional[torch.Tensor] = None,
                material_gt: Optional[Dict[str, torch.Tensor]] = None,
                text: str = "a photo of a person wearing a stylish outfit",
                compute_pixel_losses: Optional[bool] = None) -> Dict[str, torch.Tensor]:
        if self.unet is None:
            raise RuntimeError("chiamare prima attach_unet() / load_backbone()")
        B = x0_latent.shape[0]
        dev = x0_latent.device
        H, W = x0_latent.shape[-2:]

        # --- Rectified Flow sampling del timestep ---
        t = self.flow.sample_t(B, dev)
        x1 = torch.randn_like(x0_latent)
        xt = self.flow.interpolate(x0_latent, x1, t)
        v_target = self.flow.target_v(x0_latent, x1)

        # --- fisica: materiale + warp + energie (+ P0 warp-then-refine) ---
        if self.enabled.get("material", True):
            material = self.materialnet(garment_img)
        else:  # ablation: materiale uniforme (warp cieco, come SOTA puri)
            material = {k: torch.full((B, 1), 0.5, device=dev) for k in ("k_s", "elast", "drape")}
        if body_pose is None:
            body_pose = torch.zeros(B, self.cfg.body_ch, H, W, device=dev)
        warp = self.warpnet(torch.cat([mask, body_pose], dim=1), material)

        # P0: flow field pixel-space -> capo warpato (vincolo geometrico reale)
        if self.enabled.get("warp_refine", True):
            gH, gW = garment_img.shape[-2:]
            self._flow = self.warp_decoder(warp, mask, (gH, gW), self.cfg.warp_flow_max)
            garment_warped = apply_flow_to_image(garment_img, self._flow)
        else:
            self._flow = None
            garment_warped = garment_img
        self._warped_garment = garment_warped
        warped_g_lat = F.interpolate(garment_warped.float(), size=(H, W),
                                     mode="bilinear", align_corners=False)

        depth_in = depth if depth is not None else torch.zeros(B, 1, H, W, device=dev)
        # layout conv_in: [x_t(4)|mask(1)|persona(4)|body(25)|depth(1)|warp(4)|capo_warpato(3)] = 42
        extra_cond = torch.cat([x0_latent, body_pose, depth_in, warp, warped_g_lat], dim=1)

        # --- token del capo -> adattatori zero-init ---
        sem, _tex_g = self.dualscale(garment_img)
        self._set_tokens(sem)
        text_emb = self._text_emb(text, dev)
        v_pred = self._unet_step(xt, t, extra_cond, mask, text_emb)

        losses: Dict[str, torch.Tensor] = {}
        per_sample_mse = F.mse_loss(v_pred, v_target, reduction="none")
        w_t = self.flow.weight(t)
        losses["flow"] = (w_t.view(-1, 1, 1, 1) * per_sample_mse).mean()

        if self.enabled.get("energies", True):
            E = self.energies(warp, mask)
            losses["drape_stretch"] = E["E_stretch"] * self.cfg.warp_scale
            losses["drape_bend"] = E["E_bend"] * self.cfg.warp_scale
            losses["drape_gravity"] = E["E_gravity"] * self.cfg.warp_scale

        if self.unc_head is not None and self._mid_feat is not None:
            logvar = F.interpolate(self.unc_head(self._mid_feat), size=(H, W),
                                   mode="bilinear", align_corners=False)
            losses["uncertainty"] = (0.5 * torch.exp(-logvar) * per_sample_mse
                                     + 0.5 * logvar).mean()

        if material_gt is not None:
            terms = []
            for k in ("k_s", "elast", "drape"):
                if k in material_gt and material_gt[k] is not None:
                    terms.append(F.mse_loss(material[k], material_gt[k].to(dev)))
            if terms:
                losses["material"] = sum(terms)

        # --- loss a pixel (decodifica costosa: campionata con probabilita) ---
        if compute_pixel_losses is not None:
            do_pixel = bool(compute_pixel_losses)
        else:
            do_pixel = torch.rand((), device=dev).item() < self.cfg.pixel_loss_prob
        if person_img is not None and do_pixel:
            x0_hat = self.flow.predict_x0(xt, v_pred, t)
            if self.vae is not None:
                gen_img = self._decode_latent(x0_hat)
            else:  # fallback senza VAE (selftest): usa i primi 3 canali del latente
                z3 = x0_hat[:, : min(3, x0_hat.shape[1])]
                gen_img = F.interpolate(z3, size=(H * 8, W * 8),
                                        mode="bilinear", align_corners=False).clamp(0, 1)
            gimg = person_img.to(dev)
            if gimg.shape[-2:] != gen_img.shape[-2:]:
                gimg = F.interpolate(gimg, size=gen_img.shape[-2:],
                                     mode="bilinear", align_corners=False)
            m_pix = F.interpolate(mask.float(), size=gen_img.shape[-2:],
                                  mode="bilinear", align_corners=False)
            losses["wavelet"] = wavelet_loss(gen_img, gimg, self.cfg.dwt_levels,
                                             self.cfg.hf_gain)
            losses["identity"] = self.identity_loss(gen_img, gimg, face_mask)
            if self.enabled.get("logo", True):
                losses["logo"] = self.logo_anchor_loss(garment_img, gen_img, warp, mask)
            # P0 — percettiva (VGG) sulla regione vestibile
            if self.enabled.get("perceptual", True):
                losses["perceptual"] = self.perceptual(gen_img, gimg, m_pix)
            # P0 — preservazione del complemento della mask (mani/viso/sfondo)
            if input_img is not None and self.enabled.get("complement", True):
                iimg = input_img.to(dev)
                if iimg.shape[-2:] != gen_img.shape[-2:]:
                    iimg = F.interpolate(iimg, size=gen_img.shape[-2:],
                                         mode="bilinear", align_corners=False)
                comp = (1.0 - m_pix).clamp(min=1e-6)
                losses["complement"] = ((gen_img - iimg).abs() * comp).sum() / comp.sum()
            # P0 — non-penetrazione: il capo non deve andare dietro al corpo
            if (depth is not None and self._mid_feat is not None
                    and self.depth_head is not None
                    and self.enabled.get("penetration", True)):
                gen_depth = F.interpolate(self.depth_head(self._mid_feat), size=(H, W),
                                          mode="bilinear", align_corners=False)
                p_depth = F.interpolate(depth.float(), size=(H, W),
                                        mode="bilinear", align_corners=False)
                m_lat = F.interpolate(mask.float(), size=(H, W),
                                      mode="bilinear", align_corners=False)
                viol = F.relu(gen_depth - p_depth + self.cfg.penetration_eps) * m_lat
                losses["penetration"] = viol.sum() / m_lat.sum().clamp(min=1e-6)

        total, weights_info = self.loss_weights.combine(losses)
        return {
            "total": total,
            "losses": {k: float(v.detach()) for k, v in losses.items()},
            "weights": weights_info,
            "material": {k: float(v.mean().detach()) for k, v in material.items()},
        }

    # ---------------- sampling ------------------------------------------------ #
    @torch.no_grad()
    def generate(self, person_masked_img: torch.Tensor, garment_img: torch.Tensor,
                 mask: Optional[torch.Tensor] = None,
                 body_pose: Optional[torch.Tensor] = None,
                 depth: Optional[torch.Tensor] = None,
                 text: str = "a photo of a person wearing a stylish outfit",
                 views: Tuple[str, ...] = ("front",),
                 steps: Optional[int] = None, seed: int = 0) -> Dict[str, torch.Tensor]:
        """Sampling Rectified Flow multi-view con KV-cache di coerenza.

        Ritorna per ogni view: immagine, '<view>_uncertainty' (sigma per-pixel)
        e '<view>_depth'. La prima view registra la cache, le successive la iniettano.
        """
        if self.unet is None:
            raise RuntimeError("chiamare prima attach_unet() / load_backbone()")
        dev = next(self.parameters()).device
        steps = steps or self.cfg.n_flow_steps

        B = person_masked_img.shape[0]
        if self.vae is not None:
            z_person = self._encode_img(person_masked_img.to(dev))
        else:  # fallback senza VAE (selftest)
            h = person_masked_img.shape[-2] // 8
            w = person_masked_img.shape[-1] // 8
            z3 = F.avg_pool2d(person_masked_img.to(dev).view(
                B * 3, 1, person_masked_img.shape[-2], person_masked_img.shape[-1]), 8).view(B, 3, h, w)
            z_person = torch.cat([z3, torch.zeros_like(z3[:, :1])], dim=1)

        B, C, H, W = z_person.shape
        if mask is None:
            mask = torch.ones(1, 1, H, W, device=dev)
        else:
            mask = F.interpolate(mask.to(dev).float(), size=(H, W),
                                 mode="bilinear", align_corners=False)
        # broadcasting robusto: conditioning mono-batch -> batch della persona
        if mask.shape[0] == 1 and B > 1:
            mask = mask.expand(B, *mask.shape[1:])
        if body_pose is not None and body_pose.shape[0] == 1 and B > 1:
            body_pose = body_pose.expand(B, *body_pose.shape[1:])
        garment_img = garment_img.to(dev)
        if garment_img.shape[0] == 1 and B > 1:
            garment_img = garment_img.expand(B, *garment_img.shape[1:])
        if body_pose is None:
            body_pose = torch.zeros(B, self.cfg.body_ch, H, W, device=dev)
        else:
            body_pose = F.interpolate(body_pose.to(dev).float(), size=(H, W),
                                      mode="bilinear", align_corners=False)
        if depth is not None:
            depth = F.interpolate(depth.to(dev).float(), size=(H, W),
                                  mode="bilinear", align_corners=False)
        depth_in = depth if depth is not None else torch.zeros(B, 1, H, W, device=dev)

        img_size = (H * 8, W * 8)
        # FIX: materiale/tokens/warp-then-refine derivano dal CAPO, non dalla persona
        gimg = F.interpolate(garment_img.to(dev), size=img_size,
                             mode="bilinear", align_corners=False).clamp(0, 1)
        material = self.materialnet(gimg)
        warp = self.warpnet(torch.cat([mask, body_pose], dim=1), material)

        if self.enabled.get("warp_refine", True):
            flow = self.warp_decoder(warp, mask, (gimg.shape[-2], gimg.shape[-1]),
                                     self.cfg.warp_flow_max)
            garment_warped = apply_flow_to_image(gimg, flow)
        else:
            flow, garment_warped = None, gimg
        warped_g_lat = F.interpolate(garment_warped.float(), size=(H, W),
                                     mode="bilinear", align_corners=False)

        sem, _ = self.dualscale(gimg)
        self._set_tokens(sem)
        text_emb = self._text_emb(text, dev)

        g = torch.Generator(device="cpu").manual_seed(seed)
        x_t = torch.randn(B, C, H, W, generator=g, device="cpu").to(dev)  # t=1: rumore puro
        dt = 1.0 / steps
        results: Dict[str, torch.Tensor] = {}
        for i, view in enumerate(views):
            self._set_mode("record" if i == 0 else "inject")
            x_v = x_t.clone()
            for s in range(steps):
                t_now = 1.0 - s * dt
                extra_cond = torch.cat([z_person, body_pose, depth_in, warp, warped_g_lat], dim=1)
                v = self._unet_step(x_v, t_now, extra_cond, mask, text_emb)
                x_v = x_v - dt * v  # dx/dt = v, integrazione da t=1 a t=0
            if self.vae is not None:
                img = self._decode_latent(x_v)
            else:  # stub senza VAE: pseudo-immagine dai primi 3 canali
                z3 = x_v[:, : min(3, x_v.shape[1])]
                img = F.interpolate(z3, size=(H * 8, W * 8), mode="bilinear",
                                    align_corners=False).clamp(0, 1)
            results[view] = img
            out_hw = img.shape[-2:] if img.dim() == 4 else (H, W)
            if self.unc_head is not None and self._mid_feat is not None:
                unc = F.interpolate(self.unc_head(self._mid_feat), size=out_hw,
                                    mode="bilinear", align_corners=False)
                results[view + "_uncertainty"] = torch.exp(0.5 * unc)  # sigma per-pixel
            if self.depth_head is not None and self._mid_feat is not None:
                results[view + "_depth"] = F.interpolate(self.depth_head(self._mid_feat),
                                                          size=out_hw, mode="bilinear",
                                                          align_corners=False)
        self._set_mode("off")
        results["garment_warped"] = garment_warped
        if flow is not None:
            results["flow"] = flow
        return results


__all__ = [
    "PhysDrapeConfig", "PhysDrapeVTON", "DualScaleEncoder", "MaterialNet",
    "DrapeWarpV2", "EnergyNet", "ZeroCrossAdapter", "RectifiedFlow",
    "AdaptiveLossWeights", "EMA", "wavelet_loss", "install_zero_cross_adapters",
    "WarpRefineDecoder", "PerceptualLoss", "apply_flow_to_image", "LOSS_KEYS",
]
