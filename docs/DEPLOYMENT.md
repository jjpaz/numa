# Deployment and local maintenance

## Public demo

- Frontend: https://numa-one-xi.vercel.app
- API: https://rebollmartin--numa-api.us-east.modal.run
- Health: https://rebollmartin--numa-api.us-east.modal.run/api/health

The frontend runs on Vercel. FastAPI runs on Modal CPU with Aiven PostgreSQL and Gemini connected. The public runtime uses `NUMA_DEMO_MODE=false`, `NUMA_ML_ENABLED=false`, `NUMA_DEMO_NAME_LOGIN=true` and fictional seeded sample profiles.

The latest recorded frontend deployment is `dpl_F4GaqRxJDRDWknHGGLkUn8BcLBQs`, published on 15 November 2026 together with the named-profile API update. Its [deployment URL](https://numa-pyrpshp7w-numa-d0eb.vercel.app) is separate from the stable demo alias. See [current status](PROJECT_STATUS.md) and the [verification log](IMPLEMENTATION_LOG.md).

A GitHub merge does not by itself prove that Vercel or Modal has deployed that commit. The named-profile, polling and branding changes were deployed before they were committed; the submission update records that existing runtime in source control. Documentation and CI changes do not require a runtime redeployment.

## Reproduce connected mode

Use authorized Gemini, Aiven and Modal accounts and a Vercel project. Provider signup or an available connection does not prove that an event offer was redeemed; reference information is in [RESOURCES.md](RESOURCES.md).

1. Configure the server using [.env.production.example](../.env.production.example) and [backend/connected.env.example](../backend/connected.env.example). Keep real values in ignored local files and the Modal secret `numa-secrets`.
2. Use a TLS PostgreSQL URI (`postgresql://` or `postgresql+psycopg://` with `sslmode=verify-full`) and the provider's CA where required. PostgreSQL is the only persistent datastore.
3. Set a random session secret, unique configured account passwords and a Gemini model verified for audio and structured JSON. `GEMINI_MODEL` has no production default.
4. Enable `NUMA_DEMO_NAME_LOGIN=true` only for open fictional demonstrations. Patient names identify persistent demo profiles assigned to the shared psychologist. Anyone entering the same normalized name can reopen that journal; this does not provide private account authentication.
5. Keep `NUMA_ML_ENABLED=false`. The public API does not install vocal model weights or use a model Volume. The DAM/VAD runbooks describe independent experiments, not an application deployment.
6. Set `NUMA_ALLOWED_ORIGINS` to the exact HTTPS frontend origin. Keep `NUMA_SEED_DEMO=true` only when fictional presentation profiles are wanted.

Deploy the API from the repository root after authenticating the Modal CLI:

```sh
python -m pip install modal==1.6.4
modal setup
modal deploy -m backend.modal_app
```

On Windows, set `$env:PYTHONUTF8='1'` if the terminal cannot encode Modal's output.

For Vercel, use build command `npm run build`, output directory `dist` and the returned API origin as the build variable `VITE_API_BASE` (without `/api`). Redeploy after changing build variables. Never place database credentials, provider keys or session secrets in `VITE_*` variables or commit them.

Verify the deployed health endpoint, then use a uniquely named fictional patient to save an entry, confirm it from the psychologist portal and reopen the patient's journal. Remove only the verification records created by that check. Existing patient data should remain untouched.

## Optional connected checks

`python -m backend.smoke` verifies PostgreSQL write/read/delete and Gemini JSON using the configured environment. It creates its own verification record and makes a real provider request.

Dedicated PostgreSQL tests require `TEST_DATABASE_URL` pointing to a **different test database**. They must not use the live demo database. Default GitHub Actions checks do not use external credentials.

Do not add `--voice` to the smoke command for the ML-disabled public setup: that legacy option targets SpeechBrain, not DAM. Use the separate [DAM](ML_DAM.md), [Modal DAM](ML_DAM_MODAL.md) and [VAD](ML_VAD.md) runbooks for those experiments.

## Local preview helpers

The [README](../README.md#run-locally) covers a fresh checkout on Windows, macOS and Linux. Local preview uses ephemeral memory and does not need cloud credentials.

On Windows, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1` starts preview servers in hidden background windows and prints their PIDs. Logs are stored in ignored `.local/`; stop those exact processes when finished.

Before restarting an existing ephemeral preview, `python -m backend.preview` can back up accessible journal state to ignored `.local/preview-restore.json`. Starting `uvicorn backend.preview:create_preview --factory` restores it once. This explicit maintenance backup does not change connected PostgreSQL persistence or raw-audio retention.

Browser tests use ports 5174/8001, separate from the preview's 5173/8000. Their current launch configuration uses Windows PowerShell and Microsoft Edge.
