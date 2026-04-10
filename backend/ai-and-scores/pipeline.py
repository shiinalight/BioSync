"""
BioSync Scoring Pipeline
========================
Runs all four batch scoring scripts in sequence.
Execute this once (or whenever raw data changes) to regenerate
the pre-computed results in data/processed/.

Usage:
    python pipeline.py
"""

import runpy
from pathlib import Path

SCRIPTS = [
    "scoring/bio_age.py",
    "scoring/cv_risk.py",
    "scoring/lifestyle.py",
    "scoring/sleep_recovery.py",
]

if __name__ == "__main__":
    root = Path(__file__).parent
    for script in SCRIPTS:
        print(f"\n{'='*60}")
        print(f"  Running {script}")
        print(f"{'='*60}")
        runpy.run_path(str(root / script), run_name="__main__")
    print("\nPipeline complete — results written to data/processed/")
