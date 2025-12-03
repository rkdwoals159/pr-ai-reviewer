import express from "express";
import { Webhooks } from "@octokit/webhooks";
import { App as OctokitApp } from "@octokit/app";
import dotenv from "dotenv";
import { handlePullRequestEvent } from "./webhooks/pullRequest";

dotenv.config();

const PORT = process.env.PORT || 3000;

const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY;
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

if (!appId || !privateKey || !webhookSecret) {
  throw new Error(
    "Missing GitHub App configuration. Set GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET."
  );
}

const octokitApp = new OctokitApp({
  appId,
  privateKey,
});

const webhooks = new Webhooks({
  secret: webhookSecret,
});

webhooks.on("pull_request.opened", async ({ payload }) => {
  await handlePullRequestEvent(octokitApp, payload);
});

webhooks.on("pull_request.synchronize", async ({ payload }) => {
  await handlePullRequestEvent(octokitApp, payload);
});

const app = express();

app.use(express.json());

app.post("/webhooks/github", (req, res) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const id = req.headers["x-github-delivery"] as string | undefined;
  const eventName = req.headers["x-github-event"] as string | undefined;

  if (!signature || !id || !eventName) {
    return res.status(400).send("Missing GitHub webhook headers");
  }

  webhooks
    .receive({
      id,
      name: eventName as any,
      payload: req.body,
      signature,
    })
    .then(() => res.status(200).send("OK"))
    .catch((error) => {
      console.error("Error handling webhook", error);
      res.status(500).send("Webhook handling error");
    });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`GH PR Reviewer AI server listening on port ${PORT}`);
});


