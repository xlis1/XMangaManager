import { useEffect, useState } from "react";
import { api, type AppConfig, type JobState } from "../api";

export function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [configResult, jobResult] = await Promise.all([
        api.getConfig(),
        api.getJobStatus(),
      ]);

      setConfig(configResult);
      setJob(jobResult);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }

  useEffect(() => {
    void load();

    const id = window.setInterval(() => {
      void api.getJobStatus().then(setJob);
    }, 1500);

    return () => window.clearInterval(id);
  }, []);

  async function save(partial: Partial<AppConfig>) {
    if (!config) return;

    try {
      setSaving(true);
      const updated = await api.updateConfig(partial);
      setConfig(updated);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function runCheckAll() {
    try {
      setRunning(true);
      await api.runCheckAllJob();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
      await load();
    } finally {
      setRunning(false);
    }
  }

  if (!config) return <p className="muted">Loading settings...</p>;

  return (
    <section>
      <div className="pageHeader">
        <div>
          <h1>Settings</h1>
          <p className="muted">Updater, rate limit, and archival behavior.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="settingsGrid">
        <section className="settingsCard">
          <h2>Updater</h2>

          <label>
            Update interval minutes
            <input
              type="number"
              min={0}
              value={config.updateIntervalMinutes}
              onChange={(event) =>
                void save({
                  updateIntervalMinutes: Number(event.target.value),
                })
              }
            />
          </label>

          <label className="checkboxRow">
            <input
              type="checkbox"
              checked={config.autoCheckOnStartup}
              onChange={(event) =>
                void save({
                  autoCheckOnStartup: event.target.checked,
                })
              }
            />
            Check tracked manga on startup
          </label>

          <button
            onClick={() => void runCheckAll()}
            disabled={running || job?.status === "running"}
          >
            {job?.status === "running" ? "Job Running..." : "Check All Now"}
          </button>
        </section>

        <section className="settingsCard">
          <h2>Rate Limiting</h2>

          <label>
            Metadata request delay ms
            <input
              type="number"
              min={250}
              step={250}
              value={config.requestDelayMs}
              onChange={(event) =>
                void save({
                  requestDelayMs: Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            Page download delay ms
            <input
              type="number"
              min={0}
              step={250}
              value={config.chapterDownloadDelayMs}
              onChange={(event) =>
                void save({
                  chapterDownloadDelayMs: Number(event.target.value),
                })
              }
            />
          </label>
        </section>

        <section className="settingsCard">
          <h2>Library Layout</h2>

          <label>
            Mobile columns
            <input
              type="number"
              min={2}
              max={5}
              value={config.libraryColumnsMobile}
              onChange={(event) =>
                void save({
                  libraryColumnsMobile: Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            Desktop columns
            <input
              type="number"
              min={4}
              max={10}
              value={config.libraryColumnsDesktop}
              onChange={(event) =>
                void save({
                  libraryColumnsDesktop: Number(event.target.value),
                })
              }
            />
          </label>
        </section>

        <section className="settingsCard">
          <h2>Job Status</h2>

          <p>
            <strong>Status:</strong> {job?.status ?? "unknown"}
          </p>

          <p>
            <strong>Job:</strong> {job?.jobName ?? "none"}
          </p>

          <p>
            <strong>Message:</strong> {job?.message ?? "none"}
          </p>

          {job?.startedAt && (
            <p>
              <strong>Started:</strong> {job.startedAt}
            </p>
          )}

          {job?.finishedAt && (
            <p>
              <strong>Finished:</strong> {job.finishedAt}
            </p>
          )}

          {job?.lastError && <p className="error">{job.lastError}</p>}
        </section>
      </div>

      {saving && <p className="muted">Saving...</p>}
    </section>
  );
}