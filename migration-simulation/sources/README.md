# Migration Source Databases

PRISM and PAS are synthetic legacy pension databases used for the Two-Source Proof.

## Generating Seed Data

The `02_seed.sql` files are generated (not checked in) — regenerate before running Docker:

```bash
# PRISM (100 members, ~8MB, ~30s)
cd migration-simulation/sources/prism
python prism_data_generator.py

# PAS (100 members, ~122MB, ~60s)
cd migration-simulation/sources/pas
python generate_pas_scenarios.py
```

Both generators use `random.seed(42)` for deterministic output.

## Docker Init

When `docker compose up` creates `prism-source` and `pas-source` containers,
PostgreSQL runs `init/01_schema.sql` then `init/02_seed.sql` automatically.

If seed files are missing, the containers will start with empty tables.
Regenerate and recreate: `docker compose rm -sf prism-source pas-source && docker compose up -d prism-source pas-source`
