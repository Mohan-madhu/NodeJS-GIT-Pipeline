# Pipeline deployment modes

The pipeline supports two deployment modes for every registered project.

## Normal webhook

Use the normal webhook for GitHub push events:

```bash
curl -X POST "https://git-pipeline.metatronhost.in/git/webhook/<PROJECT_KEY>"
```

Before running the project command, the pipeline fetches the configured repository and compares it with its remote default branch.

- No new commits: deployment is skipped.
- Documentation-only changes (`README`, `CHANGELOG`, `docs/`, Markdown and text files): deployment is skipped.
- Source, configuration or dependency changes: the registered deployment command runs.

Skipped deployments are recorded in the pipeline log with the reason.

## Forced deployment

To bypass change detection and run the complete registered deployment command, add `force=true`:

```bash
curl -X POST "https://git-pipeline.metatronhost.in/git/webhook/<PROJECT_KEY>?force=true"
```

`hard=true` is an equivalent alias:

```bash
curl -X POST "https://git-pipeline.metatronhost.in/git/webhook/<PROJECT_KEY>?hard=true"
```

The same flags can be sent in a JSON request body:

```json
{
  "force": true
}
```

Force mode bypasses only the pipeline's no-change and documentation-only checks. It then executes the project's existing deployment definition exactly as written, including its own Docker cache, build, restart and health-check settings.

## RGU Linux example

```bash
curl -X POST "https://git-pipeline.metatronhost.in/git/webhook/RGU_Fleet_Management_Backend_Linux?force=true"
```

The RGU deployment builds the API image, recreates the API container, and checks `http://127.0.0.1:21001/api/health`. The legacy camera service on port `21000` is not part of this deployment.

## Response and logs

The webhook responds immediately with HTTP `202` and a `runId`. Follow the deployment through the pipeline status endpoint or PM2 logs. A successful run ends with `Deploy complete for <PROJECT_KEY>`; a skipped normal run reports the skip reason.

## Security note

Anyone who can reach a webhook endpoint can request a forced deployment. Put the pipeline behind the existing reverse proxy and add webhook authentication before exposing it publicly to untrusted clients.
