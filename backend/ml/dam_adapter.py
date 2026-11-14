"""Pinned, lazy DAM runner; independent of the web application and its secrets.

Reference code is downloaded intact, verified, and loaded in a private namespace.
Only imports, the pinned Whisper location and weights-only loading are adapted.
The numerical model and reference normalization/windowing remain unchanged.
"""
from __future__ import annotations

import ast
from copy import deepcopy
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import sys
import threading
import types

PROJECT_ROOT = Path(__file__).resolve().parents[2]
_LOAD_LOCK = threading.Lock()
_INFERENCE_LOCK = threading.Lock()


@lru_cache(maxsize=1)
def manifest() -> dict:
    return json.loads(Path(__file__).with_name("dam_manifest.json").read_text("utf-8"))


def verify_files(folder: Path, expected: dict[str, str]) -> None:
    """Fail closed before executing cached code or loading a checkpoint."""
    for name, digest in expected.items():
        path = folder / name
        actual = hashlib.sha256()
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
                actual.update(block)
        if actual.hexdigest() != digest:
            raise ValueError("DAM artifact integrity check failed")


@lru_cache(maxsize=1)
def prepare_artifacts(cache: str) -> tuple[Path, Path]:
    from huggingface_hub import snapshot_download

    spec = manifest()
    hub = str(Path(cache).resolve() / "hub")
    dam = Path(snapshot_download(
        spec["model"], revision=spec["revision"], cache_dir=hub,
        allow_patterns=list(spec["files"]), max_workers=2,
    ))
    verify_files(dam, spec["files"])
    backbone = spec["backbone"]
    whisper = Path(snapshot_download(
        backbone["model"], revision=backbone["revision"], cache_dir=hub,
        allow_patterns=backbone["files"], max_workers=2,
    ))
    return dam, whisper


def reference_tree(source: str, filename: str, backbone: Path) -> ast.Module:
    """Apply narrow, documented changes to the audited reference, in memory."""
    tree = ast.parse(source, filename=filename)
    counts = {"weights_only": 0, "extractor": 0}

    class Adapt(ast.NodeTransformer):
        def visit_ImportFrom(self, node):
            if node.level == 0 and node.module in {"config", "model", "featex"}:
                node.level = 1
            return node

        def visit_Call(self, node):
            self.generic_visit(node)
            if (filename == "pipeline.py" and isinstance(node.func, ast.Attribute)
                    and isinstance(node.func.value, ast.Name)
                    and node.func.value.id == "torch" and node.func.attr == "load"):
                node.keywords.append(ast.keyword(arg="weights_only", value=ast.Constant(True)))
                counts["weights_only"] += 1
            return node

        def visit_Constant(self, node):
            if filename == "featex.py" and node.value == "openai/whisper-small.en":
                counts["extractor"] += 1
                return ast.copy_location(ast.Constant(str(backbone)), node)
            return node

    tree = Adapt().visit(tree)
    if filename == "pipeline.py" and counts["weights_only"] != 1:
        raise ValueError("Unexpected DAM checkpoint loader")
    if filename == "featex.py" and counts["extractor"] != 1:
        raise ValueError("Unexpected DAM feature extractor")
    return ast.fix_missing_locations(tree)


def load_reference(folder: Path, backbone: Path):
    """No sys.path edits and no generic `config`, `model` or `pipeline` modules."""
    location = hashlib.sha256(str(backbone.resolve()).encode()).hexdigest()[:12]
    name = "_numa_dam_" + manifest()["revision"] + "_" + location
    existing = sys.modules.get(name + ".pipeline")
    if existing is not None:
        return existing
    package = types.ModuleType(name)
    package.__path__ = [str(folder)]
    package.__package__ = name
    sys.modules[name] = package
    created = [name]
    try:
        for stem in ("config", "model", "featex", "pipeline"):
            filename = stem + ".py"
            module_name = name + "." + stem
            module = types.ModuleType(module_name)
            module.__file__ = str(folder / filename)
            module.__package__ = name
            sys.modules[module_name] = module
            created.append(module_name)
            tree = reference_tree((folder / filename).read_text("utf-8"), filename, backbone)
            exec(compile(tree, module.__file__, "exec"), module.__dict__)
            setattr(package, stem, module)
        return module
    except BaseException:
        for module_name in reversed(created):
            sys.modules.pop(module_name, None)
        raise


@lru_cache(maxsize=1)
def _construct_pipeline(cache: str, device: str):
    import torch

    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("Requested CUDA device is unavailable")
    folder, backbone = prepare_artifacts(cache)
    reference = load_reference(folder, backbone)
    config = deepcopy(reference.default_config)
    for settings in config["backbone_configs"].values():
        settings["model"] = str(backbone)
    pipeline = reference.Pipeline(
        checkpoint=folder / "dam3.1.ckpt", config=config, device=torch.device(device),
    )
    pipeline.model.eval()
    pipeline.model.requires_grad_(False)
    return pipeline


def load_pipeline(cache: Path, device: str = "cpu"):
    if device not in {"cpu", "cuda"}:
        raise ValueError("Unsupported inference device")
    with _LOAD_LOCK:
        return _construct_pipeline(str(cache.resolve()), device)


def validate_scores(scores: dict) -> dict[str, float]:
    if set(scores) != {"depression", "anxiety"}:
        raise ValueError("Unexpected DAM output fields")
    result = {key: float(value.item() if hasattr(value, "item") else value)
              for key, value in scores.items()}
    if not all(math.isfinite(value) for value in result.values()):
        raise ValueError("DAM returned non-finite scores")
    return result


def infer(audio: Path, cache: Path, device: str = "cpu") -> dict[str, float]:
    import torch

    pipeline = load_pipeline(cache, device)
    with _INFERENCE_LOCK, torch.inference_mode():
        # Keep upstream file decoding and normalization; never quantize.
        return validate_scores(pipeline.run_on_file(str(audio), quantize=False))
